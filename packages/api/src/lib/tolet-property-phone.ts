import { createHash } from "node:crypto";
import { normalizeBangladeshPhoneNumber } from "@bikalpo-project/auth/phone-identity";
import { db } from "@bikalpo-project/db";
import { verification } from "@bikalpo-project/db/schema";
import { env } from "@bikalpo-project/env/server";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import {
  createPropertyPhoneChallenge, propertyPhoneSendError, PROPERTY_PHONE_SEND_WINDOW_MS,
  type PropertyPhoneState, validPropertyPhoneProof, verifyPropertyPhoneChallenge,
} from "./tolet-property-phone-policy";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function challengeId(userId: string) {
  return `tolet-property-phone:${createHash("sha256").update(userId).digest("hex")}`;
}

function normalizePhone(phone: string) {
  const normalized = normalizeBangladeshPhoneNumber(phone);
  if (!normalized) throw new ORPCError("BAD_REQUEST", { message: "Enter a valid Bangladesh mobile number." });
  return normalized;
}

async function readState(tx: Transaction, userId: string) {
  const id = challengeId(userId);
  // Serializes send, verification and proof consumption across server instances.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
  const [row] = await tx.select().from(verification).where(eq(verification.id, id)).limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  try { return JSON.parse(row.value) as PropertyPhoneState; } catch { return null; }
}

async function saveState(tx: Transaction, userId: string, state: PropertyPhoneState) {
  const id = challengeId(userId);
  const fields = {
    identifier: id, value: JSON.stringify(state), updatedAt: new Date(),
    expiresAt: new Date(Math.max(state.windowStartedAt + PROPERTY_PHONE_SEND_WINDOW_MS, state.proofExpiresAt, state.otpExpiresAt)),
  };
  await tx.insert(verification).values({ id, ...fields }).onConflictDoUpdate({ target: verification.id, set: fields });
}

function assertDeliveryConfigured() {
  // The incumbent auth callback only logs codes; it is NOT an SMS integration.
  // Fail closed until a real delivery adapter is configured. Never expose a code in production.
  if (env.NODE_ENV !== "development") throw new ORPCError("SERVICE_UNAVAILABLE", {
    message: "Property phone verification is unavailable until SMS delivery is configured. Please contact support.",
  });
}

export async function requestPropertyPhoneCode(userId: string, phone: string, database = db) {
  const normalizedPhone = normalizePhone(phone);
  assertDeliveryConfigured();
  return database.transaction(async (tx) => {
    const previous = await readState(tx, userId);
    const now = Date.now();
    const error = propertyPhoneSendError(previous, now);
    if (error) throw new ORPCError("TOO_MANY_REQUESTS", { message: error });
    const { state, code } = createPropertyPhoneChallenge({ secret: env.BETTER_AUTH_SECRET, userId, phone: normalizedPhone, previous, now });
    await saveState(tx, userId, state);
    return { phone: normalizedPhone, expiresAt: new Date(state.otpExpiresAt).toISOString(), developmentCode: code, delivery: "development" as const };
  });
}

export async function verifyPropertyPhoneCode(userId: string, phone: string, code: string, database = db) {
  assertDeliveryConfigured();
  const normalizedPhone = normalizePhone(phone);
  // Return the failed result from the transaction before throwing: incorrect-attempt counts must commit.
  const result = await database.transaction(async (tx) => {
    const state = await readState(tx, userId);
    const verified = verifyPropertyPhoneChallenge({ secret: env.BETTER_AUTH_SECRET, userId, phone: normalizedPhone, code, state, now: Date.now() });
    if (verified.state) await saveState(tx, userId, verified.state);
    return verified;
  });
  if (result.error !== null) throw new ORPCError("BAD_REQUEST", { message: result.error });
  return { phone: normalizedPhone, proof: result.proof, expiresAt: new Date(result.state.proofExpiresAt).toISOString() };
}

/** Must run inside the property write transaction, so failures do not consume the proof. */
export async function consumePropertyPhoneProof(tx: Transaction, userId: string, phone: string, proof: string) {
  assertDeliveryConfigured();
  const normalizedPhone = normalizePhone(phone);
  const state = await readState(tx, userId);
  if (!validPropertyPhoneProof({ secret: env.BETTER_AUTH_SECRET, userId, phone: normalizedPhone, proof, state, now: Date.now() }) || !state) {
    throw new ORPCError("FORBIDDEN", { message: "Verify this property contact number again before saving. The verification may have expired." });
  }
  await saveState(tx, userId, { ...state, proofHash: null, proofExpiresAt: 0 });
  return new Date(state.verifiedAt!);
}
