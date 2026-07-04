# Bootstrapped Cost Optimization Guide
## Self-Hosted Infrastructure on Coolify

**Created:** February 9, 2026  
**Updated:** February 9, 2026 (Zambian market context)  
**Target:** Zero to minimal monthly costs during early stage  
**Geography:** Optimized for Zambian fintech startup  
**Philosophy:** Pay only for what you use, self-host everything possible

> **🇿🇲 Zambian Context:** This guide includes Zambian-specific payment (Flutterwave, mobile money) and communication recommendations. See `ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE.md` for detailed analysis.

---

## Cost Analysis: Paid vs Self-Hosted

### ❌ Common SaaS Costs (What We're Avoiding)
```
Vercel/Netlify Pro: $20-40/month
Heroku/Railway: $50-200/month
Render.com: $30-100/month
Sentry: $26-80/month
Datadog/New Relic: $100-500/month
LogDNA/Papertrail: $50-200/month
PagerDuty: $29-79/user/month
Status Page: $29-99/month
TestRail/Testiny: $35-99/month

Total Avoided: $300-1,500/month
```

### ✅ Bootstrapped Stack (Self-Hosted on Coolify)
```
VPS (Hetzner/Contabo - 8GB RAM, 4 vCPU): $10-25/month
Domain + SSL (Cloudflare): $10-15/year
Email (SendGrid Free Tier): $0/month (100 emails/day)
SMS (pay-per-use): ~$0.01-0.02 per SMS
Payment Gateway (Stripe): 2.9% + $0.30 per transaction

Total Fixed Cost: $10-30/month
Variable Costs: Only when you have users/revenue
```

**Savings: ~$270-1,470/month or $3,240-17,640/year**

---

## Self-Hosted Services on Coolify

### 1. Testing Infrastructure (Your TestSprite Alternative)

#### Option A: Complete CI/CD Testing Platform (Recommended)
**Self-Hosted Components:**

```yaml
# Testing Platform Architecture
services:
  # 1. GitHub Actions Self-Hosted Runner
  github-runner:
    image: myoung34/github-runner:latest
    environment:
      - RUNNER_SCOPE=repo
      - RUNNER_NAME=coolify-runner
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    # Cost: $0 (runs on your Coolify VPS)
    # Capabilities: Run all CI/CD tests

  # 2. Test Result Dashboard (Allure or ReportPortal)
  allure-ui:
    image: frankescobar/allure-docker-service
    ports:
      - "5050:5050"
    volumes:
      - allure-results:/app/allure-results
      - allure-reports:/app/default-reports
    # Cost: $0
    # Alternative: ReportPortal (more feature-rich)

  # 3. Visual Regression Testing
  percy-agent:
    # Use open-source alternatives
    image: backstopjs/backstopjs
    # Or: Argos CI (self-hosted)
    # Cost: $0

  # 4. Load Testing Platform
  k6-runner:
    image: grafana/k6:latest
    # Run scheduled load tests
    # Cost: $0

  # 5. Test Coverage Reporter
  codecov-alternative:
    # Use SonarQube Community Edition
    image: sonarqube:community
    ports:
      - "9000:9000"
    # Cost: $0
```

**Key Features You Get:**
- ✅ Automated test execution on every push
- ✅ Test result visualization and history
- ✅ Code coverage tracking and trends
- ✅ Visual regression detection
- ✅ Load testing automation
- ✅ Security scanning (OWASP ZAP, Trivy)
- ✅ Reusable across all your future projects

**Setup Time:** 4-6 hours  
**Monthly Cost:** $0 (uses existing Coolify VPS)  
**Comparable SaaS:** TestSprite ($49/month), Cypress Dashboard ($75/month)

#### Option B: Lightweight Testing (Minimal Setup)
If you want to start even simpler:

```bash
# Just use GitHub Actions with free tier
# 2,000 minutes/month free for private repos
# Run tests in GitHub's cloud runners

# Store results in repository
# Use GitHub Pages for test reports (free)

# Total cost: $0
# Limitation: Limited to GitHub's runners
```

#### Recommended: Hybrid Approach
```yaml
Critical Tests: 
  - Run on GitHub Actions (free tier)
  - Fast feedback on PRs

Heavy Tests (E2E, Load):
  - Schedule on self-hosted Coolify runner
  - Run overnight or on-demand
  - No minute limits

Results:
  - Store in Allure on Coolify
  - Accessible via subdomain (tests.ndalamahub.com)
```

---

### 2. Monitoring Stack (100% Self-Hosted)

```yaml
# Complete Observability Stack on Coolify
services:
  # Metrics Collection
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - prometheus-data:/prometheus
    # Cost: $0

  # Metrics Visualization
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
    # Cost: $0
    # Pre-built dashboards available

  # Log Aggregation
  loki:
    image: grafana/loki:latest
    volumes:
      - loki-data:/loki
    # Cost: $0
    # Alternative: Graylog

  # Log Shipper (from containers)
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers
    # Cost: $0

  # Uptime Monitoring
  uptime-kuma:
    image: louislam/uptime-kuma:1
    volumes:
      - uptime-kuma-data:/app/data
    # Cost: $0
    # Built-in status page!

  # Error Tracking (Sentry Alternative)
  glitchtip:
    image: glitchtip/glitchtip
    environment:
      - DATABASE_URL=postgres://...
    # Cost: $0
    # 100% Sentry-compatible API

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
  uptime-kuma-data:
```

**What You Get:**
- ✅ Real-time metrics and dashboards
- ✅ Log aggregation and search
- ✅ Error tracking with stack traces
- ✅ Uptime monitoring with status page
- ✅ Alerting (email, Slack, Discord, webhook)

**Setup Time:** 6-8 hours  
**Monthly Cost:** $0 (included in VPS)  
**Comparable SaaS:** Datadog ($100-500/month), Sentry ($26+/month)

---

### 3. API Documentation (Self-Hosted)

```yaml
# Swagger UI + ReDoc
swagger-ui:
  image: swaggerapi/swagger-ui
  environment:
    - SWAGGER_JSON_URL=https://api.ndalamahub.com/openapi.json
  # Cost: $0

# Alternative: Redocly
redoc:
  image: redocly/redoc
  # Cost: $0
  # Prettier than Swagger UI

# Or: Scalar API Reference (modern, beautiful)
scalar:
  image: scalar/api-reference
  # Cost: $0
  # Best-in-class UI
```

**Setup Time:** 1-2 hours  
**Monthly Cost:** $0  
**Comparable SaaS:** Readme.io ($99/month), SwaggerHub ($75/month)

---

### 4. Database Backups (Self-Hosted)

```yaml
# Automated MongoDB Backups
mongodb-backup:
  image: tiredofit/mongodb-backup
  environment:
    - DB_HOST=mongodb
    - DB_NAME=ndalamahub
    - DB_BACKUP_INTERVAL=1440 # Daily
    - DB_CLEANUP_TIME=2592000 # Keep 30 days
  volumes:
    - /backups:/backup
  # Cost: $0 (use VPS disk or Hetzner Storage Box $3-5/month for 1TB)

# Alternative: Use MongoDB Atlas Free Tier
# M0 cluster: 512MB storage, automated backups
# Cost: $0
# Upgrade when you need more
```

**Setup Time:** 1-2 hours  
**Monthly Cost:** $0-5 (depending on backup storage)  
**Comparable SaaS:** MongoDB Atlas ($57/month for M10)

---

### Email Service (Recommended for Zambian Startup)

**Option A: Free Tier Strategy (RECOMMENDED)**
```yaml
SendGrid:
  free_tier: 100 emails/day (3,000/month)
  cost: $0
  use_case: "Authentication (magic links), notifications, payment reminders"
  zambia_support: "Full global coverage"
  
Mailgun:
  free_tier: 1,000 emails/month
  cost: $0
  
Brevo (formerly Sendinblue):
  free_tier: 300 emails/day (9,000/month)
  cost: $0
  use_case: "Marketing emails, newsletters"

Strategy:
  - Use SendGrid for transactional (password reset, notifications)
  - Use Brevo for marketing (announcements, newsletters)
  - Total: 12,000 free emails/month
```

**Option B: Self-Hosted (Not Recommended)**
```yaml
# Possible but complex
services:
  postal:
    image: postal/postal
    # Issues: Deliverability, IP reputation, spam filters
    # Only consider if sending >50,000 emails/month
```

**Recommendation:** Use free tiers, they're designed for startups

---

### 6. SMS Notifications

**Pay-Per-Use Strategy (No Fixed Costs)**
```yaml
Africa's Talking:
  cost: ~$0.01 per SMS (Kenya, Uganda, etc.)
  no_monthly_fee: true
  use_case: "Loan notifications, MFA codes"

Twilio:
  cost: $0.0079 per SMS (US)
  cost: ~$0.045 per SMS (Africa)
  no_monthly_fee: true
  
Strategy:
  - Only send critical SMS (loan approved, payment due)
  - Email for non-urgent notifications
  - Estimated: 100 SMS/month = $1-4/month
```

**Monthly Cost:** $0 fixed, ~$1-10 variable

---

### 7. Payment Gateway (Zambian Context)

**Bootstrapped Strategy for Zambia:**
```yaml
Flutterwave (Recommended):
  zambia_support: YES
  setup_fee: $0
  monthly_fee: $0
  transaction_fees:
    - Mobile Money (Airtel, MTN): 2%
    - Bank Transfer: 1.4%
    - Cards: 3.8%
  features:
    - Test mode (unlimited free testing)
    - Webhook support
    - Recurring billing (loan repayments)
    - Dashboard analytics
    - Multi-currency (ZMW, USD, EUR)
  settlement:
    - Daily to Zambian banks
    - T+1 settlement
  
Stripe:
  zambia_support: NO
  status: Not available in Zambia
  note: Only works in South Africa, Nigeria, Kenya, Ghana
  
Flutterwave (Africa):
  setup_fee: $0
  monthly_fee: $0
  transaction_fee: 3.8% (NGN), 3.5% (KES)
  
Paystack (Africa):
  setup_fee: $0
  monthly_fee: $0
  transaction_fee: 1.5% + ₦100 (capped)

Strategy:
  - Start with test mode (free)
  - Only pay when you have revenue
  - Fees come from transaction value
```

**Monthly Cost:** $0 until you have revenue

---

### 8. CDN & Asset Delivery

**Free CDN Options:**
```yaml
Cloudflare:
  free_tier:
    - Unlimited bandwidth
    - Global CDN
    - DDoS protection
    - SSL certificates
    - Page rules (3 free)
  cost: $0
  recommended: Yes

BunnyCDN:
  cost: $1/month minimum
  pricing: $0.01/GB (after first 1GB free)
  features: Better performance than Cloudflare
  use_when: Serving lots of large files

Strategy:
  - Start with Cloudflare (free)
  - Switch to BunnyCDN if you need better performance
```

**Monthly Cost:** $0-1

---

## Complete Bootstrapped Infrastructure Setup

### Coolify VPS Requirements

**Minimum (Development):**
- 2 vCPU, 4GB RAM, 80GB SSD
- Cost: $5-10/month (Contabo, Hetzner)
- Suitable for: Staging environment only

**Recommended (Production-Ready):**
- 4 vCPU, 8GB RAM, 160GB SSD
- Cost: $15-25/month (Hetzner, Vultr)
- Can run: App + MongoDB + Redis + Monitoring + Testing

**Scaling Path:**
- 8 vCPU, 16GB RAM, 320GB SSD: $30-50/month
- Or add a second VPS for database: $10-20/month

### Services to Run on Coolify

```yaml
# docker-compose.yml for complete stack
version: '3.8'

services:
  # Your Application
  app:
    build: ./server
    depends_on:
      - mongodb
      - redis

  # Frontend
  frontend:
    build: ./client
    depends_on:
      - app

  # Databases
  mongodb:
    image: mongo:7
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  # Monitoring Stack
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - prometheus-data:/prometheus

  loki:
    image: grafana/loki:latest
    volumes:
      - loki-data:/loki

  # Error Tracking
  glitchtip:
    image: glitchtip/glitchtip
    environment:
      - DATABASE_URL=postgres://...

  # Uptime Monitoring
  uptime-kuma:
    image: louislam/uptime-kuma:1
    volumes:
      - uptime-kuma:/app/data

  # Backups
  mongodb-backup:
    image: tiredofit/mongodb-backup
    volumes:
      - ./backups:/backup

  # Testing (Optional - can run separately)
  github-runner:
    image: myoung34/github-runner:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  mongo-data:
  redis-data:
  grafana-data:
  prometheus-data:
  loki-data:
  uptime-kuma:
```

---

## Bootstrapped Cost Breakdown

### Year 1 Costs (Assuming 100 users)

```
Fixed Costs:
  VPS (8GB RAM): $20/month = $240/year
  Domain: $15/year
  Backup Storage (optional): $5/month = $60/year
  Total Fixed: $315/year

Variable Costs:
  Email (if exceed free tier): $0-15/month = $0-180/year
  SMS (100/month): $1-4/month = $12-48/year
  Payment Processing: 3% of revenue (only when you have it)
  Total Variable: $12-228/year

Grand Total: $327-543/year (~$27-45/month)

Compare to SaaS: $3,600-18,000/year
Savings: $3,000-17,500/year (93% cost reduction)
```

### Scaling Thresholds

**When to upgrade VPS ($20 → $50/month):**
- 500+ concurrent users
- 1M+ API requests/month
- 100GB+ database size

**When to consider managed services:**
- $10k+ MRR: Consider managed MongoDB Atlas ($57/month)
- $50k+ MRR: Consider upgrading monitoring (still likely overkill)
- $100k+ MRR: Consider enterprise support contracts

**Philosophy:** Self-host until costs are <5% of revenue

---

## Implementation Priority for Bootstrapped Startup

### Week 1: Essential Self-Hosting
1. Set up GitHub Actions (free tier) - 2 hours
2. Deploy Grafana + Prometheus on Coolify - 3 hours
3. Set up GlitchTip for errors - 2 hours
4. Configure automated backups - 2 hours
5. Set up Uptime Kuma - 1 hour
**Total: 10 hours, $0 cost**

### Week 2-3: Testing Infrastructure
1. Create self-hosted GitHub runner - 2 hours
2. Set up Allure reporting - 3 hours
3. Configure test automation - 5 hours
**Total: 10 hours, $0 cost**

### Week 4: Documentation & Optimization
1. Deploy Swagger UI - 1 hour
2. Configure log aggregation (Loki) - 3 hours
3. Set up alerting rules - 2 hours
**Total: 6 hours, $0 cost**

### Total Initial Investment
- Time: 26 hours
- Cost: $0 upfront (VPS already needed for app)
- Ongoing: $20-30/month (VPS + domain)

---

## Tools Comparison Matrix

| Service | SaaS Option | Cost | Self-Hosted | Setup Time | Recommendation |
|---------|-------------|------|-------------|------------|----------------|
| **Testing Platform** | TestSprite | $49/mo | GitHub Actions + Allure | 6h | Self-host |
| **Error Tracking** | Sentry | $26/mo | GlitchTip | 2h | Self-host |
| **Monitoring** | Datadog | $100/mo | Grafana + Prometheus | 6h | Self-host |
| **Uptime** | Better Uptime | $20/mo | Uptime Kuma | 1h | Self-host |
| **Logs** | Papertrail | $50/mo | Loki | 3h | Self-host |
| **API Docs** | Readme.io | $99/mo | Swagger UI | 1h | Self-host |
| **Email** | SendGrid Pro | $20/mo | SendGrid Free | 0h | Free tier |
| **SMS** | Twilio | Pay/use | N/A | 0h | Pay/use |
| **CDN** | BunnyCDN | $1/mo | Cloudflare | 0h | Free tier |
| **Database** | MongoDB Atlas | $57/mo | Self-host | 0h | Self-host |
| **Cache** | Redis Cloud | $5/mo | Self-host | 0h | Self-host |
| **Backups** | MongoDB Atlas | incl | Scripts | 2h | Self-host |

**Total Potential Savings: $420/month = $5,040/year**

---

## Risk Mitigation for Self-Hosting

### Concerns & Solutions

**1. "What if my VPS goes down?"**
- Solution: Daily automated backups
- Recovery time: <30 minutes with documented procedures
- Cost of downtime: Minimal during early stage
- Mitigation: Use Hetzner/Vultr with 99.9% uptime SLA

**2. "Won't this be harder to maintain?"**
- Reality: Initial setup investment (26 hours)
- Ongoing: ~2 hours/month maintenance
- Benefit: Full control, no vendor lock-in
- Tools: Coolify makes deployment dead simple

**3. "What about security?"**
- Self-hosted tools are as secure as SaaS
- You control access and updates
- Regular security patches (weekly schedule)
- Benefit: Your data stays on your infrastructure

**4. "Can it scale?"**
- Yes! GitHub uses self-hosted monitoring
- Netflix uses self-hosted everything
- You can upgrade VPS or add nodes
- Move to managed services when you have budget

---

## Recommended: Start Minimal, Add as Needed

### Phase 0 (Week 1) - $0 Additional Cost
```
✅ GitHub Actions (free 2,000 min/month)
✅ MongoDB on Coolify (included in VPS)
✅ Redis on Coolify (included in VPS)
✅ Grafana + Prometheus (included in VPS)
✅ SendGrid free tier (3,000 emails/month)
✅ Cloudflare free CDN
```

### Phase 1 (Week 2-4) - $0 Additional Cost
```
✅ GlitchTip error tracking
✅ Uptime Kuma monitoring
✅ Loki log aggregation
✅ Swagger UI documentation
✅ Automated backups
```

### Phase 2 (Month 2-3) - $0 Additional Cost
```
✅ Self-hosted test runner
✅ Allure test reporting
✅ SonarQube code quality
✅ OWASP ZAP security scanning
```

### When to Pay for Services
```
Email: When sending >3,000/month ($15/mo for 10k emails)
SMS: Only pay per message (~$0.01 each)
Payments: Only % of transactions (no fixed cost)
Scaling VPS: When CPU consistently >70% ($50/mo)
```

---

## Next Steps

1. **Review the updated PRODUCTION_ROADMAP.md** (I'll update it with these costs)
2. **Start with Phase 0** using free/self-hosted tools
3. **Set up Coolify services** following this guide
4. **Document your setup** for future projects (reusable)
5. **Scale only when needed** (let revenue drive costs)

**Key Principle:** Every dollar spent should generate $10+ in value. Self-hosting gets you there while bootstrapping.

---

*This guide will be referenced in the updated PRODUCTION_ROADMAP.md*
