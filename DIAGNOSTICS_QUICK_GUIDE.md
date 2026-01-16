# Diagnostics Now Visible - Quick Guide

## ✅ What's Fixed

1. **URL Parameter Support**
   - Use `?diag=1` to enable diagnostics
   - Use `?diag=0` to disable
   - State persists in localStorage

2. **Enhanced Hook**
   - Checks URL params first
   - Falls back to localStorage
   - Only works when `NEXT_PUBLIC_DIAGNOSTICS=1` is set

## 🚀 To Enable in Production

### Step 1: Add Environment Variable in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add for **Production** environment:
   ```
   NEXT_PUBLIC_DIAGNOSTICS=1
   ```
3. Save and redeploy

### Step 2: Enable in Browser

Visit your production URL with query parameter:
```
https://your-app.vercel.app/prospects?diag=1
```

### Step 3: Verify

You should now see:
- 📊 Snapshot buttons on each Search row (on hover)
- Debug strips under Web Health displays
- Mismatch banners when null→zero detected

## 📍 Current Implementation

**Fixed/Enhanced:**
- ✅ URL param support (`?diag=1/0`)
- ✅ localStorage persistence
- ✅ Env var gating
- ✅ Snapshot buttons in rows
- ✅ Debug strips working
- ✅ Mismatch detection

**Still Pending (optional enhancements):**
- Header toggle button (can be added if needed)
- Visible banner when diagnostics ON
- These can be added in a follow-up if needed

## 🔍 Testing Locally

1. Ensure `.env.local` has:
   ```
   NEXT_PUBLIC_DIAGNOSTICS=1
   ```

2. Visit:
   ```
   http://localhost:3000/prospects?diag=1
   ```

3. Reload page - diagnostics should persist

4. To disable:
   ```
   http://localhost:3000/prospects?diag=0
   ```

## 🛡️ SecurityDiagnostics are completely hidden when:
- `NEXT_PUBLIC_DIAGNOSTICS` is not set
- User hasn't enabled via URL param

No performance impact when disabled.
