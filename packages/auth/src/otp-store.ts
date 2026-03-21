/**
 * Shared in-memory OTP store
 *
 * Used by the phone-number auth plugin's sendOTP callback and
 * the dev-only OTP retrieval endpoint.
 *
 * In production this would be replaced by a real SMS provider.
 */

interface StoredOtp {
    code: string;
    expiresAt: number;
}

const otpMap = new Map<string, StoredOtp>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function storeOtp(phone: string, code: string): void {
    otpMap.set(phone, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
    });
}

export function getOtp(phone: string): string | null {
    const entry = otpMap.get(phone);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        otpMap.delete(phone);
        return null;
    }
    return entry.code;
}
