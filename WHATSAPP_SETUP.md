# WhatsApp Business API - Free Setup Guide

## 🆓 Free WhatsApp Business API from Meta

Meta provides a **FREE tier** for WhatsApp Business API with:
- ✅ 1,000 free conversations per month
- ✅ Full API access
- ✅ No credit card required initially

---

## Step 1: Create Meta Developer Account

1. Go to: https://developers.facebook.com
2. **Click "Get Started"** (top right)
3. Sign up with your Facebook account
4. Verify your email address

---

## Step 2: Create a WhatsApp Business App

1. Go to: https://developers.facebook.com/apps
2. Click **"Create App"**
3. Select **"Business"** type
4. Fill in app details:
   - App Name: `AI Call Center WhatsApp`
   - Contact Email: Your email
5. Click **"Create App"**

---

## Step 3: Add WhatsApp Product

1. In your new app dashboard, scroll to **"Add Products"**
2. Find **"WhatsApp"** and click **"Set Up"**
3. Select **"Business Account"** (create one if needed)
4. Follow the setup wizard

---

## Step 4: Get Test Number (FREE)

Meta provides a **FREE test phone number** for development:

1. In WhatsApp Product page, go to **"API Setup"**
2. You'll see a section: **"From"** with a test phone number
   - Format: `+1 555 XXX XXXX` (US test number)
   - This is FREE and ready to use immediately!
3. **Important:** Copy these values:
   - **Phone Number ID** (looks like: `123456789012345`)
   - **WhatsApp Business Account ID**

---

## Step 5: Get Access Token

1. In the same **"API Setup"** page
2. Find **"Temporary access token"** section
3. Click **"Generate Token"**
4. Copy the token (starts with `EAAE...`)
5. ⚠️ **Note:** Temporary tokens expire in 24 hours
   - For production, you'll create a permanent token later

---

## Step 6: Add Test Recipients

You can only send messages to **verified test numbers**:

1. In WhatsApp Product page, go to **"API Setup"**
2. Find **"To"** section
3. Click **"Manage phone number list"**
4. Add your personal WhatsApp number:
   - Enter your phone number (with country code)
   - WhatsApp will send you a verification code
   - Enter the code to verify
5. You can add up to 5 test numbers for free

---

## Step 7: Configure Webhook (for Incoming Messages)

1. In WhatsApp Product page, go to **"Configuration"**
2. Click **"Edit"** under Webhook
3. Enter your webhook URL:
   ```
   https://YOUR_DOMAIN/api/whatsapp/webhook
   ```
   Or with EC2:
   ```
   http://54.175.5.216:3000/api/whatsapp/webhook
   ```
4. **Verify Token**: Create a random string (e.g., `my-secret-token-12345`)
5. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_status`
6. Click **"Verify and Save"**

---

## Step 8: Get Permanent Access Token (Optional)

For production use beyond 24 hours:

1. Go to **"App Settings"** → **"Basic"**
2. Copy your **"App ID"** and **"App Secret"**
3. Generate a permanent token using Graph API Explorer:
   - Go to: https://developers.facebook.com/tools/explorer/
   - Select your app
   - Get **Page Access Token** with permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
4. Save this token securely

---

## Step 9: Update Server Environment Variables

SSH into your EC2 server and update `.env`:

```bash
ssh -i your-key.pem ubuntu@54.175.5.216
cd /home/ubuntu/ai-agent
nano .env
```

Add/update these lines:
```env
# WhatsApp Business API (Meta Cloud API)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_ID=YOUR_PHONE_NUMBER_ID_HERE
WHATSAPP_TOKEN=YOUR_ACCESS_TOKEN_HERE
WHATSAPP_VERIFY_TOKEN=my-secret-token-12345
```

Save and restart services:
```bash
docker compose restart whatsapp-service
```

---

## Step 10: Test WhatsApp Integration

### Test Sending a Message:

```bash
curl -X POST http://54.175.5.216:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "companyId": "default-company",
    "to": "+1234567890",
    "message": "Hello from AI Call Center! 👋"
  }'
```

### Test Receiving Messages:

1. Send a WhatsApp message to your test number
2. The webhook will receive it automatically
3. Check logs: `docker logs ai-agent-whatsapp-service-1 -f`

---

## 📊 Free Tier Limits

Meta's free tier includes:
- ✅ **1,000 conversations/month** (FREE)
- ✅ Unlimited incoming messages
- ✅ Test numbers can message verified recipients
- After 1,000: **$0.005 - $0.09 per conversation** (varies by country)

---

## 🎯 Next Steps for Production

When ready to go live:

1. **Business Verification:**
   - Verify your business with Meta
   - Takes 1-2 weeks
   - Required for production use

2. **Get Your Own Number:**
   - Port existing WhatsApp Business number
   - Or request a new number from Meta
   - Requires business verification

3. **Set Up Payment:**
   - Add credit card for usage beyond free tier
   - Set spending limits

4. **Configure Company Credentials:**
   - Add credentials per company in the database:
   ```sql
   UPDATE companies 
   SET 
     "whatsappPhoneId" = 'your-phone-id',
     "whatsappToken" = 'your-token',
     "whatsappNumber" = '+1234567890'
   WHERE id = 'your-company-id';
   ```

---

## 🔒 Security Best Practices

1. **Never commit tokens to Git**
2. Store tokens in environment variables only
3. Use different tokens for dev/staging/production
4. Rotate tokens periodically
5. Use HTTPS for webhooks in production
6. Validate webhook signatures (implemented in service)

---

## 🐛 Troubleshooting

**Messages not sending:**
- Check if recipient is verified (test mode)
- Verify token hasn't expired
- Check phone number format (E.164: +1234567890)

**Webhook not receiving:**
- Verify webhook URL is publicly accessible
- Check verify token matches
- Ensure subscribed to message fields

**403 Forbidden:**
- Token expired or invalid
- Regenerate access token

---

## 📚 Useful Links

- Meta Developers: https://developers.facebook.com
- WhatsApp Business API Docs: https://developers.facebook.com/docs/whatsapp
- Pricing: https://developers.facebook.com/docs/whatsapp/pricing
- Get Help: https://developers.facebook.com/support/

---

## ✅ Quick Checklist

- [ ] Created Meta Developer account
- [ ] Created WhatsApp Business App
- [ ] Got Phone Number ID
- [ ] Got Access Token (temporary or permanent)
- [ ] Added test recipient numbers
- [ ] Configured webhook URL and verify token
- [ ] Updated .env on server
- [ ] Restarted whatsapp-service
- [ ] Tested sending a message
- [ ] Tested receiving a message

---

**🎉 You're ready to use WhatsApp with your AI Call Center!**
