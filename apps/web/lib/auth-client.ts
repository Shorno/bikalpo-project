import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@bikalpo-project/auth";

export const authClient = createAuthClient({
  // Point to the server's auth endpoint
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [adminClient(), inferAdditionalFields<typeof auth>()],
});

