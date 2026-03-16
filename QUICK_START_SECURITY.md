# 🚀 QUICK START - AFTER SECURITY HARDENING

## Installation (5 minutes)

### 1. Install New Packages
```bash
npm install helmet express-rate-limit
```

### 2. Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output.

### 3. Create/Update .env
```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
```
NODE_ENV=development
JWT_SECRET=<paste your generated secret here>
MONGO_URI=<your mongodb uri>
SUPER_ADMIN_EMAIL=sridhar@uthsav.com
```

### 4. Create First Admin
```bash
npm run seed
```

Follow the prompts to create your admin account.

### 5. Start Server
```bash
npm run dev
```

## ✅ Verify It Works

### Check Server Health
```bash
curl http://localhost:4000/api/health
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sridhar@uthsav.com",
    "password": "your_password"
  }'
```

Should return:
```json
{
  "token": "eyJhbGc...",
  "admin": {
    "id": "...",
    "email": "sridhar@uthsav.com",
    "name": "..."
  }
}
```

## 🔐 New Security Features

### Rate Limiting
- 5 login attempts per 15 minutes per IP
- Try 6x: 6th fails with "Too many login attempts"

### Helmet Headers
- Automatic security headers
- Prevents clickjacking, MIME sniffing, etc.

### Generic Error Messages
- "Invalid credentials" for both user not found and wrong password
- Prevents attacker from discovering existing accounts

### New Admin Creation Endpoint
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@uthsav.com",
    "password": "SecurePass123",
    "name": "New Admin"
  }'
```

Only `SUPER_ADMIN_EMAIL` can use this.

## 📝 Key Changes

| Feature | Before | After |
|---------|--------|-------|
| JWT Secret | Optional default | REQUIRED |
| Passwords | Hardcoded in seed file | Interactive/env only |
| Login Attempts | Unlimited | 5 per 15 min |
| Security Headers | None | Helmet |
| Auth Errors | User-specific | Generic |
| CORS | Allows unregistered origins in production | Registered origins only |
| Password Min Length | 6 chars | 8 chars |

## 🐛 Troubleshooting

### "JWT_SECRET is REQUIRED"
```bash
# Check you have JWT_SECRET in .env
grep JWT_SECRET .env

# If not, generate and add it
echo "JWT_SECRET=<your_secret>" >> .env
```

### "Cannot find module helmet"
```bash
npm install helmet
```

### "Seed script not found"
Make sure you have the updated package.json with correct scripts.

### Forgotten Admin Password
Delete admin from MongoDB and run seed again:
```bash
# In MongoDB Atlas/CLI:
# db.adminusers.deleteOne({ email: "sridhar@uthsav.com" })

npm run seed
```

## 📚 Documentation

- **Full Details**: [SECURITY.md](./SECURITY.md)
- **Installation Steps**: [INSTALL_SECURITY.md](./INSTALL_SECURITY.md)
- **API Documentation**: `http://localhost:4000/docs/api-documentation.html`

## 🎯 Production Deployment

### Before deploying:
```bash
# 1. Set NODE_ENV
NODE_ENV=production

# 2. Generate new JWT_SECRET for production
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Use production database URL
MONGO_URI=mongodb+srv://prod-user:prod-password@prod-cluster...

# 4. Set only production CORS origins
ALLOWED_ORIGINS=https://uthsavinvites.vercel.app

# 5. Verify HTTPS is enabled
# 6. Verify firewall/network rules
# 7. Set up monitoring
```

### Deploy
```bash
# Install prod dependencies
npm install --production

# Use process manager (PM2 recommended)
npm install -g pm2
pm2 start index.js --name "uthsav-api"
pm2 save
```

## ✨ Features Now Secure

✅ Admin login with rate limiting  
✅ JWT token generation and validation  
✅ Secure password hashing  
✅ Generic error messages (no user enumeration)  
✅ Security headers (Helmet)  
✅ CORS protection  
✅ Protected admin registration  
✅ Security logging  
✅ Mandatory JWT_SECRET  
✅ No hardcoded passwords  

## 🆘 Need Help?

1. Check server logs: `npm run dev` (shows all activity)
2. Read error messages - they're detailed
3. Check .env file is properly configured
4. Verify MongoDB connection
5. Review SECURITY.md for detailed explanation

---

**Ready to go!** 🚀

Your backend is now hardened and production-ready.
