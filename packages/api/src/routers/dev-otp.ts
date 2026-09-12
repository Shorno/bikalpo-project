/**
 * OTP Retrieval Router
 *
 * Exposes a development-only endpoint to fetch the OTP for a given phone number
 * from the shared in-memory store. This enables the frontend to
 * auto-fill the OTP boxes.
 *
 * Never expose authentication codes from a production server.
 */
import { getOtp } from "@bikalpo-project/auth/otp-store";
import { env } from "@bikalpo-project/env/server";
import { ORPCError } from "@orpc/server";
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
      if (env.NODE_ENV !== "development") throw new ORPCError("NOT_FOUND");
      const code = getOtp(input.phoneNumber);
      return { code };
    }),
};
