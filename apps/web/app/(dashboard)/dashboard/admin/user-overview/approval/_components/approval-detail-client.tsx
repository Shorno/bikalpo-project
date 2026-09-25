"use client";

import { computeProfileCompletion } from "@bikalpo-project/api/business-profile";
import { userSubscriptionPlanName } from "@bikalpo-project/api/routers/helpers/user-subscription-plan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Loader2,
  SearchX,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { toApplicationDetail } from "@/components/features/admin/application-detail-sections";
import { KycVerifyDialog } from "@/components/features/admin/kyc-verify-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";
import { client, orpc } from "@/utils/orpc";
import {
  PerformanceContent,
  type UserDetailData,
} from "../../_components/user-detail-content";
import { UserDetailsLayout } from "../../_components/user-details-layout";
import { UserProfileHero } from "../../_components/user-profile-hero";

export type ApprovalType = "seller" | "warehouse";
const APPROVAL_LIST_URL = ADMIN_BASE + "/user-overview/approval";

export function ApprovalDetailClient({
  type,
  applicationId,
}: {
  type: ApprovalType;
  applicationId: string;
}) {
  const isWarehouse = type === "warehouse";
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const seller = useQuery({
    ...orpc.sellerApplication.getById.queryOptions({
      input: { applicationId },
    }),
    enabled: !isWarehouse,
  });
  const warehouse = useQuery({
    ...orpc.warehouseApplication.getById.queryOptions({
      input: { applicationId },
    }),
    enabled: isWarehouse,
  });
  const request = isWarehouse ? warehouse : seller;
  const application = request.data;
  const account = useQuery({
    ...orpc.adminUserManagement.getById.queryOptions({
      input: { userId: application?.userId || "" },
    }),
    enabled: Boolean(application?.userId),
  });
  const catalog = useQuery(
    orpc.adminRetailerSubscription.listPlans.queryOptions(),
  );
  const refresh = () => void queryClient.invalidateQueries();
  const decision = useMutation({
    mutationFn: (choice: "approve" | "reject") => {
      const input = { applicationId, adminNotes: notes.trim() || undefined };
      const api = isWarehouse
        ? client.warehouseApplication
        : client.sellerApplication;
      return choice === "approve" ? api.approve(input) : api.reject(input);
    },
    onSuccess: (_, choice) => {
      toast.success(
        choice === "approve" ? "Application approved" : "Application rejected",
      );
      refresh();
      setAction(null);
      setNotes("");
    },
    onError: (error) =>
      toast.error(error.message || "Could not update the request"),
  });
  const verify = useMutation({
    mutationFn: (userId: string) =>
      client.adminUserManagement.verify({
        userId,
        adminNotes: verifyNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("KYC verified");
      refresh();
      setVerifyOpen(false);
      setVerifyNotes("");
    },
    onError: (error) => toast.error(error.message || "Could not verify KYC"),
  });

  if (
    request.isPending ||
    (application && account.isPending) ||
    catalog.isPending
  ) {
    return (
      <div
        role="status"
        aria-label="Loading request details"
        className="space-y-6"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }
  if (
    request.isError ||
    account.isError ||
    catalog.isError ||
    !application ||
    !account.data ||
    !catalog.data
  ) {
    return (
      <div
        role="alert"
        className="flex min-h-80 flex-col items-center justify-center gap-4 text-center"
      >
        <SearchX className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">
          Could not load request details
        </h1>
        <p className="text-sm text-muted-foreground">
          {request.error?.message ||
            account.error?.message ||
            catalog.error?.message ||
            "Request not found."}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={APPROVAL_LIST_URL}>All Requests</Link>
          </Button>
          <Button
            disabled={
              request.isFetching || account.isFetching || catalog.isFetching
            }
            onClick={() => {
              void request.refetch();
              void catalog.refetch();
              if (application?.userId) void account.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Keep the selected request's snapshot, even if this user has a newer application.
  const record = application as unknown as Record<string, unknown>;
  const businessName = String(
    record[isWarehouse ? "warehouseName" : "shopName"] || application.ownerName,
  );
  const businessAddress = String(
    record[isWarehouse ? "warehouseAddress" : "shopAddress"] || "",
  );
  const detail = toApplicationDetail(record, businessAddress);
  const current = account.data;
  const hasBusinessAccount =
    current.user.role === (isWarehouse ? "warehouse" : "shop_owner");
  const subscription = hasBusinessAccount ? current.subscription : null;
  const planName = userSubscriptionPlanName(catalog.data, {
    selectedPlan: application.selectedPlan,
    subscription,
    trialFallback: isWarehouse,
  });
  const data: UserDetailData = {
    ...current,
    user: {
      ...current.user,
      shopLogo:
        !isWarehouse && hasBusinessAccount ? current.user.shopLogo : null,
    },
    planName,
    subscription: subscription ? { ...subscription, planName } : null,
    application: record,
    applicationId,
    applicationStatus: {
      type,
      status: application.status,
      appliedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
    },
    accountMeta: {
      ...current.accountMeta,
      profileCompletion: computeProfileCompletion(record, current.user),
    },
    lastReview: application.reviewedAt
      ? {
          notes: application.adminNotes,
          reviewedAt: application.reviewedAt,
          reviewedBy: application.reviewedBy,
          reviewerName: application.reviewer?.name ?? null,
        }
      : null,
  };
  const isPending = application.status === "pending";
  const showBusinessPerformance =
    application.status === "approved" && hasBusinessAccount;
  const profileHref = showBusinessPerformance
    ? ADMIN_BASE +
      "/user-overview/" +
      (isWarehouse ? "wholesalers/" : "retailers/") +
      current.user.id
    : null;
  const verifyLabel = data.accountMeta.canVerifyKyc
    ? "Verify KYC"
    : "KYC verified";

  return (
    <>
      <UserDetailsLayout
        title="Request Details"
        backHref={APPROVAL_LIST_URL}
        backLabel="All Requests"
        headingAside={
          <Badge variant="outline" className="capitalize">
            {application.status}
          </Badge>
        }
        businessName={businessName}
        detail={detail}
        data={data}
        hero={
          <UserProfileHero
            data={data}
            detail={detail}
            businessName={businessName}
            actions={
              <>
                {isPending && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Approve application"
                      title="Approve application"
                      disabled={decision.isPending}
                      onClick={() => setAction("approve")}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Reject application"
                      title="Reject application"
                      disabled={decision.isPending}
                      onClick={() => setAction("reject")}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={verifyLabel}
                  title={verifyLabel}
                  disabled={!data.accountMeta.canVerifyKyc || verify.isPending}
                  onClick={() => setVerifyOpen(true)}
                >
                  <ShieldCheck className="size-4" />
                </Button>
                {profileHref && (
                  <Button variant="outline" size="icon" asChild>
                    <Link
                      href={profileHref}
                      aria-label="View profile"
                      title="View profile"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </>
            }
          />
        }
        performance={
          <PerformanceContent
            userId={showBusinessPerformance ? application.userId : undefined}
          />
        }
        actions={
          isPending ? (
            <>
              <Button
                disabled={decision.isPending}
                onClick={() => setAction("approve")}
              >
                <Check className="size-4" aria-hidden />
                Approve Application
              </Button>
              <Button
                variant="destructive"
                disabled={decision.isPending}
                onClick={() => setAction("reject")}
              >
                <X className="size-4" aria-hidden />
                Reject Application
              </Button>
            </>
          ) : (
            <>
              {profileHref && (
                <Button variant="outline" asChild>
                  <Link href={profileHref}>
                    View Profile
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              )}
              {data.accountMeta.canVerifyKyc && (
                <Button
                  variant="outline"
                  disabled={verify.isPending}
                  onClick={() => setVerifyOpen(true)}
                >
                  <ShieldCheck className="size-4" aria-hidden />
                  Verify KYC
                </Button>
              )}
              {!profileHref && !data.accountMeta.canVerifyKyc && (
                <p className="text-sm text-muted-foreground">
                  This request has already been reviewed.
                </p>
              )}
            </>
          )
        }
      />
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !decision.isPending) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              {action === "approve"
                ? 'Approve "' +
                  businessName +
                  '" as a ' +
                  (isWarehouse ? "warehouse" : "retailer") +
                  " account."
                : 'Reject the application for "' + businessName + '".'}
              {action === "approve" &&
                !isWarehouse &&
                record.businessType === "restaurant" && (
                  <span className="mt-2 block">
                    This restaurant account can buy wholesale and will not
                    receive a retail storefront.
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="request-review-notes">
              Admin Notes {action === "reject" ? "(recommended)" : "(optional)"}
            </Label>
            <Textarea
              id="request-review-notes"
              value={notes}
              disabled={decision.isPending}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={decision.isPending}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={action === "reject" ? "destructive" : "default"}
              disabled={decision.isPending}
              onClick={() => {
                if (action) decision.mutate(action);
              }}
            >
              {decision.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <KycVerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        subjectName={businessName}
        notes={verifyNotes}
        onNotesChange={setVerifyNotes}
        isPending={verify.isPending}
        onConfirm={() => verify.mutate(application.userId)}
      />
    </>
  );
}
