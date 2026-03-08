#!/bin/bash
cd /home/ubuntu/ai-agent

# Login and get token
RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin123"}')
echo "LOGIN RESP: $RESP"
TOKEN=$(echo $RESP | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('data',{}).get('token','') or d.get('token',''))")
echo "TOKEN=$TOKEN"

echo "---QUEUE---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/queue/default-company/status
echo ""

echo "---BILLING---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/billing/packages/default-company
echo ""

echo "---MONITOR---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/monitor/dashboard/default-company
echo ""

echo "---KPI---"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/analytics/kpi/summary?company_id=default-company"
echo ""

echo "---AUDIT---"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/audit-log?companyId=default-company"
echo ""

echo "---CONTACTS---"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/contact?companyId=default-company"
echo ""
