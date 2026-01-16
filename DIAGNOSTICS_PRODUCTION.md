# Enable Diagnostics in Vercel Production

## 1. Set Environment Variables

Go to your Vercel project settings:

1. Navigate to: **Settings → Environment Variables**
2. Add these variables for **Production**:

```
NEXT_PUBLIC_DIAGNOSTICS=1
NEXT_PUBLIC_DEBUG_HEALTH=1
```

3. Click **Save**

## 2. Redeploy

After adding env vars, redeploy:
- Go to **Deployments** tab
- Click the three dots on the latest deployment
- Select **Redeploy**
- Choose **Use existing Build Cache** (faster)

## 3. Enable Diagnostics in Browser

Once deployed, visit your production site:

**Option A - URL Parameter (Easiest)**
```
https://your-app.vercel.app/prospects?diag=1
```

**Option B - Header Toggle**
- Go to `/prospects`
- Look for "🔍 Diagnostics OFF" button in page header (top-right)
- Click to toggle ON
- Page will reload with diagnostics enabled

## 4. Verify

After enabling, you should see:
- ⚡ Yellow banner at top: "Diagnostics enabled: Snapshot + Debug Strip active"
- 📊 Snapshot buttons appear on hover on each row
- Debug strips under Web Health displays

## 5. Disable

To turn off:
- URL: `?diag=0`
- OR click toggle button to turn OFF

## Security Notes

- Diagnostics are **completely hidden** when `NEXT_PUBLIC_DIAGNOSTICS` is not set
- No performance impact when disabled
- Safe for production use (read-only debugging)

## Troubleshooting

**Toggle not visible?**
- Check env var is set in Vercel dashboard
- Check you redeployed AFTER adding env var
- Verify with: `console.log(process.env.NEXT_PUBLIC_DIAGNOSTICS)`

**Snapshot fails?**
- Ensure user is authenticated
- Check browser console for errors
- Verify `/api/dev/health-snapshot` endpoint exists
