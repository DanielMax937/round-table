#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8400}"
PID_FILE="${RT_PID_FILE:-./round-table.pid}"
LOG_FILE="${RT_LOG_FILE:-./round-table.log}"

# Check if port already in use
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT already in use. Stop the service first with: ./stop-bg.sh"
  exit 1
fi

echo "──────────────────────────────────────────"
echo "  Round Table (Next.js)"
echo ""
echo "  URL:      http://127.0.0.1:${PORT}"
echo "  Log file: $LOG_FILE"
echo "──────────────────────────────────────────"

# Disable Node.js 25+ experimental localStorage (causes localStorage.getItem is not a function)
export NODE_OPTIONS="${NODE_OPTIONS:-} --no-experimental-webstorage"
nohup npx next dev -p "$PORT" >> "$LOG_FILE" 2>&1 &
SERVICE_PID=$!
echo $SERVICE_PID > "$PID_FILE"

echo ""
echo "✓ Service started (PID: $SERVICE_PID)"
echo ""
echo "Commands:"
echo "  View logs:  tail -f $LOG_FILE"
echo "  Stop:      ./stop-bg.sh"
