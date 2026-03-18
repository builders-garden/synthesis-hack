#!/bin/bash
# Copy Claude Code conversation transcripts into the repo for hackathon submission.
# Run from repo root: ./conversations/sync.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Claude Code stores transcripts in ~/.claude/projects/<sanitized-cwd>/
# The sanitized path replaces / with -
SANITIZED="$(echo "$REPO_ROOT" | sed 's|^/||; s|/|-|g')"
CLAUDE_DIR="$HOME/.claude/projects/-${SANITIZED}"

DEST="$SCRIPT_DIR"

if [ ! -d "$CLAUDE_DIR" ]; then
  # Try without leading dash (varies by platform)
  CLAUDE_DIR="$HOME/.claude/projects/${SANITIZED}"
fi

if [ ! -d "$CLAUDE_DIR" ]; then
  echo "No conversations found for this repo"
  exit 0
fi

count=0
for f in "$CLAUDE_DIR"/*.jsonl; do
  [ -f "$f" ] || continue
  cp "$f" "$DEST/"
  count=$((count + 1))
done

echo "Synced $count conversation(s) to conversations/"
