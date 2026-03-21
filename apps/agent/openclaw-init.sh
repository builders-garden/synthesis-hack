#!/bin/bash
set -e

echo "============================================"
echo "  OpenClaw Lending Agent Init"
echo "============================================"

# Defaults
export AGENT_NAME="${AGENT_NAME:-lending-agent}"
export PRIVY_APP_ID="${PRIVY_APP_ID:-}"
export PRIVY_APP_SECRET="${PRIVY_APP_SECRET:-}"
export CELO_RPC_URL="${CELO_RPC_URL:-https://forno.celo.org}"
export SETUP_PASSWORD="${SETUP_PASSWORD:-changeme}"
export AUTH_PASSWORD="${SETUP_PASSWORD}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
export OPENCLAW_WORKSPACE_DIR="/data/workspace-agent"

# Ensure /data exists (volume mount may not create it on first boot)
mkdir -p /data

PRIVY_CREDS_FILE="/data/.privy-credentials.json"

# Generate gateway token if not provided
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  export OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
  echo "[init] Generated OPENCLAW_GATEWAY_TOKEN"
fi

# ── Privy agentic wallet ─────────────────────────────────────────────────
# Create a Privy server wallet for the agent on Celo
if [ -f "$PRIVY_CREDS_FILE" ]; then
  echo "[init] Found saved Privy wallet credentials from previous boot"
  AGENT_WALLET_ID="$(jq -r '.walletId' "$PRIVY_CREDS_FILE")"
  AGENT_WALLET_ADDRESS="$(jq -r '.address' "$PRIVY_CREDS_FILE")"
  export AGENT_WALLET_ID
  export AGENT_WALLET_ADDRESS
  echo "[init]   Wallet ID: $AGENT_WALLET_ID"
  echo "[init]   Address:   $AGENT_WALLET_ADDRESS"
elif [ -n "$PRIVY_APP_ID" ] && [ -n "$PRIVY_APP_SECRET" ]; then
  echo "[init] Creating Privy agentic wallet..."

  WALLET_RESPONSE="$(node -e "
const { PrivyClient } = require('@privy-io/node');
(async () => {
  const client = new PrivyClient({ appId: '${PRIVY_APP_ID}', appSecret: '${PRIVY_APP_SECRET}' });
  const { id, address, chain_type } = await client.wallets().create({ chain_type: 'ethereum' });
  console.log(JSON.stringify({ walletId: id, address: address }));
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)" || true

  if echo "$WALLET_RESPONSE" | jq -e '.walletId' > /dev/null 2>&1; then
    AGENT_WALLET_ID="$(echo "$WALLET_RESPONSE" | jq -r '.walletId')"
    AGENT_WALLET_ADDRESS="$(echo "$WALLET_RESPONSE" | jq -r '.address')"
    export AGENT_WALLET_ID
    export AGENT_WALLET_ADDRESS

    # Save credentials
    echo "$WALLET_RESPONSE" > "$PRIVY_CREDS_FILE"
    chmod 600 "$PRIVY_CREDS_FILE"

    echo "[init] Privy wallet created!"
    echo "[init]   Wallet ID: $AGENT_WALLET_ID"
    echo "[init]   Address:   $AGENT_WALLET_ADDRESS"
    echo "[init]   IMPORTANT: Fund wallet with USDC on Celo to enable lending"
  else
    echo "[init] WARNING: Privy wallet creation failed"
    echo "[init] Response: $WALLET_RESPONSE"
    echo "[init] Agent will boot without a wallet — set PRIVY_APP_ID and PRIVY_APP_SECRET"
  fi
else
  echo "[init] WARNING: No Privy credentials — agent cannot create a wallet"
  echo "[init] Set PRIVY_APP_ID and PRIVY_APP_SECRET in .env"
fi

# ── Render OpenClaw config from template on every boot ────────────────────
mkdir -p "$OPENCLAW_STATE_DIR"
envsubst < /app/custom/config/openclaw.template.json > "$OPENCLAW_STATE_DIR/openclaw.json"
echo "[init] Rendered openclaw.json from template"

# ── Sync workspace skills from image on every boot ───────────────────────
echo "[init] Syncing workspace skills from image..."
mkdir -p "$OPENCLAW_WORKSPACE_DIR"

# Remove old skills dir and copy fresh from image
rm -rf "$OPENCLAW_WORKSPACE_DIR/skills"
cp -r /app/custom/workspaces/agent/* "$OPENCLAW_WORKSPACE_DIR/"

# Render any templates in workspace files
for f in "$OPENCLAW_WORKSPACE_DIR"/*.md; do
  if [ -f "$f" ]; then
    envsubst < "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
done

echo "[init] Workspace synced at $OPENCLAW_WORKSPACE_DIR"

# ── Telegram channel ─────────────────────────────────────────────────────
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  export TELEGRAM_BOT_TOKEN

  TELEGRAM_ALLOWED_USERS="${TELEGRAM_ALLOWED_USERS:-}" \
  node <<'PATCH_EOF'
const fs = require("fs");
const configPath = process.env.OPENCLAW_STATE_DIR + "/openclaw.json";
if (!fs.existsSync(configPath)) process.exit(0);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.channels = config.channels || {};
config.channels.telegram = config.channels.telegram || {};
config.channels.telegram.enabled = true;

const users = (process.env.TELEGRAM_ALLOWED_USERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (users.length > 0) {
  config.channels.telegram.dmPolicy = "allowlist";
  config.channels.telegram.allowFrom = users;
  console.log("[init] Telegram: configured (allowlist mode, users: " + users.join(", ") + ")");
} else {
  config.channels.telegram.dmPolicy = "paired";
  config.channels.telegram.allowFrom = [];
  console.log("[init] Telegram: configured (pairing mode)");
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
PATCH_EOF
else
  echo "[init] Telegram: not configured (set TELEGRAM_BOT_TOKEN in .env)"
fi

echo "--------------------------------------------"
echo "[init] Agent:    $AGENT_NAME"
echo "[init] Wallet:   ${AGENT_WALLET_ADDRESS:-NOT created}"
echo "[init] Chain:    Celo ($CELO_RPC_URL)"
echo "[init] Telegram: $([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo 'configured' || echo 'not configured')"
echo "--------------------------------------------"

# ── Patch upstream entrypoint for single-container mode ──────────────────
ENTRYPOINT="/app/scripts/entrypoint.sh"
if [ -f "$ENTRYPOINT" ]; then
  sed -i '/# Browser sidecar proxy/,/^[[:space:]]*}$/d' "$ENTRYPOINT"
  echo "[init] Patched entrypoint (removed browser sidecar block)"
fi

echo "[init] Handing off to OpenClaw entrypoint..."
exec "$ENTRYPOINT"
