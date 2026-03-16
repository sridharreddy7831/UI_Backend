# 🚀 RENDER.COM DEPLOYMENT GUIDE

## 🔴 Getting CORS Error After Deploying?

See [FIX_CORS_RENDER.md](./FIX_CORS_RENDER.md) for quick fix.

---

## Initial Setup on Render

### Step 1: Create Render Service

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `uthsav-backend`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing) or Starter (production)

### Step 2: Set Environment Variables

Click **"Environment"** tab and add:

```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/uthsav_invites
JWT_SECRET=<generate secure key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://uthsavinvites.vercel.app
SUPER_ADMIN_EMAIL=sridhar@uthsav.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_app_password
NOTIFICATION_EMAIL=admin@uthsav.com
FRONTEND_URL=https://uthsavinvites.vercel.app
```

### Step 3: Deploy

Click **"Create Web Service"** and wait for deployment.

Your backend URL will be: `https://uthsav-backend-xxx.onrender.com`

---

## Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGO_URI` | Database connection | `mongodb+srv://user:pw@cluster.mongodb.net/db` |
| `JWT_SECRET` | Token signing key | Random 32+ char secret |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `4000` |
| `ALLOWED_ORIGINS` | Frontend URL(s) | `https://yourfrontend.vercel.app` |
| `SUPER_ADMIN_EMAIL` | Can create admins | `sridhar@uthsav.com` |
| `SMTP_*` | Email config | Gmail SMTP details |

---

## 🔐 Security Checklist

- [ ] `JWT_SECRET` is 32+ characters and random
- [ ] `JWT_SECRET` is NOT in git history
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` has only production URLs
- [ ] MongoDB user has strong password
- [ ] SMTP password is App Password (not account password)
- [ ] `.env` file is in `.gitignore`

---

## Common Issues & Fixes

### CORS Error
**Error**: `Error: CORS not allowed`

**Fix**: 
1. See [FIX_CORS_RENDER.md](./FIX_CORS_RENDER.md)
2. Add your frontend URL to `ALLOWED_ORIGINS`
3. Wait for redeployment to finish

### "MONGO_URI is REQUIRED"
**Fix**: 
1. Go to Render → Your service
2. Click "Environment"
3. Add `MONGO_URI` with your actual MongoDB connection string
4. Redeploy

### "JWT_SECRET is REQUIRED"
**Fix**:
1. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add to Render environment variables
3. Redeploy

### Service Failing to Start
1. Check Render logs (Events tab)
2. Look for error messages
3. Verify all required variables are set
4. Ensure MongoDB connection string is correct

---

## Monitoring & Logs

### View Logs
1. Render Dashboard → Your service
2. Click **"Logs"** tab
3. See real-time server logs

### Check Status
1. Click **"Events"** tab
2. See deployment history and status
3. Green check = Active
4. Red X = Error

### Useful Log Commands
```
# View logs for errors
npm run dev 2>&1 | grep -i error

# Check if MongoDB connected
npm run dev 2>&1 | grep -i mongodb

# See all startup messages
npm run dev
```

---

## Updating Backend Code

When you push to main/master:

1. Render automatically detects change
2. Runs `npm install`
3. Runs `npm start`
4. Deploys new version
5. Old version automatically replaced

No manual deployment needed!

---

## Admin Setup on Render

After deployment, create first admin:

### Option 1: Environment Variables
1. Set in Render environment:
   ```
   ADMIN_EMAIL=sridhar@uthsav.com
   ADMIN_PASSWORD=SecurePassword123
   ADMIN_NAME=Sridhar
   ```
2. SSH into Render and run:
   ```bash
   npm run seed
   ```

### Option 2: Via API
1. Boot the service
2. Check if any admins exist
3. Use initial admin account or create via API

### Option 3: MongoDB Direct
1. Go to MongoDB Atlas
2. Insert admin document:
   ```javascript
   db.adminusers.insertOne({
     email: "sridhar@uthsav.com",
     password: "your_hashed_password",  // Use AdminUser.create instead!
     name: "Sridhar",
     createdAt: new Date()
   })
   ```

**Recommended**: Use the seed script in code to hash password properly.

---

## Performance Tips

1. **Free Plan** (spinning down after 15 min inactivity)
   - Good for: Testing, development
   - Bad for: Production with unpredictable traffic

2. **Starter Plan** ($7/month)
   - Always running
   - Better for: Production
   - Includes 100 GB bandwidth/month

3. **Optimization**
   - Add `.renderignore` (like `.gitignore`)
   - Use caching headers
   - Monitor database queries
   - Enable horizontal scaling if needed

---

## SSL/HTTPS

Render automatically provides:
- ✅ Free SSL certificate
- ✅ Auto-renewal
- ✅ HTTPS for all domains
- ✅ Redirects HTTP to HTTPS

No manual configuration needed!

---

## Database on Render

It's **recommended** to use:
- MongoDB Atlas (cloud) - easier
- Render PostgreSQL (if needed) - simpler setup
- Render MySQL (if needed)

**NOT recommended:**
- Self-hosted MongoDB on Render (complex)

---

## Backup Strategy

### Automated
- MongoDB Atlas backup (free tier: 30-day snapshots)
- Render persistent volumes (if using)

### Manual
```bash
# Monday backup
mongodump --uri "mongodb+srv://user:pw@cluster.mongodb.net/uthsav_invites"
```

---

## Domain Setup

### Custom Domain (Optional)

1. Render Dashboard → Your service
2. Click "Settings" → "Custom Domains"
3. Add your domain: `api.uthsavinvites.com`
4. Follow DNS instructions
5. Wait 24-48 hours for DNS propagation

### Use Default Render Domain
- Your backend: `uthsav-backend-xxx.onrender.com`
- Works immediately
- Free, no DNS needed

---

## Render Services Overview

```
┌─────────────────────┐
│  Your GitHub Repo   │
│  (main branch)      │
└──────────┬──────────┘
           │
           ├─→ Render pulls code
           ├─→ npm install
           ├─→ npm build (if needed)
           ├─→ npm start
           └─→ Deploys to Render

┌─────────────────────┐
│   Render Backend    │
│ https://your.onrender.com │
│  Always running     │
│  SSL ✓              │
│  Monitoring ✓       │
└─────────────────────┘
           │
           └─→ Connects to
               MongoDB Atlas

┌─────────────────────┐
│    MongoDB Atlas    │
│   (your database)   │
│   Backups ✓         │
│   Scalable ✓        │
└─────────────────────┘
```

---

## Health Check

Verify your backend is working:

```bash
# Health check endpoint
curl https://your-backend.onrender.com/api/health

# Should return:
# {"status":"ok","db":"connected"}
```

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Express Docs**: https://expressjs.com
- **MongoDB Atlas**: https://docs.atlas.mongodb.com
- **Node.js**: https://nodejs.org/en/docs

---

## Quick Commands

```bash
# View backend logs
curl https://your-backend.onrender.com/api/health

# Test login endpoint
curl -X POST https://your-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@uthsav.com","password":"yourpassword"}'

# Check server running
curl https://your-backend.onrender.com/
```

---

**Status**: ✅ Ready for production on Render

Questions? Check FIX_CORS_RENDER.md first!
