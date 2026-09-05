import type { auth } from "@bikalpo-project/auth";
import {
  ac,
  admin as adminRole,
  consumer,
  deliveryman,
  salesman,
  shop_owner,
  shop_staff,
  warehouse,
} from "@bikalpo-project/auth/permissions";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Point to the server's auth endpoint
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    adminClient({
      ac,
      roles: {
        consumer,
        shop_owner,
        admin: adminRole,
        salesman,
        deliveryman,
        shop_staff,
        warehouse,
      },
    }),
    inferAdditionalFields<typeof auth>(),
    phoneNumberClient(),
  ],
});
