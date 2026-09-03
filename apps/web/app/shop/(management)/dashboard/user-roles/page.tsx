"use client";

import { Eye, Plus, ShieldIcon, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ShopFunction } from "@bikalpo-project/auth/shop-staff-access";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateShopStaff,
  useShopStaffFunctions,
  useShopStaffMembers,
} from "@/hooks/use-shop-staff-api";
import { authClient } from "@/lib/auth-client";

function shortUserId(id: string) {
  return id.slice(-8).toUpperCase();
}

function generateStaffPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = `${upper}${lower}${digits}`;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)] ?? "A";
  const chars = [pick(upper), pick(lower), pick(digits)];
  for (let index = 0; index < 9; index += 1) {
    chars.push(pick(all));
  }
  return chars.sort(() => Math.random() - 0.5).join("");
}

const emptyForm = {
  name: "",
  email: "",
  phoneNumber: "",
  password: "",
  shopFunction: "",
  serviceArea: "",
};

export default function UserRolesPage() {
  const { data: session } = authClient.useSession();
  const membersQuery = useShopStaffMembers();
  const functionsQuery = useShopStaffFunctions();
  const createStaff = useCreateShopStaff();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const members = membersQuery.data?.members ?? [];
  const functions = functionsQuery.data?.functions ?? [];
  const selectedFunction = functions.find(
    (entry) => entry.id === form.shopFunction,
  );
  const isOwner = session?.user.role === "shop_owner";

  const functionHint = useMemo(() => {
    if (!selectedFunction) return "Choose the shop job this person will perform.";
    if (selectedFunction.id === "delivery") {
      return "Delivery staff sign in on the delivery portal, not this shop dashboard.";
    }
    return `${selectedFunction.label} receives ${selectedFunction.accessLevel} access on this shop dashboard.`;
  }, [selectedFunction]);

  if (session && !isOwner) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <ShieldIcon className="mx-auto mb-3 size-8 text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900">
          User roles and permissions
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Only the shop owner can create and assign staff roles.
        </p>
      </div>
    );
  }

  const save = () => {
    if (!form.shopFunction) {
      toast.error("Select a role");
      return;
    }
    createStaff.mutate(
      {
        name: form.name,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber || undefined,
        shopFunction: form.shopFunction as ShopFunction,
        serviceArea: form.serviceArea || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Staff member created");
          setFormOpen(false);
          setForm(emptyForm);
          void membersQuery.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Roles</h1>
          <p className="text-sm text-gray-500">
            Create shop staff and assign a role. The shop owner always has full
            control.
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => {
            setForm({ ...emptyForm, password: generateStaffPassword() });
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add New User
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Role catalog</h2>
          <p className="text-xs text-gray-500">
            Super Admin is the signed-in shop owner and is never assigned. Staff
            receive exactly one of the roles below.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead>Modules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium text-gray-900">
                Super Admin
              </TableCell>
              <TableCell>Full Control</TableCell>
              <TableCell className="text-xs text-gray-500">
                All shop modules, including user roles
              </TableCell>
            </TableRow>
            {functions.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-gray-900">
                  {entry.label}
                </TableCell>
                <TableCell>{entry.accessLevel}</TableCell>
                <TableCell className="text-xs text-gray-500">
                  {entry.modules.join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Users</h2>
        </div>
        {membersQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading staff…</p>
        ) : membersQuery.isError ? (
          <p className="p-8 text-center text-sm text-red-600">
            Could not load staff.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>User Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access Level</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {shortUserId(member.id)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{member.name}</p>
                    {member.banned ? (
                      <p className="text-xs text-amber-700">Banned</p>
                    ) : null}
                  </TableCell>
                  <TableCell>{member.roleLabel}</TableCell>
                  <TableCell>{member.accessLevel}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/user-roles/${member.id}`}>
                        <Eye className="mr-1.5 size-3.5" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Add New User
            </DialogTitle>
            <DialogDescription>
              Create a staff account and assign one shop role. This does not
              change the shop owner account type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="staff-name">User name</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-phone">Phone</Label>
              <Input
                id="staff-phone"
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={form.shopFunction}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, shopFunction: value }))
                }
              >
                <SelectTrigger id="staff-role">
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
              <p className="text-xs text-gray-500">{functionHint}</p>
            </div>
            {form.shopFunction === "delivery" ? (
              <div className="grid gap-2">
                <Label htmlFor="staff-area">Service area</Label>
                <Input
                  id="staff-area"
                  value={form.serviceArea}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceArea: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-gray-500">
                Must include upper and lower case letters and a number.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={createStaff.isPending}
              onClick={save}
            >
              {createStaff.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
