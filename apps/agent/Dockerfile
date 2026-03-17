FROM coollabsio/openclaw:latest

RUN apk add --no-cache curl jq gettext

# Remove browser references (Railway single-container)
RUN if [ -f /app/scripts/entrypoint.sh ]; then \
      sed -i '/upstream browser/,/}/d' /app/scripts/entrypoint.sh 2>/dev/null || true; \
    fi

# Copy config template and init script
COPY config/ /app/custom/config/
COPY workspaces/ /app/custom/workspaces/
COPY openclaw-init.sh /app/custom/openclaw-init.sh
RUN chmod +x /app/custom/openclaw-init.sh

EXPOSE 8080 18789

ENTRYPOINT ["/app/custom/openclaw-init.sh"]
