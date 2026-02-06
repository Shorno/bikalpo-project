import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@bikalpo-project/auth";
import { ac, adminRole, customer, guest } from "@bikalpo-project/auth";

export const authClient = createAuthClient({
  // Point to the server's auth endpoint
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    adminClient({
      ac,
      roles: {
        guest,
        customer,
        admin: adminRole,
      },
    }),
    inferAdditionalFields<typeof auth>(),
  ],
});

// Re-export common auth hooks for convenience
export const { useSession, signIn, signUp, signOut } = authClient;
