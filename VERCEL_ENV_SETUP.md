# Vercel Environment Variable Setup

## Feature Flag: FF_NEW_WEBSITE_HEALTH

To enable the new Website Health schema in production (Vercel), you need to set environment variables in the Vercel dashboard.

### Steps:

1. **Go to Vercel Dashboard**
   - Navigate to: https://vercel.com/your-team/envelope-app/settings/environment-variables

2. **Add Server-Side Flag**
   - Variable Name: `FF_NEW_WEBSITE_HEALTH`
   - Value: `true`
   - Environment: `Production`, `Preview`, `Development` (all)
   - Click "Save"

3. **Add Client-Side Flag**
   - Variable Name: `NEXT_PUBLIC_FF_NEW_WEBSITE_HEALTH`
   - Value: `true`
   - Environment: `Production`, `Preview`, `Development` (all)
   - Click "Save"

4. **Redeploy**
   - Go to Deployments tab
   - Click "Redeploy" on the latest production deployment
   - OR push a new commit to trigger automatic deployment

### Verification:

After redeployment, visit these URLs to verify the flag is enabled:

1. **Check Flag Status**: https://envelope-app-sage.vercel.app/api/debug/flags
   - Should show: `USE_NEW_WEBSITE_HEALTH_SCHEMA: true`
   - Should show: `FF_NEW_WEBSITE_HEALTH: 'true'`
   - Should show: `NEXT_PUBLIC_FF_NEW_WEBSITE_HEALTH: 'true'`

2. **Check Health Data**: https://envelope-app-sage.vercel.app/api/debug/website-health?companyId=764
   - Should show: `selectedSource: 'new'`

### Rollback (if needed):

If you need to rollback to legacy fields:
1. Set both variables to `false` in Vercel
2. Redeploy

## Default Behavior

As of this update, the feature flag **defaults to TRUE** even if not set. This means:
- If env vars are NOT set → flag is TRUE (uses new fields)
- To use legacy fields, you must explicitly set the vars to `false`

This ensures the new canonical fields are used in production by default.
