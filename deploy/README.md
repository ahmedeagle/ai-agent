# AWS Deployment Guide — AI Call Center

## Minimal Setup for Testing (Single EC2)

This runs **everything** on one EC2 instance using Docker Compose. Not production-grade, but perfect for testing.

---

### 1. Launch an EC2 Instance

| Setting | Value |
|---|---|
| **AMI** | Ubuntu 22.04 LTS |
| **Instance Type** | `t3.xlarge` (4 vCPU, 16 GB RAM) minimum |
| **Storage** | 50 GB gp3 |
| **Security Group** | Open ports: 22 (SSH), 80, 443, 3000, 3021, 15672 |
| **Key Pair** | Create or use existing `.pem` key |

> **Cheaper option**: `t3.large` (2 vCPU, 8 GB) works too if you skip Elasticsearch.

---

### 2. SSH into the Instance

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

### 3. Upload & Run Setup Script

```bash
# Option A: Clone from Git
git clone https://github.com/YOUR_REPO/AIAgent.git
cd AIAgent

# Option B: Upload from local with scp
scp -i your-key.pem -r ./AIAgent ubuntu@YOUR_EC2_PUBLIC_IP:~/

# Run server setup
chmod +x deploy/aws-setup.sh
./deploy/aws-setup.sh

# Log out and back in (for Docker group)
exit
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

### 4. Configure Environment

```bash
cd ~/AIAgent

# Copy the production env template
cp .env.production .env

# Edit and fill in your API keys
nano .env
```

**Minimum required keys for testing:**

| Key | Where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `JWT_SECRET` | Run: `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | `http://YOUR_EC2_PUBLIC_IP:3000` |
| `FRONTEND_URL` | `http://YOUR_EC2_PUBLIC_IP:3021` |

Optional (needed for specific features):
- `TWILIO_*` — voice calls
- `DEEPGRAM_API_KEY` — transcription
- `ELEVENLABS_API_KEY` — TTS
- `S3_*` — recording storage
- `SMTP_*` — email
- `WHATSAPP_*` — WhatsApp

---

### 5. Start Everything

```bash
chmod +x deploy/start.sh deploy/stop.sh

./deploy/start.sh
```

This will:
1. Build all 21 service Docker images
2. Start PostgreSQL, Redis, RabbitMQ, MongoDB
3. Run Prisma `db push` to create all tables
4. Start all application services + frontend

**First build takes ~5-10 minutes.** Subsequent starts are faster.

---

### 6. Access the Application

| Service | URL |
|---|---|
| **Frontend** | `http://YOUR_EC2_IP:3021` |
| **API Gateway** | `http://YOUR_EC2_IP:3000` |
| **RabbitMQ Dashboard** | `http://YOUR_EC2_IP:15672` (guest/guest) |

---

### Common Commands

```bash
# View all running services
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs (single service)
docker compose logs -f api-gateway

# Restart a single service after code change
docker compose build admin-service
docker compose up -d admin-service

# Stop everything
./deploy/stop.sh

# Reset database
docker compose down -v   # Removes volumes too
./deploy/start.sh

# Check resource usage
docker stats
```

---

### Costs Estimate

| Resource | Monthly Cost |
|---|---|
| t3.xlarge EC2 (on-demand) | ~$120 |
| t3.large EC2 (on-demand) | ~$60 |
| 50 GB gp3 EBS | ~$4 |
| **Total (testing)** | **~$64 - $124** |

> Use a **Spot Instance** to cut cost by 60-70% for testing.

---

### Troubleshooting

**Build fails with out of memory:**
- Use `t3.xlarge` or add more swap: `sudo fallocate -l 8G /swapfile`

**Services crash-looping:**
- Check logs: `docker compose logs service-name`
- Usually missing env vars — check `.env`

**Can't connect from browser:**
- Check EC2 Security Group allows inbound on 3000 and 3021
- Check `NEXT_PUBLIC_API_URL` in `.env` uses the public IP

**Database connection errors:**
- Wait for postgres to be healthy: `docker compose ps`
- Re-run migrations: `cd packages/database && npx prisma db push`
