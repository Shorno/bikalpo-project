"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "@/env";

// ─── Types (mirrors server events) ───

export interface BroadcastData {
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
}

export interface BidLockedData {
    subOrderId: number;
    bidId: number;
    shopName: string;
    shopDistance: number;
    expiresAt: string;
}

export interface BidSubmittedData {
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
}

export interface BidReleasedData {
    subOrderId: number;
    bidId: number;
    shopName: string;
}

export interface BidExpiredData {
    subOrderId: number;
    bidId: number;
}

export interface WinnerSelectedData {
    subOrderId: number;
    parentOrderId: number;
    bidId: number;
    shopId: string;
    shopName: string;
    totalBid: string;
    deliveryCharge: string;
}

export interface NoOffersData {
    subOrderId: number;
    parentOrderId: number;
    message: string;
}

// ─── Singleton socket connection ───

let socketInstance: Socket | null = null;

function getSocket(): Socket {
    if (!socketInstance) {
        socketInstance = io(env.NEXT_PUBLIC_SERVER_URL, {
            withCredentials: true,
            transports: ["websocket", "polling"],
            autoConnect: false,
        });
    }
    return socketInstance;
}

// ─── Hook: useSocket (base connection) ───

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket>(getSocket());

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket.connected) {
            socket.connect();
        }

        function onConnect() {
            setIsConnected(true);
        }
        function onDisconnect() {
            setIsConnected(false);
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        // If already connected
        if (socket.connected) {
            setIsConnected(true);
        }

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, []);

    return { socket: socketRef.current, isConnected };
}

// ─── Hook: useOpenOrderSocket (consumer-side order tracking) ───

export function useOpenOrderSocket(orderId: number | null) {
    const { socket, isConnected } = useSocket();
    const [bidsLocked, setBidsLocked] = useState<BidLockedData[]>([]);
    const [bidsSubmitted, setBidsSubmitted] = useState<BidSubmittedData[]>([]);
    const [bidsReleased, setBidsReleased] = useState<BidReleasedData[]>([]);
    const [bidsExpired, setBidsExpired] = useState<BidExpiredData[]>([]);
    const [winners, setWinners] = useState<WinnerSelectedData[]>([]);
    const [noOffers, setNoOffers] = useState<NoOffersData[]>([]);

    useEffect(() => {
        if (!orderId || !isConnected) return;

        // Join order room
        socket.emit("join-order", orderId);

        const onBidLocked = (data: BidLockedData) => {
            setBidsLocked((prev) => [...prev, data]);
        };
        const onBidSubmitted = (data: BidSubmittedData) => {
            setBidsSubmitted((prev) => [...prev, data]);
        };
        const onBidReleased = (data: BidReleasedData) => {
            setBidsReleased((prev) => [...prev, data]);
        };
        const onBidExpired = (data: BidExpiredData) => {
            setBidsExpired((prev) => [...prev, data]);
        };
        const onWinnerSelected = (data: WinnerSelectedData) => {
            setWinners((prev) => [...prev, data]);
        };
        const onNoOffers = (data: NoOffersData) => {
            setNoOffers((prev) => [...prev, data]);
        };

        socket.on("open-order:bid-locked", onBidLocked);
        socket.on("open-order:bid-submitted", onBidSubmitted);
        socket.on("open-order:bid-released", onBidReleased);
        socket.on("open-order:bid-expired", onBidExpired);
        socket.on("open-order:winner-selected", onWinnerSelected);
        socket.on("open-order:no-offers", onNoOffers);

        return () => {
            socket.emit("leave-order", orderId);
            socket.off("open-order:bid-locked", onBidLocked);
            socket.off("open-order:bid-submitted", onBidSubmitted);
            socket.off("open-order:bid-released", onBidReleased);
            socket.off("open-order:bid-expired", onBidExpired);
            socket.off("open-order:winner-selected", onWinnerSelected);
            socket.off("open-order:no-offers", onNoOffers);
        };
    }, [orderId, isConnected, socket]);

    const reset = useCallback(() => {
        setBidsLocked([]);
        setBidsSubmitted([]);
        setBidsReleased([]);
        setBidsExpired([]);
        setWinners([]);
        setNoOffers([]);
    }, []);

    return {
        isConnected,
        bidsLocked,
        bidsSubmitted,
        bidsReleased,
        bidsExpired,
        winners,
        noOffers,
        reset,
    };
}

// ─── Hook: useShopBroadcastSocket (shop-side broadcast receiver) ───

export function useShopBroadcastSocket() {
    const { socket, isConnected } = useSocket();
    const [broadcasts, setBroadcasts] = useState<BroadcastData[]>([]);

    useEffect(() => {
        if (!isConnected) return;

        const onNewBroadcast = (data: BroadcastData) => {
            setBroadcasts((prev) => [...prev, data]);
        };

        socket.on("open-order:new-broadcast", onNewBroadcast);

        return () => {
            socket.off("open-order:new-broadcast", onNewBroadcast);
        };
    }, [isConnected, socket]);

    const clearBroadcast = useCallback((subOrderId: number) => {
        setBroadcasts((prev) => prev.filter((b) => b.subOrderId !== subOrderId));
    }, []);

    return { isConnected, broadcasts, clearBroadcast };
}
