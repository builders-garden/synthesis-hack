# Session: Local Docker Setup for OpenClaw Agent
**Date:** 2026-03-17 (16:50–17:10 UTC)

## What happened

Implemented the local Docker setup plan from the previous session. Got the OpenClaw agent container building and running end-to-end with zero manual configuration.

### Dockerfile fixes
- Base image (`coollabsio/openclaw:latest`) is Debian, not Alpine — changed `apk` to `apt-get`.
- Added `openssl`, `jq`, `gettext-base` as build dependencies.
- Added Docker HEALTHCHECK against `/healthz`.
- Removed unused port 18789 from docker-compose (only nginx on 8080 exposed).

### Locus self-registration at boot
- If no `LOCUS_API_KEY` is set, the init script calls `POST https://beta-api.paywithlocus.com/api/register` to self-register.
- Gets back: API key (`claw_dev_*`), wallet address, private key, claim URL.
- Polls `/api/status` until wallet status is `deployed`.
- Saves credentials to `/data/.locus-credentials.json` (persisted on Docker volume, reused on restart).
- Claim URL printed in logs for funding the wallet with USDC on Base.

### Inference bootstrap (chicken-and-egg solved)
- Problem: agent needs inference to reason, but has no Venice key yet.
- Solution: Locus-wrapped OpenAI as boot provider.
  - Sets `OPENAI_API_KEY=$LOCUS_API_KEY` and `OPENAI_BASE_URL=https://beta-api.paywithlocus.com/api/wrapped/openai`.
  - OpenClaw auto-detects this as OpenAI provider and boots with `openai/gpt-5.2`.
- Once running, the bootstrap skill can execute the Venice autonomous key flow to switch to private inference.

### Venice autonomous key flow (corrected from docs)
- Checked actual docs at `https://docs.venice.ai/overview/guides/generating-api-key-agent`.
- Previous version had made-up endpoints — all corrected:
  - **Endpoint:** `https://api.venice.ai/api/v1/api_keys/generate_web3_key` (GET for token, POST for key)
  - **VVV token (Base):** `0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf`
  - **Staking contract (Base):** `0x321b7ff75154472b18edb199033ff4d116f340ff`
  - **Key format:** `vapi_xxxxxxxxxxxx`
- VVV staking is optional (for Diem allocation) — basic key works with just wallet signature.

### Browser sidecar fix
- Upstream entrypoint generates nginx config with a `browser` upstream block (for VNC sidecar).
- No browser container in single-container mode → nginx fails to start.
- Fix: `sed` removes the browser block from the entrypoint before exec.

## Files changed
- `apps/agent/Dockerfile` — Debian packages, healthcheck
- `apps/agent/docker-compose.yml` — removed port 18789
- `apps/agent/openclaw-init.sh` — Locus self-registration, Locus-wrapped OpenAI as boot provider, browser block patch
- `apps/agent/workspaces/agent/skills/bootstrap/SKILL.md` — real Venice autonomous flow with correct endpoints/addresses
- `apps/agent/.env` / `.env.example` — updated comments, all keys optional
- `apps/agent/conversations/` — created for archiving sessions

## Verification
- `docker compose build` — succeeds
- `docker compose up` — self-registers with Locus, wallet deploys, gateway starts
- Container reaches `healthy` status
- OpenClaw UI accessible at `localhost:8080` (auth: `admin`/`localdev`)
- Gateway running on `openai/gpt-5.2` via Locus-wrapped OpenAI

## Open items
- Fund the Locus wallet with USDC on Base to enable actual payments
- Run the bootstrap skill to acquire a Venice API key
- Wire agent to the dashboard (deferred)
