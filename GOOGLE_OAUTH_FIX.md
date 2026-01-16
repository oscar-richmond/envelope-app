# Google OAuth Login Fix - URGENT

## The Error
"Access blocked: This app's request is invalid"

## Root Cause
Redirect URI mismatch between your app and Google Cloud Console configuration.

## FIX NOW - Step by Step

### Step 1: Create .env.local (if it doesn't exist)

In `/Users/oscarrichmond/.gemini/antigravity/scratch/Envelope/`, create `.env.local`:

```bash
# Database
DATABASE_URL="your_database_url_here"

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here_generate_with_openssl_rand_base64_32

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Step 2: Get Your Google Client Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Click on it to edit
4. **CRITICAL: Add this EXACT redirect URI:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

### Step 3: Verify Authorized Redirect URIs

In Google Cloud Console, under "Authorized redirect URIs", you MUST have:

**For Local Development:**
```
http://localhost:3000/api/auth/callback/google
```

**For Production (if deployed):**
```
https://your-app.vercel.app/api/auth/callback/google
```

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 5: Test Login

1. Visit: http://localhost:3000
2. Click "Sign in with Google"
3. Should work now

## Quick Command to Create .env.local

```bash
cd /Users/oscarrichmond/.gemini/antigravity/scratch/Envelope

cat > .env.local << 'EOF'
# Copy from your .env file or add:
DATABASE_URL="your_postgres_url"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_this_with_openssl_rand_base64_32
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
EOF
```

## If You Don't Have Google OAuth Credentials Yet

1. Go to: https://console.cloud.google.com
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to `.env.local`

## Test Without OAuth (Temporary)

If you want to bypass Google login temporarily for testing diagnostics, we can add a dev-only bypass. Let me know if you'd prefer that route.
