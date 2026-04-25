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
    console.log("orpc fetch", { url, backend: env.NEXT_PUBLIC_SERVER_URL });
    try {
      return await fetch(url, {
        ...options,
        credentials: "include",
      });
    } catch (error: any) {
      // Ignore abort errors — caused by React Strict Mode double-mount or navigation cancellation
      if (error?.name === "AbortError" || error instanceof DOMException) {
        throw error;
      }
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
    if (typeof window !== "undefined") {
      return {};
    }

    const { headers } = await import("next/headers");
    return Object.fromEntries(await headers());
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
