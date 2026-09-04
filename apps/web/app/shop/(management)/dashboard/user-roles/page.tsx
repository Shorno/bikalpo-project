"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRightIcon,
  EyeIcon,
  LockKeyholeIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateShopStaff,
  useShopRoles,
  useShopStaffMembers,
} from "@/hooks/use-shop-staff-api";

type EditableRole = {
  id: number;
  name: string;
  memberIds: string[];
  permissions: { resource: string; actions: string[] }[];
};

const APPROVAL_CONTROLS = [
  {
    title: "Expense approval",
    description: "Require approval when an expense reaches a set amount.",
    enabled: false,
    threshold: "2,000",
    suffix: "BDT",
  },
  {
    title: "Discount approval",
    description: "Require approval for manual discounts above a percentage.",
    enabled: false,
    threshold: "0",
    suffix: "%",
  },
  {
    title: "Stock adjustment approval",
    description: "Review inventory corrections before stock is changed.",
    enabled: false,
  },
  {
    title: "Return approval",
    description: "Review sales returns before refunding or restocking.",
    enabled: true,
  },
] as const;

const ORDER_CONTROLS = [
  {
    title: "Minimum order quantity",
    description: "Set the minimum quantity accepted for an order.",
    enabled: false,
    threshold: "10",
    suffix: "units",
  },
  {
    title: "Minimum order amount",
    description: "Set the minimum merchandise value accepted at checkout.",
    enabled: false,
    threshold: "2,000",
    suffix: "BDT",
  },
] as const;

function generateStaffPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = `${upper}${lower}${digits}`;
  const pick = (set: string) =>
    set[Math.floor(Math.random() * set.length)] ?? "A";
  return [
    pick(upper),
    pick(lower),
    pick(digits),
    ...Array.from({ length: 9 }, () => pick(all)),
  ]
    .sort(() => Math.random() - 0.5)
    .join("");
}

function shortUserId(id: string) {
  return id.slice(-8).toUpperCase();
}

function permissionCount(role: EditableRole) {
  return role.permissions.reduce((total, row) => total + row.actions.length, 0);
}

export default function UserManagementPage() {
  const rolesQuery = useShopRoles();
  const membersQuery = useShopStaffMembers();
  const createStaff = useCreateShopStaff();
  const roles = (rolesQuery.data ?? []) as EditableRole[];
  const members = membersQuery.data?.members ?? [];
  const [staffDialog, setStaffDialog] = useState(false);
  const [staff, setStaff] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    roleId: "",
  });

  const roleByMember = useMemo(
    () =>
      new Map(
        roles.flatMap((role) =>
          role.memberIds.map((memberId) => [memberId, role] as const),
        ),
      ),
    [roles],
  );

  const openStaffDialog = () => {
    setStaff({
      name: "",
      email: "",
      phoneNumber: "",
      password: generateStaffPassword(),
      roleId: roles[0]?.id.toString() ?? "",
    });
    setStaffDialog(true);
  };

  if (rolesQuery.isPending || membersQuery.isPending) {
    return (
      <div className="h-[620px] animate-pulse rounded-xl border bg-muted/40" />
    );
  }

  if (rolesQuery.isError || membersQuery.isError) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-destructive">
        Could not load shop users. Try refreshing the page.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <UsersIcon className="size-4" /> Shop administration
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            User management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Add staff, review their access, and open an individual profile for
            account changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/user-roles/permissions">
              <ShieldCheckIcon className="mr-2 size-4" /> Manage roles &amp;
              permissions
            </Link>
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            onClick={openStaffDialog}
          >
            <PlusIcon className="mr-2 size-4" /> Add new user
          </Button>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Shop users</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "account" : "accounts"}
            connected to this shop.
          </p>
        </div>
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">User ID</TableHead>
              <TableHead>User name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const assignedRole = roleByMember.get(member.id);
              const roleName = assignedRole?.name ?? member.roleLabel;
              const accessLevel =
                member.accessLevel === "Custom" && assignedRole
                  ? `${permissionCount(assignedRole)} grants`
                  : member.accessLevel;

              return (
                <TableRow key={member.id}>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {shortUserId(member.id)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {assignedRole ? (
                      <Link
                        className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                        href={`/dashboard/user-roles/permissions?role=${assignedRole.id}`}
                      >
                        {roleName}
                        <ArrowUpRightIcon className="size-3.5" />
                      </Link>
                    ) : (
                      <span className="font-medium">{roleName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {accessLevel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.banned ? "destructive" : "secondary"}
                    >
                      {member.banned ? "Suspended" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        aria-label={`View ${member.name}'s profile`}
                        href={`/dashboard/user-roles/${member.id}`}
                      >
                        <EyeIcon className="mr-1.5 size-4" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <div id="operational-controls" className="grid gap-6 xl:grid-cols-2">
        <ControlSection
          controls={APPROVAL_CONTROLS}
          description="Approval policies from the retailer operations specification."
          icon={LockKeyholeIcon}
          title="Approval controls"
        />
        <ControlSection
          controls={ORDER_CONTROLS}
          description="Shop-wide checkout limits from the retailer operations specification."
          icon={ShoppingCartIcon}
          title="Order controls"
        />
      </div>

      <Dialog open={staffDialog} onOpenChange={setStaffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new shop user</DialogTitle>
            <DialogDescription>
              Create the login and assign its first named role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                value={staff.name}
                onChange={(event) =>
                  setStaff({ ...staff, name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-phone">Phone</Label>
              <Input
                id="staff-phone"
                value={staff.phoneNumber}
                onChange={(event) =>
                  setStaff({ ...staff, phoneNumber: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={staff.email}
                onChange={(event) =>
                  setStaff({ ...staff, email: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={staff.roleId}
                onValueChange={(value) => setStaff({ ...staff, roleId: value })}
              >
                <SelectTrigger id="staff-role">
                  <SelectValue placeholder="Select role" />
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
            <div className="grid gap-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <Input
                id="staff-password"
                value={staff.password}
                onChange={(event) =>
                  setStaff({ ...staff, password: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={createStaff.isPending || !staff.roleId}
              onClick={() =>
                createStaff.mutate(
                  {
                    name: staff.name,
                    email: staff.email,
                    phoneNumber: staff.phoneNumber || undefined,
                    password: staff.password,
                    roleId: Number(staff.roleId),
                  },
                  {
                    onSuccess: () => {
                      setStaffDialog(false);
                      toast.success("Shop user created");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <PlusIcon className="mr-2 size-4" />
              {createStaff.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Control = {
  title: string;
  description: string;
  enabled: boolean;
  threshold?: string;
  suffix?: string;
};

function ControlSection({
  controls,
  description,
  icon: Icon,
  title,
}: {
  controls: readonly Control[];
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-emerald-700" />
            <h2 className="font-semibold">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">Backend required</Badge>
      </div>
      <div className="divide-y">
        {controls.map((control) => (
          <div
            className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={control.title}
          >
            <div>
              <Label className="text-sm font-medium">{control.title}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {control.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                aria-label={control.title}
                defaultChecked={control.enabled}
                disabled
              />
              {control.threshold ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    At least
                  </span>
                  <Input
                    aria-label={`${control.title} threshold`}
                    className="h-8 w-20 text-right font-mono text-xs tabular-nums"
                    disabled
                    value={control.threshold}
                    readOnly
                  />
                  <span className="w-8 text-xs text-muted-foreground">
                    {control.suffix}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
        These controls stay locked until their server-side approval and checkout
        rules are connected.
      </div>
    </section>
  );
}
