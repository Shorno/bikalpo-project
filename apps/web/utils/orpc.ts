import type { AppRouterClient } from "@bikalpo-project/api/routers/index";

import { env } from "@bikalpo-project/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (typeof window !== "undefined") {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: query.invalidate,
          },
        });
      }
    },
  }),
});

export const link = new RPCLink({
  url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
  async fetch(url, options: RequestInit | undefined) {
    const bodyStr = typeof options?.body === 'string' ? options.body : '';
    console.log("orpc fetch →", { url, body: bodyStr.substring(0, 500) });
    try {
      const response = await fetch(url, {
        ...options,
        credentials: "include",
      });
      if (!response.ok) {
        const errText = await response.clone().text();
        console.error("orpc response error", { status: response.status, url, body: errText.substring(0, 500) });
      }
      return response;
    } catch (error: any) {
      console.error("orpc fetch failed", { error, url });
      if (error?.cause?.code === "ECONNREFUSED") {
        // During build / prerender when backend is not available, return a graceful 503.
        return new Response(null, {
          status: 503,
          statusText: "Backend unavailable",
        });
      }
      throw error;
    }
  },
  headers: async () => {
    // For now, always return empty headers to test if next/headers is crashing the client
    return {};
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
