#!/bin/bash
echo "=== Calls in DB ==="
curl -s "http://localhost:3004/call?companyId=default-company&limit=20" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
calls = d.get('data', {}).get('calls', [])
print(f'Total calls in DB: {d.get(\"data\",{}).get(\"total\",len(calls))}')
for c in calls[:10]:
    print(f'  {c.get(\"callSid\",\"?\")[:25]} status={c.get(\"status\")} dir={c.get(\"direction\")} dur={c.get(\"duration\")}')
"

echo ""
echo "=== KPI Summary (direct) ==="
curl -s "http://localhost:8001/kpi/summary?company_id=default-company" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(json.dumps(d, indent=2))
"

echo ""
echo "=== KPI Summary (via gateway, no auth) ==="
curl -s "http://localhost:3000/api/analytics/kpi/summary?company_id=default-company" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(json.dumps(d, indent=2))
"

echo ""
echo "=== KPI Summary (via gateway, with auth) ==="
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@admin.com","password":"admin123"}' | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/analytics/kpi/summary?company_id=default-company" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(json.dumps(d, indent=2))
"

echo ""
echo "=== Calls analytics (via gateway, with auth) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/analytics/calls?company_id=default-company&time_range=7d" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(json.dumps(d, indent=2)[:500])
"
