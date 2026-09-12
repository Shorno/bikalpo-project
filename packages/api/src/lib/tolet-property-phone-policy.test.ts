import assert from "node:assert/strict";
import test from "node:test";
import {
  createPropertyPhoneChallenge, propertyPhoneSendError, PROPERTY_PHONE_MAX_ATTEMPTS,
  PROPERTY_PHONE_OTP_TTL_MS, PROPERTY_PHONE_PROOF_TTL_MS, PROPERTY_PHONE_RESEND_MS,
  PROPERTY_PHONE_SEND_WINDOW_MS, validPropertyPhoneProof, verifyPropertyPhoneChallenge,
  type PropertyPhoneState,
} from "./tolet-property-phone-policy";

const owner = { secret: "property-phone-unit-test-only-secret", userId: "owner-one", phone: "+8801712345678", now: Date.parse("2026-09-12T00:00:00Z") };
const challenge = () => createPropertyPhoneChallenge({ ...owner, previous: null });
function verified() {
  const c = challenge();
  const result = verifyPropertyPhoneChallenge({ ...owner, ...c });
  assert.equal(result.error, null);
  return result;
}

test("challenge uses six random digits and stores only keyed hash", () => {
  const { code, state } = challenge();
  assert.match(code, /^\d{6}$/);
  assert.match(state.otpHash!, /^[a-f0-9]{64}$/);
  assert.notEqual(state.otpHash, code);
  assert.equal(state.otpExpiresAt, owner.now + PROPERTY_PHONE_OTP_TTL_MS);
});
test("arbitrary six-digit code is not verification", () => {
  const c = challenge();
  const wrong = c.code === "000000" ? "999999" : "000000";
  const result = verifyPropertyPhoneChallenge({ ...owner, state: c.state, code: wrong });
  assert.notEqual(result.error, null);
  assert.equal(result.state?.attempts, 1);
  assert.equal(result.state?.proofHash, null);
});
test("code is bound to requesting user", () => {
  const c = challenge();
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, ...c, userId: "another-owner" }).error, null);
});
test("code is bound to exact normalized contact", () => {
  const c = challenge();
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, ...c, phone: "+8801812345678" }).error, null);
});
test("expired code cannot produce proof", () => {
  const c = challenge();
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, ...c, now: c.state.otpExpiresAt }).error, null);
});
test("correct code cannot bypass maximum failed attempts", () => {
  const c = challenge();
  let state: PropertyPhoneState | null = c.state;
  for (let i = 0; i < PROPERTY_PHONE_MAX_ATTEMPTS; i++) {
    state = verifyPropertyPhoneChallenge({ ...owner, state, code: "000000" }).state;
  }
  assert.equal(state?.attempts, 5);
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, state, code: c.code }).error, null);
});
test("correct code produces expiring opaque proof and consumes code", () => {
  const c = challenge();
  const result = verifyPropertyPhoneChallenge({ ...owner, ...c });
  assert.equal(result.error, null);
  if (result.error !== null) return;
  assert.match(result.proof, /^[a-f0-9]{64}$/);
  assert.equal(result.state.otpHash, null);
  assert.equal(result.state.proofExpiresAt, owner.now + PROPERTY_PHONE_PROOF_TTL_MS);
  assert.equal(validPropertyPhoneProof({ ...owner, ...result }), true);
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, code: c.code, state: result.state }).error, null);
});
test("proof cannot be forged, reassigned to another account or number", () => {
  const result = verified();
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, proof: "0".repeat(64) }), false);
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, userId: "another-owner" }), false);
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, phone: "+8801812345678" }), false);
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, secret: "changed-secret" }), false);
});
test("proof expires exactly at TTL and consumed proof cannot be replayed", () => {
  const result = verified();
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, now: result.state.proofExpiresAt }), false);
  assert.equal(validPropertyPhoneProof({ ...owner, ...result, state: { ...result.state, proofHash: null } }), false);
});
test("resend clears old proof even when another phone is requested", () => {
  const result = verified();
  const next = createPropertyPhoneChallenge({ ...owner, phone: "+8801812345678", previous: result.state, now: owner.now + PROPERTY_PHONE_RESEND_MS });
  assert.equal(next.state.proofHash, null);
  assert.equal(next.state.sendCount, 2);
  assert.equal(validPropertyPhoneProof({ ...owner, proof: result.proof, state: next.state }), false);
});
test("resend cooldown and hourly cap apply across phone changes", () => {
  const { state } = challenge();
  assert.notEqual(propertyPhoneSendError(state, owner.now + 59_999), null);
  assert.equal(propertyPhoneSendError(state, owner.now + 60_000), null);
  assert.notEqual(propertyPhoneSendError({ ...state, sendCount: 5 }, owner.now + 60_000), null);
  assert.equal(propertyPhoneSendError({ ...state, sendCount: 5 }, owner.now + PROPERTY_PHONE_SEND_WINDOW_MS), null);
});
test("new hourly window resets quota; missing challenges never verify", () => {
  const { state } = challenge();
  assert.equal(createPropertyPhoneChallenge({ ...owner, previous: { ...state, sendCount: 5 }, now: owner.now + PROPERTY_PHONE_SEND_WINDOW_MS }).state.sendCount, 1);
  assert.notEqual(verifyPropertyPhoneChallenge({ ...owner, state: null, code: "123456" }).error, null);
  assert.equal(validPropertyPhoneProof({ ...owner, state: null, proof: "a".repeat(64) }), false);
});
