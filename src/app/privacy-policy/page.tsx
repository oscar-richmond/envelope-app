import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy - Envelope',
    description: 'Privacy Policy for Envelope Lead Capture Chrome Extension',
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-16">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                <p className="text-gray-500 mb-8">Last updated: January 2026</p>

                <div className="prose prose-gray max-w-none">
                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
                        <p className="text-gray-600 mb-4">
                            Envelope ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                            explains how we collect, use, and safeguard information when you use our Envelope Lead Capture
                            Chrome Extension and associated web application.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

                        <h3 className="text-lg font-medium text-gray-800 mb-2">2.1 Information You Provide</h3>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>Account information (email address) when you sign in</li>
                            <li>Company and contact information you choose to capture and save</li>
                            <li>Notes and tags you add to leads</li>
                        </ul>

                        <h3 className="text-lg font-medium text-gray-800 mb-2">2.2 Information Collected Automatically</h3>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>URLs of pages where you use the extension (to extract company data)</li>
                            <li>Basic usage analytics (feature usage, error logs)</li>
                        </ul>

                        <h3 className="text-lg font-medium text-gray-800 mb-2">2.3 Information We Do NOT Collect</h3>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>Passwords or login credentials for any third-party sites</li>
                            <li>Personal browsing history unrelated to lead capture</li>
                            <li>Financial or payment information through the extension</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">3. How We Use Information</h2>
                        <p className="text-gray-600 mb-4">We use the collected information to:</p>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>Provide and improve our lead capture and management services</li>
                            <li>Authenticate your account and maintain your session</li>
                            <li>Store and organize the leads you capture</li>
                            <li>Send emails on your behalf when you use the compose feature</li>
                            <li>Provide customer support</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Data Storage and Security</h2>
                        <p className="text-gray-600 mb-4">
                            Your data is stored securely using industry-standard encryption. We use secure cloud
                            infrastructure and implement appropriate technical and organizational measures to protect
                            your information against unauthorized access, alteration, or destruction.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Sharing</h2>
                        <p className="text-gray-600 mb-4">
                            We do not sell, trade, or rent your personal information to third parties. We may share
                            data only in the following circumstances:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>With service providers who assist in operating our service (e.g., hosting, email delivery)</li>
                            <li>When required by law or to protect our legal rights</li>
                            <li>With your explicit consent</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Third-Party Services</h2>
                        <p className="text-gray-600 mb-4">
                            Our extension may interact with third-party websites (such as LinkedIn) to extract
                            publicly available business information. We only access data visible on pages you
                            actively visit while using the extension. We also use third-party email discovery
                            services to help find business contact information.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
                        <p className="text-gray-600 mb-4">You have the right to:</p>
                        <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                            <li>Access the personal data we hold about you</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Export your data in a portable format</li>
                            <li>Withdraw consent at any time</li>
                        </ul>
                        <p className="text-gray-600">
                            To exercise these rights, please contact us at the email address below.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Cookies and Local Storage</h2>
                        <p className="text-gray-600 mb-4">
                            The extension uses browser local storage to maintain your authentication session and
                            remember your preferences. The web application uses cookies for session management
                            and authentication purposes only.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Changes to This Policy</h2>
                        <p className="text-gray-600 mb-4">
                            We may update this Privacy Policy from time to time. We will notify you of any changes
                            by posting the new Privacy Policy on this page and updating the "Last updated" date.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Contact Us</h2>
                        <p className="text-gray-600 mb-4">
                            If you have any questions about this Privacy Policy or our data practices, please contact us at:
                        </p>
                        <p className="text-gray-600">
                            <strong>Email:</strong> hello@selfhood-studios.com
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
