#!/bin/bash
# Copy Claude Code conversation transcripts into the repo for hackathon submission.
# Run from repo root: ./conversations/sync.sh

CLAUDE_DIR="$HOME/.claude/projects/-Users-limone-Documents-builders-garden-synthesis-hack"
DEST="$(dirname "$0")"

if [ ! -d "$CLAUDE_DIR" ]; then
  echo "No conversations found at $CLAUDE_DIR"
  exit 1
fi

count=0
for f in "$CLAUDE_DIR"/*.jsonl; do
  [ -f "$f" ] || continue
  cp "$f" "$DEST/"
  count=$((count + 1))
done

echo "Synced $count conversation(s) to conversations/"
