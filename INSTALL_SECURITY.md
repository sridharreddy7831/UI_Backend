# 🔐 Security Hardening Installation Guide

## Step 1: Install New Dependencies

```bash
npm install helmet express-rate-limit
```

This installs:
- **helmet** v7.1.0 - Security headers middleware
- **express-rate-limit** v6.10.0 - Rate limiting for brute force protection

## Step 2: Copy and Configure Environment Variables

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### Required Changes to .env:

1. **Generate JWT_SECRET**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Copy output to JWT_SECRET in .env
   ```

2. **Set MONGO_URI**
   ```
   MONGO_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/uthsav_invites
   ```

3. **Set SUPER_ADMIN_EMAIL**
   ```
   SUPER_ADMIN_EMAIL=sridhar@uthsav.com
   ```

4. **Configure SMTP (Optional but Recommended)**
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your_app_password  # From https://myaccount.google.com/apppasswords
   NOTIFICATION_EMAIL=admin@uthsav.com
   ```

## Step 3: Create First Admin Account (IMPORTANT!)

Since hardcoded passwords are removed, you MUST create an admin account securely:

```bash
npm run seed
```

You'll be prompted for:
- Admin email (e.g., sridhar@uthsav.com)
- Admin password (min 8 characters)
- Admin name

## Step 4: Verify Installation

Start the server:
```bash
npm run dev
```

You should see:
```
✅ MongoDB connected
🚀 API server running on port 4000
```

Test login endpoint:
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

## Step 5: Test Security Features

### 1. Rate Limiting (Login Protection)
```bash
# Try 6 login attempts - 6th should be blocked
for i in {1..6}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "Attempt $i"
done
```

Expected: 5 should succeed with auth error, 6th returns rate limit error.

### 2. Generic Error Messages
```bash
# Non-existent user
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"wrong"}'

# Wrong password
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sridhar@uthsav.com","password":"wrong"}'
```

Both return: `{ "error": "Invalid credentials", "code": "AUTH_FAILED" }`

### 3. Helmet Headers
```bash
curl -I http://localhost:4000/api/health
```

Look for security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: ...`

## Step 6: Production Deployment

### Environment Variables for Production:

```bash
NODE_ENV=production
JWT_SECRET=<your_generated_secret>
MONGO_URI=<your_production_db>
ALLOWED_ORIGINS=https://uthsavinvites.vercel.app
SUPER_ADMIN_EMAIL=sridhar@uthsav.com
```

### Before Deploying:

- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] NODE_ENV is set to "production"
- [ ] HTTPS/TLS is enabled
- [ ] Database password is strong
- [ ] CORS origins are production URLs only
- [ ] Rate limiting is enabled
- [ ] Helmet security headers are active
- [ ] Admin account is created with strong password
- [ ] No .env file with secrets is committed

## Troubleshooting

### "JWT_SECRET is REQUIRED" Error
```bash
# Make sure JWT_SECRET is set in .env
echo "JWT_SECRET=your_secret" >> .env

# Or set as environment variable
export JWT_SECRET=your_secret
npm run dev
```

### "Cannot find module 'helmet'"
```bash
npm install helmet
npm install express-rate-limit
```

### "Password may be compromised" Chrome Warning
This is Chrome's password manager checking the database.

After applying these changes:
1. Change your password again to trigger re-check
2. Wait 24 hours for Chrome's cache to update
3. Use a different password for test accounts

The warning should disappear because:
- Passwords are now hashed with bcrypt (12 salt rounds)
- No hardcoded passwords in code
- Rate limiting prevents account takeover
- Strong JWT secrets protect tokens

### Admin Password Reset
If you forgot the password:

1. Delete the admin from MongoDB:
   ```bash
   # In MongoDB CLI
   db.adminusers.deleteOne({ email: "sridhar@uthsav.com" })
   ```

2. Recreate with seed:
   ```bash
   npm run seed
   ```

## Next Steps

1. Review [SECURITY.md](./SECURITY.md) for full security details
2. Update your API documentation at `/docs/api-documentation.html`
3. Configure monitoring/logging for production
4. Set up automated backups
5. Plan regular security audits

---

**✅ Installation Complete!**

Your backend is now hardened with:
- ✅ Helmet security headers
- ✅ Rate limiting on login
- ✅ Generic auth error messages
- ✅ Mandatory JWT_SECRET
- ✅ Secure admin registration
- ✅ No hardcoded passwords
- ✅ Improved CORS security
- ✅ Security logging
