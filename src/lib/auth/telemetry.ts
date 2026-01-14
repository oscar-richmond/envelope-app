/**
 * Auth Telemetry Logger
 * 
 * Structured logging for auth events to help debug session issues.
 * These logs can be found in Vercel logs or browser console.
 */

export type AuthEventType =
    | 'callback_received'
    | 'session_set_success'
    | 'session_validation_fail'
    | 'token_refresh_success'
    | 'token_refresh_fail'
    | 'token_expired'
    | 'sign_out';

export interface AuthEvent {
    type: AuthEventType;
    email?: string;
    source: 'web' | 'extension' | 'api';
    success?: boolean;
    details?: Record<string, any>;
}

export function logAuthEvent(event: AuthEvent): void {
    const logEntry = {
        ...event,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    };

    // Structured log for easy parsing
    console.log('[AUTH_TELEMETRY]', JSON.stringify(logEntry));
}

/**
 * Log server-side auth events
 */
export function logServerAuthEvent(event: AuthEvent): void {
    logAuthEvent({ ...event, source: event.source || 'api' });
}

/**
 * Format for client-side console logging
 */
export function formatClientAuthLog(event: AuthEvent): string {
    const icon = event.success === false ? '❌' : event.success === true ? '✅' : 'ℹ️';
    return `${icon} [Auth] ${event.type}${event.email ? ` - ${event.email}` : ''}`;
}
