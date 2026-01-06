
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// Configuration
// In production, RP_ID must match the domain exactly (e.g. envelope.vercel.app)
// In dev, 'localhost'
const RP_NAME = 'LeadGen Pro';

export const getRpId = (reqUrl: string) => {
    try {
        const url = new URL(reqUrl);
        return url.hostname;
    } catch (e) {
        return 'localhost';
    }
}
const getOrigin = (reqUrl: string) => {
    try {
        const url = new URL(reqUrl);
        return url.origin;
    } catch (e) {
        return 'http://localhost:3000';
    }
}

export class PasskeyService {

    // --- Registration ---

    static async generateRegisterOptions(userId: string, userEmail: string, knownCredentialIds: string[], reqUrl: string) {
        const rpID = getRpId(reqUrl);

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID,
            userID: userId,
            userName: userEmail,
            attestationType: 'none', // Direct/Indirect not needed usually
            excludeCredentials: knownCredentialIds.map(id => ({
                id: id,
                transports: ['internal', 'hybrid'], // Optional hints
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'cross-platform', // or 'platform' for TouchID only
            },
        });
        return options;
    }

    static async verifyRegisterResponse(body: any, expectedChallenge: string, reqUrl: string) {
        const rpID = getRpId(reqUrl);
        const origin = getOrigin(reqUrl);

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
        return verification;
    }

    // --- Authentication ---

    static async generateAuthOptions(reqUrl: string) {
        const rpID = getRpId(reqUrl);

        const options = await generateAuthenticationOptions({
            rpID,
            userVerification: 'preferred',
            // No allowCredentials -> This enables "Usernameless" flow 
            // (user selects account from passkey list)
        });
        return options;
    }

    static async verifyAuthResponse(body: any, expectedChallenge: string, credentialPublicKey: Uint8Array, previousCounter: number, reqUrl: string) {
        const rpID = getRpId(reqUrl);
        const origin = getOrigin(reqUrl);

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: {
                credentialPublicKey,
                counter: previousCounter,
                credentialID: body.id
            },
        });
        return verification;
    }
}
