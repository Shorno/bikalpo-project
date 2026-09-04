"use client";

import type { ShopPermissionAction } from "@bikalpo-project/auth/shop-permissions";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateShopRole,
  useDeleteShopRole,
  useShopRoleCatalog,
  useShopRoles,
  useUpdateShopRole,
} from "@/hooks/use-shop-staff-api";

type PermissionRow = {
  resource: string;
  actions: ShopPermissionAction[];
};

type EditableRole = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  legacyFunction: string | null;
  memberCount: number;
  memberIds: string[];
  permissions: PermissionRow[];
};

function permissionCount(role: EditableRole) {
  return role.permissions.reduce((total, row) => total + row.actions.length, 0);
}

export default function UserRolesPage() {
  const searchParams = useSearchParams();
  const rolesQuery = useShopRoles();
  const catalogQuery = useShopRoleCatalog();
  const createRole = useCreateShopRole();
  const updateRole = useUpdateShopRole();
  const deleteRole = useDeleteShopRole();
  const roles = (rolesQuery.data ?? []) as EditableRole[];
  const [selectedId, setSelectedId] = useState<number>();
  const [draft, setDraft] = useState<EditableRole>();
  const [roleDialog, setRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  useEffect(() => {
    if (selectedId || !roles[0]) return;
    const requestedRoleId = Number(searchParams.get("role"));
    const requestedRole = roles.find((role) => role.id === requestedRoleId);
    setSelectedId(requestedRole?.id ?? roles[0].id);
  }, [roles, searchParams, selectedId]);

  useEffect(() => {
    const selected = roles.find((role) => role.id === selectedId);
    if (selected) {
      setDraft({
        ...selected,
        permissions: selected.permissions.map((row) => ({
          ...row,
          actions: [...row.actions],
        })),
      });
    }
  }, [roles, selectedId]);

  const toggleGrant = (
    resource: string,
    action: ShopPermissionAction,
    checked: boolean,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const map = new Map(
        current.permissions.map((row) => [row.resource, [...row.actions]]),
      );
      const actions = map.get(resource) ?? [];
      if (!checked && action === "view") {
        map.delete(resource);
      } else {
        map.set(
          resource,
          checked
            ? [...new Set([...actions, "view" as const, action])]
            : actions.filter((entry) => entry !== action),
        );
      }
      return {
        ...current,
        permissions: [...map.entries()]
          .filter(([, entries]) => entries.length)
          .map(([entryResource, entries]) => ({
            resource: entryResource,
            actions: entries,
          })),
      };
    });
  };

  const hasGrant = (resource: string, action: ShopPermissionAction) =>
    draft?.permissions
      .find((row) => row.resource === resource)
      ?.actions.includes(action) ?? false;

  const saveRole = () => {
    if (!draft) return;
    updateRole.mutate(
      {
        roleId: draft.id,
        name: draft.name,
        description: draft.description,
        permissions: draft.permissions,
      },
      {
        onSuccess: () => toast.success("Role permissions saved"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (rolesQuery.isPending || catalogQuery.isPending) {
    return (
      <div className="h-[620px] animate-pulse rounded-lg border bg-muted/40" />
    );
  }
  if (rolesQuery.isError || catalogQuery.isError || !catalogQuery.data) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-destructive">
        Could not load roles and permissions.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ShieldCheckIcon className="size-6 text-blue-700" />
            Roles & permissions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Give each named role access page by page. API actions use the same
            grants, so hiding a page never becomes the only security boundary.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/user-roles">
              <ArrowLeftIcon className="mr-2 size-4" /> User management
            </Link>
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            onClick={() => setRoleDialog(true)}
          >
            <PlusIcon className="mr-2 size-4" /> New role
          </Button>
        </div>
      </div>

      <div className="grid min-h-[560px] overflow-hidden rounded-lg border bg-card lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/25 p-3 lg:border-r lg:border-b-0">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shop roles
          </p>
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selectedId === role.id ? "bg-background ring-1 ring-border" : "hover:bg-background/70"}`}
                key={role.id}
                onClick={() => setSelectedId(role.id)}
                type="button"
              >
                <div
                  className={`grid size-9 place-items-center rounded-lg ${selectedId === role.id ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}
                >
                  <UsersIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{role.name}</p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {role.memberCount} members · {permissionCount(role)} grants
                  </p>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {draft ? (
            <>
              <div className="flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-name">Role name</Label>
                    <Input
                      id="role-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      value={draft.description ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                      }
                      placeholder="What should this role be used for?"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {!draft.isSystem ? (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteRole.isPending || draft.memberCount > 0}
                      onClick={() =>
                        deleteRole.mutate(
                          { roleId: draft.id },
                          {
                            onSuccess: () => {
                              setSelectedId(undefined);
                              toast.success("Role deleted");
                            },
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                    >
                      <Trash2Icon className="mr-2 size-4" /> Delete
                    </Button>
                  ) : null}
                  <Button disabled={updateRole.isPending} onClick={saveRole}>
                    <SaveIcon className="mr-2 size-4" />
                    {updateRole.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>

              <div className="max-h-[680px] overflow-auto">
                {catalogQuery.data.modules.map((module) => (
                  <div className="border-b last:border-0" key={module.id}>
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-muted px-5 py-2.5">
                      <h2 className="text-sm font-semibold">{module.label}</h2>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {module.pages.length} pages
                      </span>
                    </div>
                    <Table className="min-w-[760px] table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[42%]">Page</TableHead>
                          {catalogQuery.data.actions.map((action) => (
                            <TableHead
                              className="text-center text-[11px] capitalize"
                              key={action}
                            >
                              {action}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {module.pages.map((page) => (
                          <TableRow key={page.resource}>
                            <TableCell>
                              <p className="text-sm font-medium">
                                {page.label}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {page.description}
                              </p>
                            </TableCell>
                            {catalogQuery.data.actions.map((action) => {
                              const supported = (
                                page.actions as readonly ShopPermissionAction[]
                              ).includes(action);
                              return (
                                <TableCell
                                  className="px-2 text-center [&:has([role=checkbox])]:pr-2"
                                  key={action}
                                >
                                  {supported ? (
                                    <Checkbox
                                      aria-label={`${page.label}: ${action}`}
                                      checked={hasGrant(page.resource, action)}
                                      className="mx-auto"
                                      onCheckedChange={(checked) =>
                                        toggleGrant(
                                          page.resource,
                                          action,
                                          checked === true,
                                        )
                                      }
                                    />
                                  ) : (
                                    <span className="text-muted-foreground/35">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Select a role to edit.
            </p>
          )}
        </section>
      </div>

      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a named role</DialogTitle>
            <DialogDescription>
              Start empty, then select the exact pages and actions this role
              needs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-role-name">Role name</Label>
              <Input
                id="new-role-name"
                value={newRole.name}
                onChange={(event) =>
                  setNewRole({ ...newRole, name: event.target.value })
                }
                placeholder="e.g. Branch Cashier"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-role-description">Description</Label>
              <Textarea
                id="new-role-description"
                value={newRole.description}
                onChange={(event) =>
                  setNewRole({ ...newRole, description: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={createRole.isPending || newRole.name.trim().length < 2}
              onClick={() =>
                createRole.mutate(
                  {
                    name: newRole.name,
                    description: newRole.description || null,
                    permissions: [],
                  },
                  {
                    onSuccess: (result) => {
                      setRoleDialog(false);
                      setNewRole({ name: "", description: "" });
                      setSelectedId(result.role.id);
                      toast.success("Role created");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <CheckIcon className="mr-2 size-4" /> Create role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
