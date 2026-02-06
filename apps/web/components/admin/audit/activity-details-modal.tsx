"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Mail,
  Monitor,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { getAuditActivityDetail } from "@/actions/admin/audit-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityDetailsModalProps {
  logId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ActivityDetailsModal({
  logId,
  open,
  onClose,
}: ActivityDetailsModalProps) {
  const { data: result, isLoading } = useQuery({
    queryKey: ["audit-activity-detail", logId],
    queryFn: () => getAuditActivityDetail(logId!),
    enabled: !!logId && open,
  });

  const activity = result?.activity;

  const handleExport = () => {
    if (!activity) return;

    const content = `
Audit Activity Report
=====================

Log ID: ${activity.logId}
Timestamp: ${new Date(activity.timestamp).toLocaleString()}

User Information:
-----------------
Name: ${activity.userName}
Email: ${activity.userEmail}
Role: ${activity.userRole}
Account Status: ${activity.accountStatus}

Activity Information:
---------------------
Action: ${activity.action}
Module: ${activity.module}
Description: ${activity.description}
Status: ${activity.status}

Session Context:
----------------
Session ID: ${activity.sessionId || "N/A"}
Session Active: ${activity.sessionActive ? "Yes" : "No"}
Session Start: ${activity.sessionStartTime ? new Date(activity.sessionStartTime).toLocaleString() : "N/A"}
Session End: ${activity.sessionEndTime ? new Date(activity.sessionEndTime).toLocaleString() : "Active"}
Device Type: ${activity.deviceType || "N/A"}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-activity-${activity.logId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity Details</DialogTitle>
          <DialogDescription>
            Detailed information about this system activity
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : activity ? (
          <div className="space-y-6">
            {/* User Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </h3>
              <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{activity.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <Badge variant="secondary" className="mt-1">
                    {activity.userRole?.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </p>
                  <p className="font-medium">{activity.userEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Account Status
                  </p>
                  <Badge
                    variant={
                      activity.accountStatus === "active"
                        ? "default"
                        : activity.accountStatus === "blocked"
                          ? "destructive"
                          : "secondary"
                    }
                    className="mt-1"
                  >
                    {activity.accountStatus === "active" && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {activity.accountStatus === "blocked" && (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {activity.accountStatus === "pending" && (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {activity.accountStatus.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Activity Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Information
              </h3>
              <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Action Type</p>
                  <Badge variant="outline" className="mt-1">
                    {activity.action.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Module</p>
                  <p className="font-medium capitalize">{activity.module}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Timestamp
                  </p>
                  <p className="font-medium">
                    {new Date(activity.timestamp).toLocaleString("en-US", {
                      dateStyle: "full",
                      timeStyle: "long",
                    })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{activity.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      activity.status === "success"
                        ? "default"
                        : activity.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="mt-1"
                  >
                    {activity.status === "success" && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {activity.status === "failed" && (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {activity.status === "warning" && (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {activity.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Session Context */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Session Context
              </h3>
              <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Session ID</p>
                  <p className="font-mono text-sm">
                    {activity.sessionId || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Session Status
                  </p>
                  <Badge
                    variant={activity.sessionActive ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {activity.sessionActive ? "Active" : "Ended"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Device Type</p>
                  <p className="font-medium capitalize">
                    {activity.deviceType || "N/A"}
                  </p>
                </div>
                {activity.sessionStartTime && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Session Start
                    </p>
                    <p className="text-sm">
                      {new Date(activity.sessionStartTime).toLocaleString()}
                    </p>
                  </div>
                )}
                {activity.sessionEndTime && (
                  <div>
                    <p className="text-sm text-muted-foreground">Session End</p>
                    <p className="text-sm">
                      {new Date(activity.sessionEndTime).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Activity
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Activity not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
