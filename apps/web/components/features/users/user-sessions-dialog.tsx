"use client";

import {
  Clock,
  Globe,
  LogOut,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  revokeAllUserSessions,
  revokeUserSession,
} from "@/app/(dashboard)/dashboard/admin/_actions/users/user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Session, UserWithSessions } from "./types";

interface UserSessionsDialogProps {
  user: UserWithSessions;
  children: React.ReactNode;
  currentSessionId?: string;
}

// Parse user agent to extract device info
function parseUserAgent(userAgent: string | null): {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet";
} {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", deviceType: "desktop" };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)
  ) {
    deviceType = "mobile";
  }

  // Detect browser
  let browser = "Unknown";
  if (ua.includes("edg/")) {
    browser = "Edge";
  } else if (ua.includes("chrome") && !ua.includes("edg/")) {
    browser = "Chrome";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
  } else if (ua.includes("opera") || ua.includes("opr/")) {
    browser = "Opera";
  }

  // Detect OS
  let os = "Unknown";
  if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("mac os") || ua.includes("macos")) {
    os = "macOS";
  } else if (ua.includes("linux") && !ua.includes("android")) {
    os = "Linux";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS";
  }

  return { browser, os, deviceType };
}

// Format time ago (for past dates like createdAt)
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Format time until (for future dates like expiresAt)
function formatTimeUntil(date: Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = targetDate.getTime() - now.getTime();

  // If already expired
  if (diffMs <= 0) {
    return "Expired";
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays < 7) return `in ${diffDays}d`;
  return targetDate.toLocaleDateString();
}

// Check if session is expired
function isExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}

function DeviceIcon({
  deviceType,
}: {
  deviceType: "desktop" | "mobile" | "tablet";
}) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />;
    case "tablet":
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

function SessionCard({
  session,
  onRevoke,
  isCurrent,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  isCurrent?: boolean;
}) {
  const { browser, os, deviceType } = parseUserAgent(session.userAgent);
  const expired = isExpired(session.expiresAt);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      await revokeUserSession(session.id);
      onRevoke(session.id);
      toast.success("Session revoked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke session",
      );
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-4 ${isCurrent ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${isCurrent ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted"}`}
      >
        <DeviceIcon deviceType={deviceType} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {browser} on {os}
          </span>
          {isCurrent && (
            <Badge className="bg-green-600 text-white text-xs">Current</Badge>
          )}
          <Badge
            variant={expired ? "destructive" : "default"}
            className="text-xs"
          >
            {expired ? "Expired" : "Active"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {session.ipAddress && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.ipAddress}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {formatTimeAgo(new Date(session.createdAt))}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Expires {formatTimeUntil(new Date(session.expiresAt))}
          </span>
        </div>
      </div>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleRevoke}
          disabled={isRevoking}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function UserSessionsDialog({
  user,
  children,
  currentSessionId,
}: UserSessionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(user.sessions);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const handleSessionRevoked = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleRevokeAll = async () => {
    setIsRevokingAll(true);
    try {
      await revokeAllUserSessions(user.id);
      setSessions([]);
      toast.success("All sessions revoked");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to revoke all sessions",
      );
    } finally {
      setIsRevokingAll(false);
    }
  };

  const activeSessions = sessions.filter((s) => !isExpired(s.expiresAt));
  const expiredSessions = sessions.filter((s) => isExpired(s.expiresAt));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sessions for {user.name || user.email}</DialogTitle>
          <DialogDescription>
            Manage active sessions and devices for this user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">No active sessions</p>
            </div>
          ) : (
            <>
              {activeSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Active Sessions ({activeSessions.length})
                    </h4>
                    {activeSessions.length > 1 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRevokeAll}
                        disabled={isRevokingAll}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Revoke All
                      </Button>
                    )}
                  </div>
                  {activeSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRevoke={handleSessionRevoked}
                      isCurrent={session.id === currentSessionId}
                    />
                  ))}
                </div>
              )}

              {expiredSessions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Expired Sessions ({expiredSessions.length})
                  </h4>
                  {expiredSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRevoke={handleSessionRevoked}
                      isCurrent={session.id === currentSessionId}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
