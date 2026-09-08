"use client";

import { client } from "@/utils/orpc";

const STORAGE_KEY = "bikalpo:profile-document-cleanup";
const ACTIVE_SESSION_PREFIX = "bikalpo:profile-document-session:";
const ACTIVE_SESSION_LEASE_MS = 2 * 60 * 1000;
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

type CleanupEntry = {
  createdAt: number;
  publicId: string;
  sessionId: string | null;
  state: "abandoned" | "pending";
};

function readQueue() {
  if (typeof window === "undefined") return [] as CleanupEntry[];
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): CleanupEntry[] => {
      if (typeof item === "string") {
        return [
          {
            createdAt: 0,
            publicId: item,
            sessionId: null,
            state: "abandoned",
          },
        ];
      }
      if (
        !item ||
        typeof item !== "object" ||
        !("publicId" in item) ||
        typeof item.publicId !== "string"
      ) {
        return [];
      }
      return [
        {
          createdAt:
            "createdAt" in item && typeof item.createdAt === "number"
              ? item.createdAt
              : 0,
          publicId: item.publicId,
          sessionId:
            "sessionId" in item && typeof item.sessionId === "string"
              ? item.sessionId
              : null,
          state:
            "state" in item && item.state === "pending"
              ? "pending"
              : "abandoned",
        },
      ];
    });
  } catch {
    return [] as CleanupEntry[];
  }
}

function writeQueue(queue: CleanupEntry[]) {
  if (typeof window === "undefined") return;
  if (queue.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function activateProfileDocumentSession(sessionId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${ACTIVE_SESSION_PREFIX}${sessionId}`,
    String(Date.now()),
  );
}

export function releaseProfileDocumentSession(sessionId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${ACTIVE_SESSION_PREFIX}${sessionId}`);
}

function hasActiveProfileDocumentSession(sessionId: string | null) {
  if (!sessionId || typeof window === "undefined") return false;
  const lastSeen = Number(
    window.localStorage.getItem(`${ACTIVE_SESSION_PREFIX}${sessionId}`),
  );
  return (
    Number.isFinite(lastSeen) && Date.now() - lastSeen < ACTIVE_SESSION_LEASE_MS
  );
}

export function queueProfileDocumentCleanup(
  publicId: string,
  sessionId: string,
) {
  const queue = readQueue().filter((entry) => entry.publicId !== publicId);
  queue.push({
    createdAt: Date.now(),
    publicId,
    sessionId,
    state: "pending",
  });
  writeQueue(queue);
}

export function abandonProfileDocumentSession(sessionId: string) {
  releaseProfileDocumentSession(sessionId);
  writeQueue(
    readQueue().map((entry) =>
      entry.sessionId === sessionId ? { ...entry, state: "abandoned" } : entry,
    ),
  );
}

export function retainProfileDocument(publicId: string) {
  writeQueue(readQueue().filter((entry) => entry.publicId !== publicId));
}

export async function cleanupProfileDocument(publicId: string) {
  const queue = readQueue();
  const existing = queue.find((entry) => entry.publicId === publicId);
  writeQueue([
    ...queue.filter((entry) => entry.publicId !== publicId),
    {
      createdAt: existing?.createdAt ?? Date.now(),
      publicId,
      sessionId: existing?.sessionId ?? null,
      state: "abandoned",
    },
  ]);
  try {
    const result = await client.cloudinary.delete({ publicId });
    if (!result.success) return false;
    retainProfileDocument(publicId);
    return true;
  } catch {
    return false;
  }
}

export async function drainProfileDocumentCleanup() {
  const staleBefore = Date.now() - STALE_PENDING_MS;
  const publicIds = readQueue()
    .filter(
      (entry) =>
        entry.state === "abandoned" ||
        (entry.createdAt <= staleBefore &&
          !hasActiveProfileDocumentSession(entry.sessionId)),
    )
    .map((entry) => entry.publicId);
  if (publicIds.length === 0) return;
  await Promise.allSettled(publicIds.map(cleanupProfileDocument));
}
