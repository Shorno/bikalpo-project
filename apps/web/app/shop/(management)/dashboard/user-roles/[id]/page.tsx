"use client";

import {
  ArrowLeft,
  BanIcon,
  KeyRoundIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAssignShopRole,
  useRemoveShopStaff,
  useResetShopStaffPassword,
  useShopRoles,
  useShopStaffMember,
  useToggleShopStaffBan,
  useUpdateShopStaff,
} from "@/hooks/use-shop-staff-api";
import { authClient } from "@/lib/auth-client";

function shortUserId(id: string) {
  return `USR-${id.slice(-8).toUpperCase()}`;
}

export default function UserRoleProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const query = useShopStaffMember(params.id);
  const rolesQuery = useShopRoles();
  const assignRole = useAssignShopRole();
  const updateStaff = useUpdateShopStaff();
  const resetPassword = useResetShopStaffPassword();
  const toggleBan = useToggleShopStaffBan();
  const removeStaff = useRemoveShopStaff();
  const [roleId, setRoleId] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [edit, setEdit] = useState({ name: "", phoneNumber: "" });
  const [newPassword, setNewPassword] = useState("");
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
  const roles = rolesQuery.data ?? [];
  const assignedRole = member.assignedRole;
  const selectedRoleId = roleId || assignedRole?.id.toString() || "";

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
        <ProfileRow
          label="Phone"
          value={member.phoneNumber || "Not provided"}
        />
        <ProfileRow
          label="Role"
          value={assignedRole?.name ?? member.roleLabel}
        />
        <ProfileRow label="Access level" value={member.accessLevel} />
        <ProfileRow
          label="Status"
          value={member.banned ? "Banned" : "Active"}
        />
        {member.serviceArea ? (
          <ProfileRow label="Service area" value={member.serviceArea} />
        ) : null}
      </div>
      {isOwnerViewer &&
      !member.isOwner &&
      member.platformRole === "shop_staff" ? (
        <div className="grid gap-3 rounded-lg border bg-white p-6 shadow-sm">
          <div className="grid gap-2">
            <Label htmlFor="assign-role">Assign role</Label>
            <Select value={selectedRoleId} onValueChange={setRoleId}>
              <SelectTrigger id="assign-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-fit bg-emerald-600 hover:bg-emerald-700"
            disabled={
              assignRole.isPending ||
              !selectedRoleId ||
              selectedRoleId === assignedRole?.id.toString()
            }
            onClick={() => {
              assignRole.mutate(
                {
                  staffId: member.id,
                  roleId: Number(selectedRoleId),
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
            {assignRole.isPending ? "Saving…" : "Save role"}
          </Button>
        </div>
      ) : null}
      {isOwnerViewer && !member.isOwner ? (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold text-gray-900">Account actions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Update this user, reset access, suspend the account, or remove it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEdit({
                  name: member.name,
                  phoneNumber: member.phoneNumber ?? "",
                });
                setEditDialog(true);
              }}
            >
              <PencilIcon className="mr-2 size-4" /> Edit profile
            </Button>
            <Button variant="outline" onClick={() => setPasswordDialog(true)}>
              <KeyRoundIcon className="mr-2 size-4" /> Reset password
            </Button>
            <Button
              variant="outline"
              disabled={toggleBan.isPending}
              onClick={() =>
                toggleBan.mutate(
                  { staffId: member.id, banned: !member.banned },
                  {
                    onSuccess: () =>
                      toast.success(
                        member.banned ? "User restored" : "User suspended",
                      ),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <BanIcon className="mr-2 size-4" />
              {member.banned ? "Restore user" : "Suspend user"}
            </Button>
            <Button
              className="text-destructive hover:text-destructive"
              variant="outline"
              disabled={removeStaff.isPending}
              onClick={() => {
                if (!window.confirm(`Remove ${member.name} from this shop?`)) {
                  return;
                }
                removeStaff.mutate(
                  { staffId: member.id },
                  {
                    onSuccess: () => {
                      toast.success("User removed");
                      router.push("/dashboard/user-roles");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                );
              }}
            >
              <Trash2Icon className="mr-2 size-4" /> Remove user
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user profile</DialogTitle>
            <DialogDescription>
              Update the name and phone number shown for this shop user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                value={edit.name}
                onChange={(event) =>
                  setEdit({ ...edit, name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-user-phone">Phone</Label>
              <Input
                id="edit-user-phone"
                value={edit.phoneNumber}
                onChange={(event) =>
                  setEdit({ ...edit, phoneNumber: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={updateStaff.isPending || edit.name.trim().length < 2}
              onClick={() =>
                updateStaff.mutate(
                  {
                    staffId: member.id,
                    name: edit.name,
                    phoneNumber: edit.phoneNumber || null,
                  },
                  {
                    onSuccess: () => {
                      setEditDialog(false);
                      toast.success("Profile updated");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {updateStaff.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset user password</DialogTitle>
            <DialogDescription>
              Set a new temporary password and share it securely with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-user-password">New password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={resetPassword.isPending || newPassword.length < 8}
              onClick={() =>
                resetPassword.mutate(
                  { staffId: member.id, newPassword },
                  {
                    onSuccess: () => {
                      setPasswordDialog(false);
                      setNewPassword("");
                      toast.success("Password reset");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
