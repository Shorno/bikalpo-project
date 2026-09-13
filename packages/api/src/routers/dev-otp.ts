/**
 * OTP Retrieval Router
 *
 * Exposes an endpoint to fetch the simulated OTP for a given phone number
 * from the shared in-memory store. This enables the frontend to
 * auto-fill the OTP boxes.
 */
import { getOtp } from "@bikalpo-project/auth/otp-store";
import { z } from "zod";
import { publicProcedure } from "../index";

export const devOtpRouter = {
  get: publicProcedure
    .route({
      method: "GET",
      path: "/dev-otp/{phoneNumber}",
      tags: ["Dev"],
      summary: "Get stored OTP for a phone number",
    })
    .input(
      z.object({
        phoneNumber: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      const code = getOtp(input.phoneNumber);
      return { code };
    }),
};
