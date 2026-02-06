import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { db } from "@/db/config";
import { ac, admin as adminRole, customer, guest } from "@/lib/permissions";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
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
      // 'lax' for HTTP development, 'none' for HTTPS production
      sameSite: isProduction ? "none" : "lax",
    },
    useSecureCookies: isProduction,
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    },
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL,
  ].filter(Boolean) as string[],

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || ".b2b.localhost";

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
