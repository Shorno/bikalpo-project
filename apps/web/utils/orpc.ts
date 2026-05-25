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
    // Forward cookies on the server so server-component orpc calls are authenticated
    if (typeof window === "undefined") {
      try {
        const { headers: nextHeaders } = await import("next/headers");
        const headerStore = await nextHeaders();
        const cookie = headerStore.get("cookie");
        if (cookie) return { cookie };
      } catch { /* client-side or build-time */ }
    }
    return {};
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
