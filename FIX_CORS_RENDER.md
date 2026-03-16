# 🔧 FIX CORS ERROR ON RENDER.COM

## Problem
```
Error: CORS not allowed
```

This happens when your frontend URL isn't in the `ALLOWED_ORIGINS` environment variable on Render.

---

## Solution: Add ALLOWED_ORIGINS to Render Environment

### Step 1: Find Your Frontend URL

Your frontend is deployed at:
- **Development**: `http://localhost:5173`
- **Production (Vercel)**: `https://uthsavinvites.vercel.app`

Or check your actual deployed frontend URL.

### Step 2: Go to Render.com Dashboard

1. Login to [https://dashboard.render.com](https://dashboard.render.com)
2. Find your backend service (the one deployed on Render)
3. Click on it to open the service details

### Step 3: Update Environment Variables

1. Click **"Environment"** tab
2. Find or create the `ALLOWED_ORIGINS` variable
3. Set it to your frontend URL(s) separated by commas:

**For Vercel frontend:**
```
https://uthsavinvites.vercel.app
```

**For multiple origins (development + production):**
```
http://localhost:5173,http://localhost:5174,https://uthsavinvites.vercel.app
```

**If you deployed elsewhere (not Vercel):**
```
https://your-frontend-url.com
```

### Step 4: Save and Redeploy

1. Click **"Save"**
2. Render will automatically redeploy your backend
3. Wait for deployment to finish (green checkmark)
4. Test your frontend - CORS error should be gone

---

## How to Find Your Actual Frontend URL

If you're not sure what your frontend URL is:

### Option 1: Check Browser
1. Open your frontend
2. Look at the URL bar
3. Use that URL in `ALLOWED_ORIGINS`

### Option 2: Check Environment Variable
If you have a frontend deployed:
- **Vercel**: Dashboard → Project → Settings → Domains
- **Netlify**: Dashboard → Site settings → Domain
- **Render**: Dashboard → Service → Settings

### Option 3: Verify with cURL
```bash
# This will show which origin your frontend sends
curl -v https://your-frontend-url.com 2>&1 | grep -i origin
```

---

## Full ALLOWED_ORIGINS Examples

### Development Only
```
http://localhost:5173
```

### Production Only (Vercel)
```
https://uthsavinvites.vercel.app
```

### Development + Production
```
http://localhost:5173,http://localhost:5174,https://uthsavinvites.vercel.app
```

### Multiple Deployments
```
https://frontend-vercel.vercel.app,https://frontend-netlify.netlify.app,http://localhost:5173
```

### All Render Deployments
```
https://frontend.onrender.com,https://backend.onrender.com
```

---

## Troubleshooting

### Still Getting CORS Error?

1. **Check Render logs for actual origin:**
   - Go to Render → Your service → Logs
   - Look for: `⚠️ CORS rejected origin: https://...`
   - Copy that URL into `ALLOWED_ORIGINS`

2. **Verify variable was saved:**
   - Refresh Render dashboard
   - Check if `ALLOWED_ORIGINS` is still there
   - Verify there are no extra spaces

3. **Wait for redeployment:**
   - Environment changes require redeployment
   - Wait for green checkmark in Render
   - Refresh your browser after deployment done

4. **Check for typos:**
   - No trailing slashes: ✅ `https://example.com` ❌ `https://example.com/`
   - Match exact URL: ✅ `https://` or ❌ `http://`

---

## Environment Variables Checklist

Make sure ALL these are set on Render:

- [ ] `MONGO_URI` - Your MongoDB connection string
- [ ] `JWT_SECRET` - Your generated secret (32+ chars)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `ALLOWED_ORIGINS` - Your frontend URL(s)
- [ ] `PORT` - Usually 4000
- [ ] `SMTP_*` - Email config (optional)

---

## Quick Fix Commands

If you have Render CLI installed:

```bash
# View current environment variables
render env list --service-id YOUR_SERVICE_ID

# Set ALLOWED_ORIGINS (replace URL)
render env set ALLOWED_ORIGINS="https://uthsavinvites.vercel.app,http://localhost:5173" --service-id YOUR_SERVICE_ID
```

---

## After Fixing CORS

### Test the API
```bash
# With your frontend URL
curl -X POST https://your-backend.onrender.com/api/auth/login \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@uthsav.com","password":"yourpassword"}'
```

Should return token without CORS error.

### In Frontend
Your API calls should now work:
```javascript
const response = await fetch('https://your-backend.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

---

## Common RENDER URLS

If you deployed on Render, your backend URL looks like:
```
https://uthsav-backend.onrender.com
https://backend-xxx.onrender.com
```

And frontend:
```
https://uthsav-frontend.onrender.com  (if deployed on Render)
https://uthsavinvites.vercel.app      (if deployed on Vercel)
```

---

## Contact Support

If you're still stuck:

1. Check Render logs (shows actual rejected origin)
2. Verify no extra spaces in `ALLOWED_ORIGINS`
3. Wait 2-3 minutes for redeployment
4. Clear browser cache (CTRL+SHIFT+DEL)
5. Try incognito/private window

---

**⚠️ IMPORTANT:** After setting `ALLOWED_ORIGINS`, Render automatically redeploys. 
**Do not manually trigger deploy** - let it complete automatically.

Check the status indicator:
- 🟡 Deploying... (wait for this)
- 🟢 Live (ready to use)
- 🔴 Failed (check error logs)
