#!/usr/bin/env bash
# Verify MemOS API at http://localhost:9005 (round-table uses MEMOS_BASE_URL)
# Run from round-table root: ./scripts/verify-memos-api.sh

set -e
BASE_URL="${MEMOS_BASE_URL:-http://localhost:9005}"
BASE_URL="${BASE_URL%/}"

echo "=== MemOS API 验证 (${BASE_URL}) ==="
echo ""

# 1. Health / docs
echo "1. GET /docs (API 文档)"
if curl -sf --connect-timeout 5 --max-time 10 "${BASE_URL}/docs" > /dev/null; then
  echo "   ✓"
else
  echo "   ✗ 连接失败"
  exit 1
fi

# 2. POST /product/search
echo "2. POST /product/search"
SEARCH_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/product/search" \
  -H 'Content-Type: application/json' \
  -d '{"query":"test","user_id":"tester","readable_cube_ids":["movie1"]}' 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$SEARCH_RESP" | tail -1)
BODY=$(echo "$SEARCH_RESP" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✓ HTTP ${HTTP_CODE}"
  echo "   Response: $(echo "$BODY" | head -c 200)..."
else
  echo "   ✗ HTTP ${HTTP_CODE}"
fi

# 3. POST /product/add
echo "3. POST /product/add"
ADD_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/product/add" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"tester","writable_cube_ids":["movie1"],"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"}],"async_mode":"sync"}' 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$ADD_RESP" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✓ HTTP ${HTTP_CODE}"
else
  echo "   ✗ HTTP ${HTTP_CODE}"
fi

echo ""
echo "=== 验证完成 ==="
