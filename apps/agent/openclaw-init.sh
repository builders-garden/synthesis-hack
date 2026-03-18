#!/bin/bash
set -e

echo "============================================"
echo "  OpenClaw Agent Init"
echo "============================================"

# Defaults
export AGENT_NAME="${AGENT_NAME:-yield-agent}"
export VENICE_MODEL="${VENICE_MODEL:-venice/llama-3.3-70b}"
export VENICE_API_KEY="${VENICE_API_KEY:-}"
export LOCUS_API_KEY="${LOCUS_API_KEY:-}"
export SETUP_PASSWORD="${SETUP_PASSWORD:-changeme}"
export AUTH_PASSWORD="${SETUP_PASSWORD}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
export OPENCLAW_WORKSPACE_DIR="/data/workspace-agent"

# Ensure /data exists (volume mount may not create it on first boot)
mkdir -p /data

LOCUS_CREDS_FILE="/data/.locus-credentials.json"

# Generate gateway token if not provided
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  export OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
  echo "[init] Generated OPENCLAW_GATEWAY_TOKEN"
fi

# ── Locus self-registration ─────────────────────────────────────────────────
# If no LOCUS_API_KEY, register with Locus beta to get a wallet + API key
if [ -z "$LOCUS_API_KEY" ]; then
  # Check if we have saved credentials from a previous boot
  if [ -f "$LOCUS_CREDS_FILE" ]; then
    echo "[init] Found saved Locus credentials from previous boot"
    LOCUS_API_KEY="$(jq -r '.apiKey' "$LOCUS_CREDS_FILE")"
    LOCUS_OWNER_KEY="$(jq -r '.ownerPrivateKey' "$LOCUS_CREDS_FILE")"
    LOCUS_WALLET="$(jq -r '.ownerAddress' "$LOCUS_CREDS_FILE")"
    export LOCUS_API_KEY
  else
    echo "[init] No LOCUS_API_KEY set — self-registering with Locus beta..."
    REG_RESPONSE=""
    BACKOFF=5
    for attempt in $(seq 1 5); do
      HTTP_CODE=""
      REG_RESPONSE="$(curl -s -w "\n%{http_code}" -X POST https://beta-api.paywithlocus.com/api/register \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$AGENT_NAME\"}" 2>&1)"
      HTTP_CODE="$(echo "$REG_RESPONSE" | tail -1)"
      REG_RESPONSE="$(echo "$REG_RESPONSE" | sed '$d')"

      if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo "[init] Locus responded with HTTP $HTTP_CODE"
        break
      fi

      echo "[init] Registration attempt $attempt/5 failed (HTTP $HTTP_CODE)"
      echo "[init] Response body: $REG_RESPONSE"
      echo "[init] Retrying in ${BACKOFF}s..."
      sleep "$BACKOFF"
      BACKOFF=$((BACKOFF * 2))
      REG_RESPONSE=""
    done

    if [ -z "$REG_RESPONSE" ]; then
      echo "[init] WARNING: Locus registration failed after 5 attempts"
      echo "[init] Agent will boot without Locus — set LOCUS_API_KEY manually to fix"
    fi

    if [ -n "$REG_RESPONSE" ]; then
      REG_SUCCESS="$(echo "$REG_RESPONSE" | jq -r '.success // false')"
      if [ "$REG_SUCCESS" = "true" ]; then
        LOCUS_API_KEY="$(echo "$REG_RESPONSE" | jq -r '.data.apiKey')"
        LOCUS_OWNER_KEY="$(echo "$REG_RESPONSE" | jq -r '.data.ownerPrivateKey')"
        LOCUS_WALLET="$(echo "$REG_RESPONSE" | jq -r '.data.ownerAddress')"
        LOCUS_CLAIM_URL="$(echo "$REG_RESPONSE" | jq -r '.data.claimUrl')"
        LOCUS_WALLET_STATUS="$(echo "$REG_RESPONSE" | jq -r '.data.walletStatus')"

        export LOCUS_API_KEY

        # Save credentials (they appear only once!)
        echo "$REG_RESPONSE" | jq '.data' > "$LOCUS_CREDS_FILE"
        chmod 600 "$LOCUS_CREDS_FILE"

        echo "[init] Locus self-registration successful!"
        echo "[init]   API Key:  ${LOCUS_API_KEY:0:20}..."
        echo "[init]   Wallet:   $LOCUS_WALLET"
        echo "[init]   Status:   $LOCUS_WALLET_STATUS"
        echo "[init]   Claim:    $LOCUS_CLAIM_URL"
        echo "[init]   IMPORTANT: Fund wallet with USDC on Base to enable payments"

        # Wait for wallet deployment
        if [ "$LOCUS_WALLET_STATUS" = "deploying" ]; then
          echo "[init] Waiting for wallet deployment..."
          for i in $(seq 1 30); do
            sleep 2
            STATUS_RESP="$(curl -sf https://beta-api.paywithlocus.com/api/status \
              -H "Authorization: Bearer $LOCUS_API_KEY" 2>/dev/null)" || continue
            WALLET_STATUS="$(echo "$STATUS_RESP" | jq -r '.data.walletStatus // .walletStatus // "unknown"')"
            if [ "$WALLET_STATUS" = "deployed" ]; then
              echo "[init] Wallet deployed!"
              break
            fi
            echo "[init]   ...wallet status: $WALLET_STATUS (attempt $i/30)"
          done
        fi
      else
        echo "[init] WARNING: Locus registration returned success=false"
        echo "[init] Response: $REG_RESPONSE"
      fi
    fi
  fi
fi

# ── Write Locus credentials to filesystem ────────────────────────────────────
if [ -n "$LOCUS_API_KEY" ]; then
  echo "[init] Writing Locus credentials..."
  for dir in /root/.config/locus /home/node/.config/locus /data/.config/locus; do
    mkdir -p "$dir"
    cat > "$dir/credentials.json" <<EOF
{
  "api_key": "$LOCUS_API_KEY",
  "api_base": "https://beta-api.paywithlocus.com/api"
}
EOF
  done
else
  echo "[init] WARNING: No Locus API key — agent cannot pay for services"
fi

# ── Configure inference provider ─────────────────────────────────────────────
# Priority: Venice API key > Locus-wrapped OpenAI as bootstrap provider
if [ -n "$VENICE_API_KEY" ]; then
  echo "[init] Venice API key provided — using Venice for inference"
else
  if [ -n "$LOCUS_API_KEY" ]; then
    # Use Locus-wrapped OpenAI as the bootstrap inference provider
    # OpenClaw sees this as a standard OpenAI-compatible endpoint
    echo "[init] No Venice key — using Locus-wrapped OpenAI for bootstrap inference"
    export OPENAI_API_KEY="$LOCUS_API_KEY"
    export OPENAI_BASE_URL="https://beta-api.paywithlocus.com/api/wrapped/openai"
    export OPENCLAW_MODEL="${OPENCLAW_MODEL:-openai/gpt-4o-mini}"
  else
    echo "[init] WARNING: No inference provider available"
    echo "[init] Set VENICE_API_KEY or LOCUS_API_KEY in .env"
    echo "[init] Agent will boot but cannot process requests until a provider is configured"
  fi
fi

# ── Copy workspace files (first boot only) ──────────────────────────────────
if [ ! -d "$OPENCLAW_WORKSPACE_DIR" ]; then
  echo "[init] Setting up workspace..."
  mkdir -p "$OPENCLAW_WORKSPACE_DIR"
  cp -r /app/custom/workspaces/agent/* "$OPENCLAW_WORKSPACE_DIR/"

  # Render any templates in workspace files
  for f in "$OPENCLAW_WORKSPACE_DIR"/*.md; do
    if [ -f "$f" ]; then
      envsubst < "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    fi
  done

  echo "[init] Workspace ready at $OPENCLAW_WORKSPACE_DIR"
else
  echo "[init] Workspace already exists at $OPENCLAW_WORKSPACE_DIR"
fi

# ── Telegram channel ─────────────────────────────────────────────────────────
# OpenClaw reads TELEGRAM_BOT_TOKEN from env and auto-configures the channel.
# DM policy defaults to "pairing" — approve via `openclaw pairing approve telegram <CODE>`.
# To use allowlist mode instead, set TELEGRAM_ALLOWED_USERS to comma-separated user IDs.
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  export TELEGRAM_BOT_TOKEN
  if [ -n "${TELEGRAM_ALLOWED_USERS:-}" ]; then
    echo "[init] Telegram: configured (allowlist mode)"
  else
    echo "[init] Telegram: configured (pairing mode — DM bot, then approve via logs)"
  fi
else
  echo "[init] Telegram: not configured (set TELEGRAM_BOT_TOKEN in .env)"
fi

echo "--------------------------------------------"
echo "[init] Agent:    $AGENT_NAME"
if [ -n "$VENICE_API_KEY" ]; then
  echo "[init] Provider: Venice ($VENICE_MODEL)"
else
  echo "[init] Provider: Locus-wrapped OpenAI (bootstrap)"
fi
echo "[init] Locus:    $([ -n "$LOCUS_API_KEY" ] && echo "configured (${LOCUS_API_KEY:0:15}...)" || echo 'NOT configured')"
echo "[init] Telegram: $([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo 'configured' || echo 'not configured')"
echo "--------------------------------------------"

# ── Patch upstream entrypoint for single-container mode ──────────────────────
ENTRYPOINT="/app/scripts/entrypoint.sh"
if [ -f "$ENTRYPOINT" ]; then
  sed -i '/# Browser sidecar proxy/,/^[[:space:]]*}$/d' "$ENTRYPOINT"
  echo "[init] Patched entrypoint (removed browser sidecar block)"
fi

echo "[init] Handing off to OpenClaw entrypoint..."
exec "$ENTRYPOINT"
