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

    getAuthUrl() {
        return this.client.generateAuthUrl({
            access_type: 'offline', // Get refresh token
            scope: [
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/userinfo.email'
            ],
            prompt: 'consent' // Force refresh token generation
        });
    }

    async handleCallback(code: string) {
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

    async createDraft(to: string, subject: string, body: string) {
        // 1. Get Connection
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) throw new Error("No Gmail connection found");

        // 2. Refresh Token if needed (simplified check)
        // For proper impl: check expiryDate. Google lib handles simple refresh if creds set.
        this.client.setCredentials({
            access_token: conn.accessToken,
            refresh_token: conn.refreshToken
        });

        // 3. Create Draft
        const gmail = google.gmail({ version: 'v1', auth: this.client });

        const str = [
            `To: ${to}`,
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            body
        ].join('\n');

        const encodedMessage = Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: encodedMessage
                }
            }
        });

        return res.data;
    }

    async sendEmail(to: string, subject: string, body: string) {
        // 1. Get Connection
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) throw new Error("No Gmail connection found");

        // 2. Refresh Token
        this.client.setCredentials({
            access_token: conn.accessToken,
            refresh_token: conn.refreshToken
        });

        // 3. Create & Send
        const gmail = google.gmail({ version: 'v1', auth: this.client });

        const str = [
            `To: ${to}`,
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            body
        ].join('\n');

        const encodedMessage = Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

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
}

export const gmailService = new GmailService();
