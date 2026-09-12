import assert from "node:assert/strict";
import test from "node:test";

test("production never issues, verifies, or consumes a development-only property proof", { skip: process.env.NODE_ENV !== "production" }, async () => {
  const { requestPropertyPhoneCode, verifyPropertyPhoneCode, consumePropertyPhoneProof } = await import("./tolet-property-phone");
  const unavailable = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "SERVICE_UNAVAILABLE");
  await assert.rejects(requestPropertyPhoneCode("owner", "01712345678"), unavailable);
  await assert.rejects(verifyPropertyPhoneCode("owner", "01712345678", "123456"), unavailable);
  await assert.rejects(consumePropertyPhoneProof({} as Parameters<typeof consumePropertyPhoneProof>[0], "owner", "01712345678", "a".repeat(64)), unavailable);
});

test("production does not expose login OTP through the development endpoint", { skip: process.env.NODE_ENV !== "production" }, async () => {
  const [{ createRouterClient }, { devOtpRouter }] = await Promise.all([import("@orpc/server"), import("../routers/dev-otp")]);
  const client = createRouterClient(devOtpRouter, { context: { session: null } as unknown as import("../context").Context });
  await assert.rejects(client.get({ phoneNumber: "+8801712345678" }), error => Boolean(error && typeof error === "object" && "code" in error && error.code === "NOT_FOUND"));
});
