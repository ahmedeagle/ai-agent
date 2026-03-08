#!/bin/bash
echo "=== Checking for localhost:3000 in built frontend ==="
docker exec ai-agent-frontend-1 sh -c "grep -rl 'localhost:3000' .next/static/ 2>/dev/null | head -5"
echo "---"
echo "=== Checking for 54.146 in built frontend ==="
docker exec ai-agent-frontend-1 sh -c "grep -rl '54.146' .next/static/ 2>/dev/null | head -5"
echo "---"
echo "=== Checking server.js ==="
docker exec ai-agent-frontend-1 sh -c "grep -o 'http://[^\"]*3000[^\"]*' server.js 2>/dev/null | head -5"
