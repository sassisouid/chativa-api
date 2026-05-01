# Chativa Email API

Node.js + Express email management service for chativa.pro.

## Prerequisites

- Node.js >= 18
- Redis (running on localhost:6379 or configured via REDIS_URL)
- A Brevo account with API key

## Installation

```bash
cd api
npm install
cp .env.example .env
# Edit .env with your actual values
```

## Create Admin User

```bash
node scripts/createAdmin.js <username> <password>
```

## Start (Development)

```bash
npm start
# or from project root:
npm run api:start
```

## Deploy to Linux VPS

### 1. Copy files to server

```bash
rsync -av --exclude node_modules --exclude .env --exclude uploads --exclude data \
  ./api/ user@your-server:/var/www/chativa-landing/api/
```

### 2. Install dependencies on server

```bash
cd /var/www/chativa-landing/api
npm install --omit=dev
```

### 3. Create .env on server

```bash
cp .env.example .env
nano .env  # fill in all required values
```

### 4. Create system user

```bash
sudo useradd --system --no-create-home --shell /bin/false chativa
sudo chown -R chativa:chativa /var/www/chativa-landing/api
```

### 5. Install systemd service

```bash
sudo cp chativa-email.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable chativa-email
sudo systemctl start chativa-email
sudo systemctl status chativa-email
```

### 6. View logs

```bash
journalctl -u chativa-email -f
journalctl -u chativa-email --since "1 hour ago" | grep '"level":"error"'
```

---

## DNS Configuration Checklist

Complete these steps in your DNS provider **before** sending the first production email.

### SPF Record

```
Type:  TXT
Name:  chativa.pro
Value: v=spf1 include:sendinblue.com ~all
TTL:   3600
```

### DKIM Record

1. Go to Brevo dashboard → **Senders & IPs → Domains** → Add `chativa.pro`
2. Copy the CNAME record provided by Brevo:

```
Type:  CNAME
Name:  mail._domainkey.chativa.pro
Value: mail._domainkey.chativa.pro.dkim.brevo.com.
TTL:   3600
```

3. Click **Verify** in Brevo dashboard
4. Set `DKIM_CONFIGURED=true` in your `.env`

### DMARC Record

```
Type:  TXT
Name:  _dmarc.chativa.pro
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@chativa.pro; ruf=mailto:dmarc@chativa.pro; pct=100; adkim=s; aspf=s
TTL:   3600
```

### Verify DNS Records

```bash
dig TXT chativa.pro +short
dig CNAME mail._domainkey.chativa.pro +short
dig TXT _dmarc.chativa.pro +short
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | None | Health check |
| POST | /api/contact | None (rate-limited) | Contact form |
| POST | /api/webhooks/brevo/inbound | HMAC | Inbound email webhook |
| POST | /api/admin/auth/login | None | Admin login |
| POST | /api/admin/auth/refresh | Cookie | Refresh access token |
| POST | /api/admin/auth/logout | JWT | Logout |
| GET | /api/admin/emails | JWT | List inbox |
| GET | /api/admin/emails/stats | JWT | Inbox stats |
| GET | /api/admin/emails/:id | JWT | Get email + thread |
| PATCH | /api/admin/emails/:id | JWT | Update email flags |
| DELETE | /api/admin/emails/:id | JWT | Soft delete |
| POST | /api/admin/emails/:id/reply | JWT | Reply to email |
| POST | /api/admin/emails/compose | JWT | Compose new email |
| GET | /api/admin/emails/:id/attachments/:aid | JWT | Download attachment |
