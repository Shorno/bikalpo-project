import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Point to the server's auth endpoint
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [adminClient(), inferAdditionalFields()],
});

// Re-export common auth hooks for convenience
export const { useSession, signIn, signUp, signOut } = authClient;
