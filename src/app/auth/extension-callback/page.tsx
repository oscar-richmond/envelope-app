import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ExtensionCallbackPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/sign-in?callbackUrl=/auth/extension-callback');
  }

  // Generate a simple token (in production, use a proper JWT)
  const token = Buffer.from(JSON.stringify({
    email: session.user.email,
    name: session.user.name,
    id: session.user.id,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  })).toString('base64');

  return (
    <html>
      <head>
        <title>Envelope Extension - Connected</title>
        <style>{`
          body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8f9fb;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .card {
            background: white;
            padding: 48px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            max-width: 400px;
          }
          .icon {
            width: 64px;
            height: 64px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          .icon svg {
            color: #10b981;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 8px;
            color: #1a1a1a;
          }
          p {
            color: #6b7280;
            margin: 0 0 24px;
          }
          .email {
            background: #f3f4f6;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            color: #374151;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>Extension Connected!</h1>
          <p>You can now close this tab and use the Envelope extension.</p>
          <div className="email">{session.user.email}</div>
          <div id="status" style={{ marginTop: '16px', padding: '8px 16px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontSize: '13px' }}>
            Connecting to extension...
          </div>
        </div>

        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const statusEl = document.getElementById('status');
            function updateStatus(msg, success) {
              statusEl.textContent = msg;
              statusEl.style.background = success ? '#d1fae5' : '#fef3c7';
              statusEl.style.color = success ? '#065f46' : '#92400e';
            }
            
            console.log('[Envelope Auth] Starting token injection...');
            
            const token = "${token}";
            const email = "${session.user.email}";
            
            console.log('[Envelope Auth] Token ready, email:', email);
            
            // Store in localStorage
            try {
              localStorage.setItem('envelope-extension-token', token);
              localStorage.setItem('envelope-extension-email', email);
              localStorage.setItem('envelope-extension-ready', Date.now().toString());
              console.log('[Envelope Auth] Token stored in localStorage');
            } catch (e) {
              console.error('[Envelope Auth] localStorage error:', e);
              updateStatus('Error: ' + e.message, false);
              return;
            }
            
            // Verify it was stored
            const storedToken = localStorage.getItem('envelope-extension-token');
            const storedEmail = localStorage.getItem('envelope-extension-email');
            
            if (storedToken && storedEmail) {
              console.log('[Envelope Auth] Verified: token stored successfully');
              updateStatus('Token ready! Extension should pick it up...', false);
            } else {
              console.error('[Envelope Auth] Token not stored properly!');
              updateStatus('Error: Token not stored', false);
              return;
            }
            
            // Poll to check if extension picked up the token
            let checkCount = 0;
            const checkInterval = setInterval(() => {
              checkCount++;
              const tokenStillThere = localStorage.getItem('envelope-extension-token');
              
              if (!tokenStillThere) {
                // Extension picked it up and cleared it
                clearInterval(checkInterval);
                updateStatus('✓ Connected! You can close this tab.', true);
                console.log('[Envelope Auth] Token was picked up by extension!');
              } else if (checkCount >= 30) {
                clearInterval(checkInterval);
                updateStatus('Extension not responding. Try reloading extension in chrome://extensions', false);
                console.warn('[Envelope Auth] Token still present after 15s - extension may not be running');
              }
            }, 500);
          })();
        `}} />
      </body>
    </html>
  );
}
