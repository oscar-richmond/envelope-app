# Enable Diagnostics on envelope-app-sage.vercel.app

## Your Production URL
```
https://envelope-app-sage.vercel.app
```

## Step 1: Add Environment Variable in Vercel

1. Go to: https://vercel.com/
2. Select the **envelope-app-sage** project
3. Click **Settings**
4. Click **Environment Variables**
5. Add:
   - **Name**: `NEXT_PUBLIC_DIAGNOSTICS`
   - **Value**: `1`
   - **Environment**: ✅ Production
6. Click **Save**

## Step 2: Redeploy

1. Go to **Deployments** tab
2. Click ••• on latest deployment
3. Click **Redeploy**
4. Wait ~2 minutes

## Step 3: Enable Diagnostics

Visit this EXACT URL:
```
https://envelope-app-sage.vercel.app/prospects?diag=1
```

The `?diag=1` parameter enables diagnostics and saves it to localStorage.

## What You'll See

After visiting with `?diag=1`, you should see:
- 📊 Snapshot buttons on company rows (when you hover)
- Debug strips under Web Health displays
- Mismatch detection warnings

## To Disable

```
https://envelope-app-sage.vercel.app/prospects?diag=0
```

## After First Visit

Once enabled with `?diag=1`, diagnostics will stay ON even if you visit:
```
https://envelope-app-sage.vercel.app/prospects
```
(without the parameter)

The setting is saved in your browser's localStorage.
