import { auth } from "@bikalpo-project/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
  realtime?: OpenOrderRealtimePublisher;
};

export interface OpenOrderRealtimePublisher {
  emitToShop(shopId: string, event: string, payload: unknown): void;
  emitToOrder(orderId: number, event: string, payload: unknown): void;
}

const noopRealtimePublisher: OpenOrderRealtimePublisher = {
  emitToShop: () => undefined,
  emitToOrder: () => undefined,
};

export async function createContext({
  context,
  realtime,
}: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    realtime: realtime ?? noopRealtimePublisher,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
