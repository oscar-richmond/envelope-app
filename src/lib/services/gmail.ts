import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';

export class GmailService {
    private client: OAuth2Client;

    constructor() {
        this.client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
        );
    }

    getAuthUrl(redirectUri?: string, state?: string) {
        // If dynamic URI provided, update client (or create temp context)
        // For safety in serverless, we can clone or just set it if we trust sequential execution isolation (Vercel usually isolates).
        // Safest: set it on the instance, as we need it.
        if (redirectUri) {
            this.client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                redirectUri
            );
        }

        return this.client.generateAuthUrl({
            access_type: 'offline', // Get refresh token
            scope: [
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/userinfo.email'
            ],
            prompt: 'consent', // Force refresh token generation
            state: state // Pass state (used for dynamic redirect persistence)
        });
    }

    async handleCallback(code: string, redirectUri?: string) {
        if (redirectUri) {
            this.client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                redirectUri
            );
        }

        const { tokens } = await this.client.getToken(code);
        this.client.setCredentials(tokens);

        // Get User Profile
        const oauth2 = google.oauth2({ version: 'v2', auth: this.client });
        const { data: user } = await oauth2.userinfo.get();

        if (!user.email) throw new Error("No email found in Google profile");

        // Save tokens
        // Check if exists
        const existing = await prisma.gmailAccount.findUnique({ where: { email: user.email } });

        const data = {
            email: user.email,
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || existing?.refreshToken || '', // Keep old refresh token if not provided new
            expiryDate: BigInt(tokens.expiry_date || 0)
        };

        if (existing) {
            await prisma.gmailAccount.update({
                where: { email: user.email },
                data
            });
        } else {
            await prisma.gmailAccount.create({ data });
        }

        return user.email;
    }

    private makeBody(from: string, to: string, subject: string, body: string, htmlBody?: string) {
        const boundary = "__boundary__";
        // Header - IMPORTANT: RFC 5322 requires CRLF line endings
        const CRLF = '\r\n';
        const str = [
            `MIME-Version: 1.0`,
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            body,
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            htmlBody || body,
            ``,
            `--${boundary}--`
        ].join(CRLF);

        return Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async createDraft(to: string, subject: string, body: string, htmlBody?: string) {
        // 1. Get Connection
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) throw new Error("No Gmail connection found");

        // 2. Refresh Token
        this.client.setCredentials({
            access_token: conn.accessToken,
            refresh_token: conn.refreshToken
        });

        // 3. Create Draft
        const gmail = google.gmail({ version: 'v1', auth: this.client });

        // Use HTML body if provided, otherwise simple text
        let raw = '';
        if (htmlBody) {
            raw = this.makeBody(conn.email, to, subject, body, htmlBody);
        } else {
            // Fallback legacy simple text - also include From header
            // Use CRLF per RFC 5322
            const CRLF = '\r\n';
            const str = [
                `From: ${conn.email}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Content-Type: text/plain; charset=utf-8`,
                ``,
                body
            ].join(CRLF);
            raw = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }

        const res = await gmail.users.drafts.create({
            userId: 'me',
            requestBody: { message: { raw } }
        });

        return res.data;
    }

    async sendEmail(to: string, subject: string, body: string, htmlBody?: string, threadId?: string) {
        // 1. Get Connection
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) throw new Error("No Gmail connection found");

        // 2. Set credentials and refresh token if needed
        this.client.setCredentials({
            access_token: conn.accessToken,
            refresh_token: conn.refreshToken,
            expiry_date: Number(conn.expiryDate)
        });

        // Force token refresh if expired or close to expiry
        try {
            const { credentials } = await this.client.refreshAccessToken();
            if (credentials.access_token && credentials.access_token !== conn.accessToken) {
                // Update stored token
                await prisma.gmailAccount.update({
                    where: { id: conn.id },
                    data: {
                        accessToken: credentials.access_token,
                        expiryDate: BigInt(credentials.expiry_date || 0)
                    }
                });
                this.client.setCredentials(credentials);
            }
        } catch (refreshError) {
            console.error('Token refresh failed, trying with existing token:', refreshError);
        }

        // 3. Create & Send
        const gmail = google.gmail({ version: 'v1', auth: this.client });

        let raw = '';
        if (htmlBody) {
            raw = this.makeBody(conn.email, to, subject, body, htmlBody);
        } else {
            // Include From header to ensure sender verification passes
            // Use CRLF per RFC 5322
            const CRLF = '\r\n';
            const str = [
                `From: ${conn.email}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Content-Type: text/plain; charset=utf-8`,
                ``,
                body
            ].join(CRLF);
            raw = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }

        const requestBody: any = { raw };
        if (threadId) {
            requestBody.threadId = threadId;
        }

        console.log(`Sending email to: ${to}, subject: ${subject.substring(0, 50)}...`);

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody
        });

        console.log(`Email sent successfully, messageId: ${res.data.id}`);

        // Update stats
        await prisma.gmailAccount.update({
            where: { id: conn.id },
            data: {
                sentToday: { increment: 1 },
                lastSentAt: new Date()
            }
        });

        return res.data;
    }
    async getThread(threadId: string) {
        // 1. Get Connection
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) throw new Error("No Gmail connection found");

        // 2. Refresh Token
        this.client.setCredentials({
            access_token: conn.accessToken,
            refresh_token: conn.refreshToken
        });

        const gmail = google.gmail({ version: 'v1', auth: this.client });

        // 3. Fetch
        const res = await gmail.users.threads.get({
            userId: 'me',
            id: threadId
        });

        return res.data;
    }
}

export const gmailService = new GmailService();
