import { expo } from "@better-auth/expo";
import { db } from "@bikalpo-project/db";
import * as schema from "@bikalpo-project/db/schema";
import { env } from "@bikalpo-project/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin as adminPlugin } from "better-auth/plugins";
import { ac, admin as adminRole, customer, guest } from "./permissions";

const isProduction = env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    expo(),
    adminPlugin({
      ac,
      roles: {
        guest,
        customer,
        admin: adminRole,
      },
      defaultRole: "guest",
    }),
  ],
  user: {
    additionalFields: {
      shopName: {
        type: "string",
        required: false,
        input: true,
      },
      ownerName: {
        type: "string",
        required: false,
        input: true,
      },
      phoneNumber: {
        type: "string",
        required: false,
        input: true,
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
    env.CORS_ORIGIN,
    env.BETTER_AUTH_URL,
    "mybettertapp://",
    ...(env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
      : []),
  ].filter(Boolean) as string[],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const domain = env.COOKIE_DOMAIN || ".localhost";

      // Set role cookie after sign-in or sign-up
      if (ctx.path.startsWith("/sign-in") || ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const user = newSession.user as { role?: string };
          const role = user.role || "guest";

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

// Re-export permissions for client usage
export { ac, admin as adminRole, customer, guest } from "./permissions";
