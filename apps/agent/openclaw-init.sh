#!/bin/sh
set -e

# Defaults
export AGENT_NAME="${AGENT_NAME:-yield-agent}"
export VENICE_MODEL="${VENICE_MODEL:-venice/llama-3.3-70b}"
export VENICE_API_KEY="${VENICE_API_KEY:-}"
export LOCUS_API_KEY="${LOCUS_API_KEY:-}"
export SETUP_PASSWORD="${SETUP_PASSWORD:-changeme}"
export AUTH_PASSWORD="${SETUP_PASSWORD}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
export OPENCLAW_WORKSPACE_DIR="/data/workspace-agent"

CONFIG_DIR="${OPENCLAW_STATE_DIR}"
CONFIG_FILE="${CONFIG_DIR}/openclaw.json"

# Generate config on first boot
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[init] First boot — generating config..."
  mkdir -p "$CONFIG_DIR"
  envsubst < /app/custom/config/openclaw.template.json > "$CONFIG_FILE"
  echo "[init] Config written to $CONFIG_FILE"
fi

# Copy workspace files (only on first boot)
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
fi

# Write Locus credentials
if [ -n "$LOCUS_API_KEY" ]; then
  echo "[init] Configuring Locus credentials..."
  for dir in /root/.config/locus /home/node/.config/locus /data/.config/locus; do
    mkdir -p "$dir"
    cat > "$dir/credentials.json" <<EOF
{
  "api_key": "$LOCUS_API_KEY",
  "api_base": "https://beta-api.paywithlocus.com/api"
}
EOF
  done
fi

# Patch nginx to remove browser references (Railway compatibility)
if [ -f /etc/nginx/conf.d/openclaw.conf ]; then
  echo "[init] Patching nginx config..."
  sed -i '/upstream browser/,/}/d' /etc/nginx/conf.d/openclaw.conf 2>/dev/null || true
  sed -i '/location.*\/browser\//,/}/d' /etc/nginx/conf.d/openclaw.conf 2>/dev/null || true
  sed -i '/proxy_pass.*browser/d' /etc/nginx/conf.d/openclaw.conf 2>/dev/null || true
fi

echo "[init] Starting OpenClaw gateway..."
echo "[init] Agent: $AGENT_NAME"
echo "[init] Model: $VENICE_MODEL"
echo "[init] Locus: $([ -n "$LOCUS_API_KEY" ] && echo 'configured' || echo 'not configured')"

# Hand off to OpenClaw's entrypoint
exec /app/scripts/entrypoint.sh
