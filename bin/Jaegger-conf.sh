#!/bin/bash
# Jaeger all-in-one starter for the mnemonica dev loop.
# Mounts tools/jaeger-v2.yaml (collector config, AI MCP endpoint on :16686)
# and tools/jaeger-ui.json (UI link patterns: span tags → vscode:// jumps
# into files and into the mnemographica Live Trace sidebar).
#
# Idempotent: an existing jaeger-mnem container is replaced.
# Run via: npm run jaegger:pre-configured

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$(dirname "$SCRIPT_DIR")/tools"

if ! command -v docker >/dev/null 2>&1; then
	echo "docker not found in PATH — install docker or run the command from tools/jaeger-v2.yaml manually" >&2
	exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -qx 'jaeger-mnem'; then
	echo "removing existing jaeger-mnem container"
	docker rm -f jaeger-mnem >/dev/null
fi

docker run -d --name jaeger-mnem \
	-p 16686:16686 -p 4318:4318 \
	-v "$TOOLS_DIR/jaeger-v2.yaml:/etc/jaeger/config.yaml" \
	-v "$TOOLS_DIR/jaeger-ui.json:/etc/jaeger/ui.json" \
	jaegertracing/jaeger:latest --config /etc/jaeger/config.yaml

echo "jaeger-mnem up: UI + AI MCP on http://localhost:16686, OTLP HTTP on :4318"
