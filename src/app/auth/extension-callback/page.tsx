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
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
          // Pass token to extension
          const token = "${token}";
          const email = "${session.user.email}";
          
          // Try to communicate with extension
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            // Send message to extension
            try {
              chrome.runtime.sendMessage(
                undefined, // Extension ID (undefined = self)
                { action: 'authComplete', token, email },
                (response) => console.log('Extension notified')
              );
            } catch (e) {
              console.log('Extension communication failed, using storage fallback');
            }
          }
          
          // Store in localStorage as fallback for the extension to read
          localStorage.setItem('envelope-extension-token', token);
          localStorage.setItem('envelope-extension-email', email);
          
          // Also try postMessage
          window.postMessage({ type: 'ENVELOPE_AUTH', token, email }, '*');
        `}} />
            </body>
        </html>
    );
}
