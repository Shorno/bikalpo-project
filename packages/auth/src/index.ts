import { expo } from "@better-auth/expo";
import { db } from "@bikalpo-project/db";
import * as schema from "@bikalpo-project/db/schema";
import { env } from "@bikalpo-project/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin as adminPlugin, bearer, openAPI, phoneNumber } from "better-auth/plugins";
import { storeOtp } from "./otp-store";
import {
  getPasswordPolicyError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordValidation,
} from "./password-policy";
import { ac, admin as adminRole, consumer, deliveryman, salesman, shop_owner, warehouse } from "./permissions";
import {
  getPhoneAuthEmail,
  normalizeBangladeshPhoneNumber,
} from "./phone-identity";

const isProduction = env.NODE_ENV === "production";
const passwordFieldByPath = new Map<string, "password" | "newPassword">([
  ["/sign-up/email", "password"],
  ["/change-password", "newPassword"],
  ["/reset-password", "newPassword"],
  ["/phone-number/reset-password", "newPassword"],
]);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  plugins: [
    expo(),
    bearer(), // Enables Bearer token auth for API testing
    openAPI(), // Enables /auth/reference for API testing
    adminPlugin({
      ac,
      roles: {
        consumer,
        shop_owner,
        admin: adminRole,
        salesman,
        deliveryman,
        warehouse,
      },
      defaultRole: "consumer",
    }),
    phoneNumber({
      otpLength: 6,
      phoneNumberValidator: (phone) =>
        normalizeBangladeshPhoneNumber(phone) !== null,
      sendOTP: ({ phoneNumber: phone, code }) => {
        storeOtp(phone, code);
        console.log(`[OTP] Phone: ${phone} → Code: ${code}`);
      },
      signUpOnVerification: {
        getTempEmail: getPhoneAuthEmail,
        getTempName: (phone) => phone,
      },
    }),
  ],
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: false,
        input: false,
      },
      // Shop owner capability flags (set by admin on approval)
      isSeller: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      sellerStatus: {
        type: "string",
        required: false,
      },
      businessType: {
        type: "string",
        required: false,
      },
      shopAddress: {
        type: "string",
        required: false,
      },
      ownerName: {
        type: "string",
        required: false,
      },
      // === B2B + B2C Shop Owner fields ===
      shopName: {
        type: "string",
        required: false,
      },
      shopSlug: {
        type: "string",
        required: false,
      },
      shopLogo: {
        type: "string",
        required: false,
      },
      shopOpeningTime: {
        type: "string",
        required: false,
      },
      shopClosingTime: {
        type: "string",
        required: false,
      },
      canAcceptOpenOrder: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      pendingOtpCount: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      serviceArea: {
        type: "string",
        required: false,
      },
      warehouseId: {
        type: "string",
        required: false,
      },
      shopId: {
        type: "string",
        required: false,
      },
      // === Warehouse fields ===
      warehouseName: {
        type: "string",
        required: false,
      },
      warehouseSlug: {
        type: "string",
        required: false,
      },
      warehouseAddress: {
        type: "string",
        required: false,
      },
      // === Location coordinates ===
      shopLat: {
        type: "string",
        required: false,
      },
      shopLng: {
        type: "string",
        required: false,
      },
      warehouseLat: {
        type: "string",
        required: false,
      },
      warehouseLng: {
        type: "string",
        required: false,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
    },
    useSecureCookies: isProduction,
    crossSubDomainCookies: {
      enabled: true,
      domain: env.COOKIE_DOMAIN,
    },
  },
  trustedOrigins: [
    ...env.CORS_ORIGINS,
    env.BETTER_AUTH_URL,
    "mybettertapp://",
    ...(env.NODE_ENV === "development"
      ? [
          "exp://",
          "exp://**",
          "exp://192.168.*.*:*/**",
          "http://localhost:8081",
          "http://delivery.bikalpo.localhost:3001",
          "http://sales.bikalpo.localhost:3001",
        ]
      : []),
  ].filter(Boolean) as string[],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const passwordField = passwordFieldByPath.get(ctx.path);
      if (!passwordField) return;

      const body = ctx.body as Record<string, unknown> | undefined;
      const policyError = getPasswordPolicyError(body?.[passwordField]);
      if (policyError) {
        throw APIError.from("BAD_REQUEST", {
          code: "PASSWORD_POLICY_FAILED",
          message: policyError,
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const domain = env.COOKIE_DOMAIN || ".localhost";

      // Set role cookie after sign-in, sign-up, or phone verification
      if (ctx.path.startsWith("/sign-in") || ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/phone-number/verify")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const user = newSession.user as { role?: string };
          const role = user.role || "consumer";

          ctx.setCookie("user-role", role, {
            path: "/",
            domain: domain,
            maxAge: 60 * 60 * 24 * 7, // 7 days
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction,
          });
        }
      }

      // Clear role cookie on sign-out
      if (ctx.path.startsWith("/sign-out")) {
        ctx.setCookie("user-role", "", {
          path: "/",
          domain: domain,
          maxAge: 0,
          sameSite: isProduction ? "none" : "lax",
          secure: isProduction,
        });
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

export async function setCredentialPassword(
  userId: string,
  newPassword: string,
) {
  const password = passwordValidation.parse(newPassword);
  const context = await auth.$context;
  const hashedPassword = await context.password.hash(password);
  const accounts = await context.internalAdapter.findAccounts(userId);
  const credentialAccount = accounts.find(
    (account) => account.providerId === "credential",
  );

  if (credentialAccount) {
    await context.internalAdapter.updatePassword(userId, hashedPassword);
    return;
  }

  await context.internalAdapter.createAccount({
    userId,
    providerId: "credential",
    password: hashedPassword,
    accountId: userId,
  });
}

// Re-export permissions for client usage
export { ac, admin as adminRole, consumer, deliveryman, salesman, shop_owner, warehouse } from "./permissions";
