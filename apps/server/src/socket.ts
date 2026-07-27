/**
 * Socket.IO server module for the Open Order System.
 *
 * Provides real-time WebSocket communication for:
 * - Broadcasting open orders to eligible shops
 * - Notifying consumers of bid updates
 * - Handling bid lifecycle events (lock, submit, release, expire, winner)
 *
 * Uses @socket.io/bun-engine for native Bun WebSocket support.
 */

import { isOpenOrderOwner } from "@bikalpo-project/api/services/open-order-matching";
import { auth } from "@bikalpo-project/auth";
import { Server as Engine } from "@socket.io/bun-engine";
import { Server } from "socket.io";

// ─── Types ───

export interface ServerToClientEvents {
  "open-order:new-request": (data: unknown) => void;
  "open-order:offer-received": (data: unknown) => void;
  "open-order:offer-updated": (data: unknown) => void;
  "open-order:offer-withdrawn": (data: unknown) => void;
  "open-order:offer-window-closed": (data: unknown) => void;
  "open-order:accepted": (data: unknown) => void;
  "open-order:not-selected": (data: unknown) => void;
  "open-order:cancelled": (data: unknown) => void;
  "open-order:expired": (data: unknown) => void;
  /** New open order broadcast available for this shop */
  "open-order:new-broadcast": (data: {
    subOrderId: number;
    parentOrderId: number;
    orderNumber: string;
    subOrderLabel: string;
    items: Array<{
      orderItemId: number;
      productName: string;
      productImage: string;
      productSize: string;
      quantity: number;
      platformPrice: string;
    }>;
    consumerDistance: number;
    broadcastExpiresAt: string;
  }) => void;

  /** A shop locked a bid (consumer sees this) */
  "open-order:bid-locked": (data: {
    subOrderId: number;
    bidId: number;
    shopName: string;
    shopDistance: number;
    expiresAt: string;
  }) => void;

  /** A shop submitted their offer (consumer sees this) */
  "open-order:bid-submitted": (data: {
    subOrderId: number;
    bidId: number;
    shopName: string;
    shopDistance: number;
    totalBid: string;
    deliveryCharge: string;
    items: Array<{
      orderItemId: number;
      sellerPrice: string;
    }>;
  }) => void;

  /** A shop released their lock (consumer sees this) */
  "open-order:bid-released": (data: {
    subOrderId: number;
    bidId: number;
    shopName: string;
  }) => void;

  /** A bid expired due to timeout */
  "open-order:bid-expired": (data: {
    subOrderId: number;
    bidId: number;
  }) => void;

  /** Winning bid selected for a sub-order */
  "open-order:winner-selected": (data: {
    subOrderId: number;
    parentOrderId: number;
    bidId: number;
    shopId: string;
    shopName: string;
    totalBid: string;
    deliveryCharge: string;
  }) => void;

  /** No offers received for sub-order — cancelled */
  "open-order:no-offers": (data: {
    subOrderId: number;
    parentOrderId: number;
    message: string;
  }) => void;
}

export interface ClientToServerEvents {
  /** Consumer joins their order's room to receive bid updates */
  "join-order": (orderId: number) => void;
  /** Leave an order room */
  "leave-order": (orderId: number) => void;
}

interface SocketData {
  userId: string;
  role: string;
  shopName: string | null;
}

// ─── Socket.IO Server Setup ───

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>();
const engine = new Engine();
io.bind(engine);

// ─── Auth Middleware ───

io.use(async (socket, next) => {
  try {
    // Extract cookies from handshake headers
    const cookieHeader =
      socket.handshake.headers.cookie || socket.handshake.auth?.cookie || "";

    if (!cookieHeader) {
      return next(new Error("No authentication cookie"));
    }

    // Build a minimal Headers object with the cookie for better-auth
    const headers = new Headers();
    headers.set("cookie", cookieHeader);

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return next(new Error("Invalid session"));
    }

    // Attach user data to socket
    socket.data.userId = session.user.id;
    socket.data.role = (session.user as any).role ?? "customer";
    socket.data.shopName = (session.user as any).shopName ?? null;

    next();
  } catch (err) {
    console.error("[Socket.IO] Auth error:", err);
    next(new Error("Authentication failed"));
  }
});

// ─── Connection Handler ───

io.on("connection", (socket) => {
  const { userId, role, shopName } = socket.data;
  console.log(
    `[Socket.IO] Connected: ${userId} (${role})${shopName ? ` — ${shopName}` : ""}`,
  );

  // Auto-join shop room for shop owners
  if (role === "shop_owner") {
    socket.join(`shop:${userId}`);
    console.log(`[Socket.IO] Shop ${userId} joined room shop:${userId}`);
  }

  // Consumer joins their order room
  socket.on("join-order", async (orderId) => {
    if (!Number.isInteger(orderId) || role !== "consumer") return;
    if (!(await isOpenOrderOwner(orderId, userId))) return;
    const room = `order:${orderId}`;
    await socket.join(room);
    console.log(`[Socket.IO] ${userId} joined owned room ${room}`);
  });

  socket.on("leave-order", (orderId) => {
    socket.leave(`order:${orderId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Disconnected: ${userId} — ${reason}`);
  });
});

// ─── Exports ───

/** The Socket.IO server instance — used by API handlers to emit events */
export { io };

/** API-facing realtime port; keeps Socket.IO out of the domain/API package. */
export const openOrderRealtime = {
  emitToShop(shopId: string, event: string, payload: unknown) {
    (io.to(`shop:${shopId}`) as any).emit(event, payload);
  },
  emitToOrder(orderId: number, event: string, payload: unknown) {
    (io.to(`order:${orderId}`) as any).emit(event, payload);
  },
};

/** The Bun engine — needed for Bun.serve() integration */
export { engine };

/** Helper: get the Bun websocket handler from the engine */
export function getWebSocketHandler() {
  return engine.handler();
}
