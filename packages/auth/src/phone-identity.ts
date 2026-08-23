const BANGLADESH_E164_PATTERN = /^\+8801[3-9]\d{8}$/;
const BANGLADESH_LOCAL_PATTERN = /^01[3-9]\d{8}$/;
const PHONE_AUTH_EMAIL_PATTERN = /^8801[3-9]\d{8}@bikalpo\.com$/i;

/** Normalize supported Bangladesh phone formats to the canonical auth identity. */
export function normalizeBangladeshPhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, "");

  if (BANGLADESH_E164_PATTERN.test(compact)) return compact;
  if (BANGLADESH_LOCAL_PATTERN.test(compact)) return `+88${compact}`;
  if (/^8801[3-9]\d{8}$/.test(compact)) return `+${compact}`;

  return null;
}

/** Build the deterministic placeholder email used by phone-only accounts. */
export function getPhoneAuthEmail(phoneNumber: string): string {
  const normalized = normalizeBangladeshPhoneNumber(phoneNumber);
  if (!normalized) {
    throw new Error("A valid Bangladesh phone number is required");
  }
  return `${normalized.slice(1)}@bikalpo.com`;
}

export function isPhoneAuthEmail(email: string): boolean {
  return PHONE_AUTH_EMAIL_PATTERN.test(email.trim());
}
