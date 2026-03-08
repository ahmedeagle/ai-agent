#!/bin/bash
# Test login and check if companyId is in the response
echo "=== LOGIN ==="
RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin123"}')

echo "$RESP" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
user = d.get('data', {}).get('user', {})
print('User object stored in localStorage:')
print(json.dumps(user, indent=2))
print()
print(f\"companyId present: {'companyId' in user}\")
print(f\"companyId value: {user.get('companyId', 'MISSING!')}\")
"

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")

echo ""
echo "=== KPI via Gateway ==="
KPI=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/analytics/kpi/summary?company_id=default-company")
echo "$KPI" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
overview = d.get('data', {}).get('overview', {})
print(f\"totalCalls: {overview.get('totalCalls')}\")
print(f\"inboundCalls: {overview.get('inboundCalls')}\")
print(f\"outboundCalls: {overview.get('outboundCalls')}\")
print(f\"completedCalls: {overview.get('completedCalls')}\")
print(f\"successRate: {overview.get('successRate')}\")
print(f\"averageDuration: {overview.get('averageDuration')}\")
"

echo ""
echo "=== Agent systemPrompt length ==="
curl -s http://localhost:3004/agent/e3970bee-c137-483d-8a74-299067a8e383 | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
a = d.get('data', {})
print(f\"Name: {a.get('name')}\")
print(f\"Prompt length: {len(a.get('systemPrompt', ''))} chars\")
print(f\"First 120 chars: {a.get('systemPrompt', '')[:120]}\")
"
