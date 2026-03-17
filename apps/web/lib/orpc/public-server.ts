import type { AppRouterClient } from "@bikalpo-project/api/routers/index";
import { env } from "@bikalpo-project/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export function getPublicOrpcClient(revalidate: number): AppRouterClient {
  const link = new RPCLink({
    url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
    async fetch(url, options) {
      try {
        return await fetch(url, {
          ...options,
          cache: "force-cache",
          next: { revalidate },
        });
      } catch (error: any) {
        if (error?.cause?.code === "ECONNREFUSED") {
          return new Response(null, {
            status: 503,
            statusText: "Backend unavailable",
          });
        }
        throw error;
      }
    },
    headers: async () => ({}),
  });

  return createORPCClient(link);
}
