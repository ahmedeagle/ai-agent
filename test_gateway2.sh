#!/bin/bash
cd /home/ubuntu/ai-agent

# Login and get token
RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin123"}')
TOKEN=$(echo $RESP | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('data',{}).get('token','') or d.get('token',''))")
echo "TOKEN obtained: ${TOKEN:0:20}..."

echo ""
echo "=== AUDIT LOG (GET /api/admin/audit-log/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/audit-log/default-company"
echo ""

echo ""
echo "=== CONTACTS (GET /api/admin/customer/company/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/customer/company/default-company?limit=10"
echo ""

echo ""
echo "=== CREATE CONTACT (POST /api/admin/customer) ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "http://localhost:3000/api/admin/customer" \
  -d '{"firstName":"Test","lastName":"User","phone":"+1234567890","email":"test@test.com","companyId":"default-company"}'
echo ""

echo ""
echo "=== AUDIT LOG STATS (GET /api/admin/audit-log/default-company/stats) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/audit-log/default-company/stats"
echo ""

echo ""
echo "=== SMS (GET /api/sms/messages/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/sms/messages/default-company"
echo ""

echo ""
echo "=== WHATSAPP (GET /api/whatsapp/conversations/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/whatsapp/conversations/default-company"
echo ""

echo ""
echo "=== EMAIL (GET /api/email/history/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/email/history/default-company"
echo ""

echo ""
echo "=== CAMPAIGNS (GET /api/campaigns/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/campaigns/default-company"
echo ""

echo ""
echo "=== SURVEYS (GET /api/surveys/default-company) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/surveys/default-company"
echo ""
