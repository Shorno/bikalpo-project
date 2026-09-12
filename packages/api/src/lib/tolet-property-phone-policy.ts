import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const PROPERTY_PHONE_OTP_TTL_MS = 5 * 60_000;
export const PROPERTY_PHONE_PROOF_TTL_MS = 15 * 60_000;
export const PROPERTY_PHONE_SEND_WINDOW_MS = 60 * 60_000;
export const PROPERTY_PHONE_RESEND_MS = 60_000;
export const PROPERTY_PHONE_MAX_SENDS = 5;
export const PROPERTY_PHONE_MAX_ATTEMPTS = 5;

export type PropertyPhoneState = {
  phone: string;
  sentAt: number;
  windowStartedAt: number;
  sendCount: number;
  attempts: number;
  otpHash: string | null;
  otpExpiresAt: number;
  proofHash: string | null;
  proofExpiresAt: number;
  verifiedAt: number | null;
};

function digest(secret: string, userId: string, phone: string, purpose: string, value: string) {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["tolet-property-phone-v1", userId, phone, purpose, value]))
    .digest("hex");
}

function equalHash(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function propertyPhoneSendError(previous: PropertyPhoneState | null, now: number) {
  if (!previous) return null;
  if (now - previous.sentAt < PROPERTY_PHONE_RESEND_MS) return "Wait 60 seconds before requesting another code.";
  if (now - previous.windowStartedAt < PROPERTY_PHONE_SEND_WINDOW_MS && previous.sendCount >= PROPERTY_PHONE_MAX_SENDS) {
    return "Too many verification codes requested. Try again in one hour.";
  }
  return null;
}

export function createPropertyPhoneChallenge(input: {
  secret: string; userId: string; phone: string; previous: PropertyPhoneState | null; now: number;
}) {
  const { secret, userId, phone, previous, now } = input;
  const code = randomInt(100_000, 1_000_000).toString();
  const sameWindow = previous && now - previous.windowStartedAt < PROPERTY_PHONE_SEND_WINDOW_MS;
  const state: PropertyPhoneState = {
    phone, sentAt: now,
    windowStartedAt: sameWindow ? previous.windowStartedAt : now,
    sendCount: sameWindow ? previous.sendCount + 1 : 1,
    attempts: 0, otpHash: digest(secret, userId, phone, "otp", code),
    otpExpiresAt: now + PROPERTY_PHONE_OTP_TTL_MS,
    proofHash: null, proofExpiresAt: 0, verifiedAt: null,
  };
  return { state, code };
}

export function verifyPropertyPhoneChallenge(input: {
  secret: string; userId: string; phone: string; code: string; state: PropertyPhoneState | null; now: number;
}): { state: PropertyPhoneState | null; error: string; proof?: never } | { state: PropertyPhoneState; error: null; proof: string } {
  const { secret, userId, phone, code, state, now } = input;
  if (!state || state.phone !== phone || !state.otpHash || state.otpExpiresAt <= now) {
    return { state, error: "The verification code expired or was already used. Request a new code." };
  }
  if (state.attempts >= PROPERTY_PHONE_MAX_ATTEMPTS) return { state, error: "Too many incorrect attempts. Request a new code." };
  const next = { ...state, attempts: state.attempts + 1 };
  if (!/^\d{6}$/.test(code) || !equalHash(state.otpHash, digest(secret, userId, phone, "otp", code))) {
    return { state: next, error: "Incorrect verification code. Check the code and try again." };
  }
  const proof = randomBytes(32).toString("hex");
  return {
    state: { ...next, otpHash: null, proofHash: digest(secret, userId, phone, "proof", proof), proofExpiresAt: now + PROPERTY_PHONE_PROOF_TTL_MS, verifiedAt: now },
    error: null, proof,
  };
}

export function validPropertyPhoneProof(input: {
  secret: string; userId: string; phone: string; proof: string; state: PropertyPhoneState | null; now: number;
}) {
  const { secret, userId, phone, proof, state, now } = input;
  return Boolean(state && state.phone === phone && state.verifiedAt !== null && state.proofHash && state.proofExpiresAt > now &&
    equalHash(state.proofHash, digest(secret, userId, phone, "proof", proof)));
}
