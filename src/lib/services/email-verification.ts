import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export interface VerificationResult {
    syntaxValid: boolean;
    mxValid: boolean;
    roleRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    sendabilityStatus: 'GOOD' | 'CAUTION' | 'HIGH_RISK';
    details: string[];
}

export class EmailVerificationService {

    // Common role-based prefixes
    private HIGH_RISK_ROLES = ['noreply', 'do-not-reply', 'no-reply', 'bounce', 'admin', 'postmaster', 'abuse', 'webmaster'];
    private MEDIUM_RISK_ROLES = ['support', 'billing', 'sales', 'info', 'contact', 'help', 'jobs', 'careers', 'marketing', 'press', 'media'];

    async verify(email: string): Promise<VerificationResult> {
        const result: VerificationResult = {
            syntaxValid: false,
            mxValid: false,
            roleRisk: 'NONE',
            sendabilityStatus: 'HIGH_RISK',
            details: []
        };

        // 1. Syntax Validaiton
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            result.details.push("Invalid email format");
            return result; // Immediate fail
        }
        result.syntaxValid = true;

        // 2. Role Risk Analysis
        const [localPart, domain] = email.split('@');
        if (this.HIGH_RISK_ROLES.includes(localPart.toLowerCase())) {
            result.roleRisk = 'HIGH';
            result.details.push("High-risk role address detected");
        } else if (this.MEDIUM_RISK_ROLES.includes(localPart.toLowerCase())) {
            result.roleRisk = 'MEDIUM';
            result.details.push("Generic role address detected");
        } else {
            result.roleRisk = 'LOW'; // Assumed personal
        }

        // 3. DNS MX Check
        try {
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                result.mxValid = true;
            } else {
                result.details.push("No MX records found for domain");
                // MX fail is high risk
            }
        } catch (error) {
            result.details.push("DNS lookup failed or domain does not exist");
            // DNS fail is high risk
        }

        // 4. Final Status Determination
        if (!result.mxValid) {
            result.sendabilityStatus = 'HIGH_RISK';
        } else if (result.roleRisk === 'HIGH') {
            result.sendabilityStatus = 'HIGH_RISK';
        } else if (result.roleRisk === 'MEDIUM') {
            result.sendabilityStatus = 'CAUTION';
        } else {
            result.sendabilityStatus = 'GOOD';
        }

        return result;
    }
}

export const emailVerifier = new EmailVerificationService();
