"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { ShopFunction } from "@bikalpo-project/auth/shop-staff-access";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAssignShopStaffFunction,
  useShopStaffFunctions,
  useShopStaffMember,
} from "@/hooks/use-shop-staff-api";
import { authClient } from "@/lib/auth-client";

function shortUserId(id: string) {
  return id.slice(-8).toUpperCase();
}

export default function UserRoleProfilePage() {
  const params = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const query = useShopStaffMember(params.id);
  const functionsQuery = useShopStaffFunctions();
  const assignFunction = useAssignShopStaffFunction();
  const [shopFunction, setShopFunction] = useState<string>("");
  const isOwnerViewer = session?.user.role === "shop_owner";

  if (query.isLoading) {
    return <p className="text-sm text-gray-500">Loading profile…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/user-roles"
          className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to user roles
        </Link>
        <p className="text-sm text-red-600">Staff profile was not found.</p>
      </div>
    );
  }

  const member = query.data;
  const functions = functionsQuery.data?.functions ?? [];
  const selectedFunction = shopFunction || member.shopFunction || "";

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/user-roles"
        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to user roles
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
        <p className="text-sm text-gray-500">User profile</p>
      </div>
      <div className="grid gap-3 rounded-lg border bg-white p-6 shadow-sm sm:grid-cols-2">
        <ProfileRow label="User ID" value={shortUserId(member.id)} />
        <ProfileRow label="Account ID" value={member.id} />
        <ProfileRow label="User name" value={member.name} />
        <ProfileRow label="Email" value={member.email} />
        <ProfileRow label="Phone" value={member.phoneNumber || "Not provided"} />
        <ProfileRow label="Role" value={member.roleLabel} />
        <ProfileRow label="Access level" value={member.accessLevel} />
        <ProfileRow
          label="Status"
          value={member.banned ? "Banned" : "Active"}
        />
        {member.serviceArea ? (
          <ProfileRow label="Service area" value={member.serviceArea} />
        ) : null}
      </div>
      {isOwnerViewer && !member.isOwner ? (
        <div className="grid gap-3 rounded-lg border bg-white p-6 shadow-sm">
          <div className="grid gap-2">
            <Label htmlFor="assign-role">Assign role</Label>
            <Select value={selectedFunction} onValueChange={setShopFunction}>
              <SelectTrigger id="assign-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {functions.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label} — {entry.accessLevel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-fit bg-emerald-600 hover:bg-emerald-700"
            disabled={
              assignFunction.isPending ||
              !selectedFunction ||
              selectedFunction === member.shopFunction
            }
            onClick={() => {
              assignFunction.mutate(
                {
                  staffId: member.id,
                  shopFunction: selectedFunction as ShopFunction,
                },
                {
                  onSuccess: () => {
                    toast.success("Role assigned");
                    void query.refetch();
                  },
                  onError: (error) => toast.error(error.message),
                },
              );
            }}
          >
            {assignFunction.isPending ? "Saving…" : "Save role"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm text-gray-900">{value}</p>
    </div>
  );
}
