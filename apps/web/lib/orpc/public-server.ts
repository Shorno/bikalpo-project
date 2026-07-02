import type { AppRouterClient } from "@bikalpo-project/api/routers/index";
import { env } from "@bikalpo-project/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export function getPublicOrpcClient(revalidate: number): AppRouterClient {
  const link = new RPCLink({
    url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
    async fetch(request, init, _options, path) {
      const requestInfo = {
        method: request.method,
        url: request.url,
        path: path.join("."),
      };

      try {
        const response = await fetch(request, {
          ...init,
          cache: "force-cache",
          next: { revalidate },
        });
        if (!response.ok) {
          const errText = await response.clone().text();
          console.error("orpc public response error", {
            ...requestInfo,
            status: response.status,
            body: errText.substring(0, 500),
          });
        }
        return response;
      } catch (error: any) {
        console.error("orpc public fetch failed", { ...requestInfo, error });
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
