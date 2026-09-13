import assert from "node:assert/strict";
import test from "node:test";
import { getDevelopmentOtp } from "./development-otp";

test(
  "production never requests an OTP from the development endpoint",
  { skip: process.env.NODE_ENV !== "production" },
  async () => {
    let requested = false;
    const code = await getDevelopmentOtp("+8801712345678", async () => {
      requested = true;
      return { code: "123456" };
    });

    assert.equal(requested, false);
    assert.equal(code, null);
  },
);
