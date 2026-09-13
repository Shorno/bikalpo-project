import assert from "node:assert/strict";
import test from "node:test";
import { getDevelopmentOtp } from "./development-otp";

test(
  "deployed development builds request the simulated OTP",
  { skip: process.env.NODE_ENV !== "production" },
  async () => {
    let requested = false;
    const code = await getDevelopmentOtp("+8801712345678", async () => {
      requested = true;
      return { code: "123456" };
    });

    assert.equal(requested, true);
    assert.equal(code, "123456");
  },
);
