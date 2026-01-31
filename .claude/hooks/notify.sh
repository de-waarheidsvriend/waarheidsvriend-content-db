#!/bin/bash
NTFY_URL="https://ntfy-jwwwcck4o8wcw00c0okkc8s0.vanschiesoftware.nl/claude"
PROJECT=$(basename "$PWD")
CLICK_URL="ssh://joostvanschie@192.168.0.251"

curl -s "$NTFY_URL" \
  -H "Title: Claude - $PROJECT" \
  -H "Click: $CLICK_URL" \
  -H "Priority: high" \
  -d "Waiting for your input"
