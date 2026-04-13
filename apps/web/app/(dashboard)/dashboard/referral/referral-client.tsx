"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Send,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-700",
  joined: "bg-yellow-100 text-yellow-700",
  subscribed: "bg-green-100 text-green-700",
  rewarded: "bg-emerald-100 text-emerald-700",
  fraud: "bg-red-100 text-red-700",
};

export function ReferralClient() {
  const queryClient = useQueryClient();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteUserType, setInviteUserType] = useState<"retailer" | "wholesaler" | "pending">("pending");
  const [page, setPage] = useState(1);

  // Get invite code
  const { data: codeData } = useQuery({
    ...orpc.userInvite.getMyInviteCode.queryOptions(),
  });

  // Get stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    ...orpc.userInvite.myStats.queryOptions(),
  });

  // Get referrals list
  const { data: referrals, isLoading: listLoading } = useQuery({
    ...orpc.userInvite.myReferrals.queryOptions({
      input: { page, limit: 10 },
    }),
  });

  // Send invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: (params: { phone: string; userType: "retailer" | "wholesaler" | "pending" }) =>
      client.userInvite.sendInvite(params),
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.info("You already invited this number");
      } else {
        toast.success("Invite sent successfully!");
      }
      queryClient.invalidateQueries();
      setShowInviteDialog(false);
      setInvitePhone("");
      setInviteUserType("pending");
    },
    onError: (error) => toast.error(error.message || "Failed to send invite"),
  });

  const inviteCode = codeData?.inviteCode || "...";
  const inviteLink = `https://bikalpo.com/join?ref=${inviteCode}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const items = referrals?.items ?? [];
  const totalPages = referrals?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Referrals</h1>
        <p className="text-muted-foreground">
          Invite friends & earn rewards when they subscribe
        </p>
      </div>

      {/* Invite Code Card */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Your Invite Code
              </p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono tracking-wider">
                  {inviteCode}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(inviteCode, "Invite code")}
                >
                  <Copy className="size-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(inviteLink, "Invite link")}
              >
                <Link2 className="size-4 mr-1" />
                Copy Link
              </Button>
              <Button onClick={() => setShowInviteDialog(true)}>
                <Send className="size-4 mr-1" />
                Invite by Phone
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              People Invited
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.totalInvites ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Joined</CardTitle>
            <UserCheck className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? "..." : stats?.joined ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
            <CheckCircle2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? "..." : stats?.subscribed ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Earnings
            </CardTitle>
            <Wallet className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ৳{statsLoading ? "..." : stats?.totalEarnings ?? 0}
            </div>
            {stats && stats.walletBalance > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Wallet: ৳{stats.walletBalance}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex items-start gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Share your code</p>
                <p className="text-xs text-muted-foreground">
                  Send invite to friends
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-sm">They join & subscribe</p>
                <p className="text-xs text-muted-foreground">
                  Using your referral code
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-sm">Earn rewards!</p>
                <p className="text-xs text-muted-foreground">
                  ৳100 retailer / ৳150 wholesaler
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Your Referrals</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Invited User</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-6 bg-muted animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.inviteCode}
                    </TableCell>
                    <TableCell>{item.invitedName || "-"}</TableCell>
                    <TableCell>{item.invitedPhone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.userType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserPlus className="size-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No referrals yet. Start inviting!
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog
        open={showInviteDialog}
        onOpenChange={(open) => !open && setShowInviteDialog(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite by Phone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="01XXXXXXXXX"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>User Type</Label>
              <Select
                value={inviteUserType}
                onValueChange={(val) => setInviteUserType(val as "retailer" | "wholesaler" | "pending")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Auto-detect</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!invitePhone || sendInviteMutation.isPending}
              onClick={() =>
                sendInviteMutation.mutate({
                  phone: invitePhone,
                  userType: inviteUserType,
                })
              }
            >
              {sendInviteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
