FROM coollabsio/openclaw:latest

# Install utilities (Debian-based image)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      curl jq gettext-base openssl && \
    rm -rf /var/lib/apt/lists/*

# Install Privy + permissionless.js deps to a fixed location
# (base image redirects npm global to /data at runtime, so we install locally)
RUN mkdir -p /app/custom/node_modules && \
    cd /app/custom && npm install @privy-io/node permissionless@0.2.57 viem
ENV NODE_PATH="/app/custom/node_modules"

# Copy config template and init script
COPY config/ /app/custom/config/
COPY workspaces/ /app/custom/workspaces/
COPY openclaw-init.sh /app/custom/openclaw-init.sh
RUN chmod +x /app/custom/openclaw-init.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/custom/openclaw-init.sh"]
