"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  LockKeyhole,
  Pencil,
  SearchX,
  ShieldCheck,
  UnlockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toApplicationDetail } from "@/components/features/admin/application-detail-sections";
import { KycVerifyDialog } from "@/components/features/admin/kyc-verify-dialog";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";
import { client, orpc } from "@/utils/orpc";
import { PerformanceContent, type UserDetailData } from "./user-detail-content";
import { UserDetailsLayout } from "./user-details-layout";
import { profileContacts } from "./user-profile-contacts";
import { UserProfileHero } from "./user-profile-hero";

export function UserDetailClient({
  userId,
  segment,
}: {
  userId: string;
  segment: "retailers" | "wholesalers";
}) {
  const queryClient = useQueryClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const [logo, setLogo] = useState("");
  const [uploading, setUploading] = useState(false);
  const query = useQuery(
    orpc.adminUserManagement.getById.queryOptions({ input: { userId } }),
  );
  const { data } = query;
  const refresh = () => {
    void queryClient.invalidateQueries();
  };

  const suspend = useMutation({
    mutationFn: () =>
      client.adminUserManagement.suspend({
        userId,
        reason: suspendReason || undefined,
      }),
    onSuccess: () => {
      toast.success("Seller suspended");
      refresh();
      setSuspendOpen(false);
      setSuspendReason("");
    },
    onError: (error) =>
      toast.error(error.message || "Failed to suspend seller"),
  });
  const activate = useMutation({
    mutationFn: () => client.adminUserManagement.activate({ userId }),
    onSuccess: () => {
      toast.success("Seller reactivated");
      refresh();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to reactivate seller"),
  });
  const update = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      client.adminUserManagement.updateInfo({ userId, ...updates }),
    onSuccess: () => {
      toast.success("Seller details updated");
      refresh();
      setEditOpen(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update seller"),
  });
  const verify = useMutation({
    mutationFn: () =>
      client.adminUserManagement.verify({
        userId,
        adminNotes: verifyNotes || undefined,
      }),
    onSuccess: () => {
      toast.success("KYC verified");
      refresh();
      setVerifyOpen(false);
      setVerifyNotes("");
    },
    onError: (error) => toast.error(error.message || "Failed to verify KYC"),
  });
  const updateLogo = useMutation({
    mutationFn: () =>
      client.adminUserManagement.updateInfo({ userId, shopLogo: logo || null }),
    onSuccess: () => {
      toast.success("Company logo updated");
      refresh();
      setLogoOpen(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update logo"),
  });

  const backUrl = ADMIN_BASE + "/user-overview/" + segment;
  const backLabel = segment === "retailers" ? "Retailers" : "Wholesalers";

  if (query.isLoading)
    return (
      <div
        role="status"
        aria-label="Loading user details"
        className="space-y-6"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  if (query.isError || !data?.user)
    return (
      <div
        role="alert"
        className="flex min-h-80 flex-col items-center justify-center gap-4 text-center"
      >
        <SearchX className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">Could not load user details</h1>
        <p className="text-sm text-muted-foreground">
          {query.error?.message || "User not found."}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={backUrl}>Back to {backLabel}</Link>
          </Button>
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );

  const isWarehouse = data.user.role === "warehouse";
  const isSuspended = data.user.banned === true;
  const businessName =
    (isWarehouse ? data.user.warehouseName : data.user.shopName) ||
    data.user.name;
  const app = data.application as Record<string, unknown> | null;
  const storedAddress = isWarehouse
    ? data.user.warehouseAddress
    : data.user.shopAddress;
  const applicationAddress =
    app?.[isWarehouse ? "warehouseAddress" : "shopAddress"];
  const businessAddress =
    storedAddress ||
    (typeof applicationAddress === "string" ? applicationAddress : "");
  const detail = toApplicationDetail(
    {
      ...app,
      ...profileContacts(data.user, app),
      latitude:
        app?.latitude ||
        (isWarehouse ? data.user.warehouseLat : data.user.shopLat),
      longitude:
        app?.longitude ||
        (isWarehouse ? data.user.warehouseLng : data.user.shopLng),
    },
    businessAddress,
  );
  const actionPending = suspend.isPending || activate.isPending;
  const SuspendIcon = isSuspended ? UnlockKeyhole : LockKeyhole;

  return (
    <>
      <UserDetailsLayout
        backHref={backUrl}
        backLabel={backLabel}
        businessName={businessName}
        detail={detail}
        data={data}
        performance={<PerformanceContent userId={userId} />}
        hero={
          <UserProfileHero
            data={data}
            detail={detail}
            businessName={businessName}
            onChangeLogo={() => {
              setLogo(data.user.shopLogo || "");
              setLogoOpen(true);
            }}
            actions={
              <>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Edit seller"
                  title="Edit seller"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    data.accountMeta.canVerifyKyc
                      ? "Verify KYC"
                      : "KYC verified"
                  }
                  title={
                    data.accountMeta.canVerifyKyc
                      ? "Verify KYC"
                      : "KYC verified"
                  }
                  disabled={!data.accountMeta.canVerifyKyc || verify.isPending}
                  onClick={() => setVerifyOpen(true)}
                >
                  <ShieldCheck className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    isSuspended ? "Reactivate seller" : "Suspend seller"
                  }
                  title={isSuspended ? "Reactivate seller" : "Suspend seller"}
                  disabled={actionPending}
                  onClick={() =>
                    isSuspended ? activate.mutate() : setSuspendOpen(true)
                  }
                >
                  <SuspendIcon className="size-4" />
                </Button>
              </>
            }
          />
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit Seller
            </Button>
            <Button
              variant={isSuspended ? "outline" : "destructive"}
              disabled={actionPending}
              onClick={() =>
                isSuspended ? activate.mutate() : setSuspendOpen(true)
              }
            >
              {actionPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SuspendIcon className="size-4" aria-hidden />
              )}
              {isSuspended ? "Reactivate Seller" : "Suspend Seller"}
            </Button>
          </>
        }
      />

      <KycVerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        subjectName={businessName}
        notes={verifyNotes}
        onNotesChange={setVerifyNotes}
        isPending={verify.isPending}
        onConfirm={() => verify.mutate()}
      />
      <Dialog
        open={suspendOpen}
        onOpenChange={(open) => {
          if (!suspend.isPending) setSuspendOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Seller</DialogTitle>
            <DialogDescription>
              This will block {businessName} from accessing the platform until
              the account is reactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspension-reason">Reason (optional)</Label>
            <Textarea
              id="suspension-reason"
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              rows={3}
              placeholder="Reason for suspending this account"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={suspend.isPending}
              onClick={() => setSuspendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={suspend.isPending}
              onClick={() => suspend.mutate()}
            >
              {suspend.isPending && <Loader2 className="size-4 animate-spin" />}
              Suspend Seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={data.user}
        application={app}
        isWarehouse={isWarehouse}
        pending={update.isPending}
        onSave={(values) => update.mutate(values)}
      />
      {!isWarehouse && (
        <Dialog
          open={logoOpen}
          onOpenChange={(open) => {
            if (!uploading && !updateLogo.isPending) setLogoOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Logo</DialogTitle>
              <DialogDescription>
                Update the company logo for {businessName}.
              </DialogDescription>
            </DialogHeader>
            <ImageUploader
              value={logo}
              onChange={setLogo}
              folder={"registration-profiles/" + userId + "/shop-logo"}
              deleteOnRemove={false}
              disabled={updateLogo.isPending}
              onUploadStateChange={setUploading}
            />
            <DialogFooter>
              <Button
                variant="outline"
                disabled={uploading || updateLogo.isPending}
                onClick={() => setLogoOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  uploading ||
                  updateLogo.isPending ||
                  logo === (data.user.shopLogo || "")
                }
                onClick={() => updateLogo.mutate()}
              >
                {updateLogo.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save Logo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function editValues(
  user: UserDetailData["user"],
  application: UserDetailData["application"],
) {
  const contacts = profileContacts(user, application);
  return {
    name: user.name,
    phoneNumber: user.phoneNumber || "",
    ownerName: contacts.ownerName,
    businessPhoneNumber: contacts.phoneNumber,
    businessEmail: contacts.email || "",
    shopName: user.shopName || "",
    shopAddress: user.shopAddress || "",
    warehouseName: user.warehouseName || "",
    warehouseAddress: user.warehouseAddress || "",
  };
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  application,
  isWarehouse,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDetailData["user"];
  application: UserDetailData["application"];
  isWarehouse: boolean;
  pending: boolean;
  onSave: (values: Record<string, string>) => void;
}) {
  const initialValues = editValues(user, application);
  const [values, setValues] = useState(() => editValues(user, application));
  useEffect(() => {
    if (open) setValues(editValues(user, application));
  }, [open, user, application]);
  const changes = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        value !== initialValues[key as keyof typeof initialValues],
    ),
  );
  const fields: { key: keyof typeof values; label: string }[] = [
    { key: "name", label: "Account Name" },
    { key: "phoneNumber", label: "Sign-in Phone" },
    { key: "ownerName", label: "Owner Name" },
    ...(application
      ? [
          {
            key: "businessPhoneNumber" as const,
            label: "Business Mobile Number",
          },
          { key: "businessEmail" as const, label: "Business Email Address" },
        ]
      : []),
    ...(isWarehouse
      ? [
          { key: "warehouseName" as const, label: "Warehouse Name" },
          { key: "warehouseAddress" as const, label: "Warehouse Address" },
        ]
      : [
          { key: "shopName" as const, label: "Shop Name" },
          { key: "shopAddress" as const, label: "Shop Address" },
        ]),
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Seller</DialogTitle>
          <DialogDescription>
            Update the existing account and business details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={"edit-user-" + key}>{label}</Label>
              <Input
                id={"edit-user-" + key}
                value={values[key]}
                disabled={pending}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [key]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              !values.name.trim() ||
              Object.keys(changes).length === 0
            }
            onClick={() => onSave(changes)}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
