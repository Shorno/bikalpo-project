"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Smartphone,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/utils/orpc";

type FinancialAccountType = "bank" | "mobile_banking";

type FinancialAccount = {
  accountName: string;
  id: string;
  isActive: boolean;
  providerName: string;
  type: FinancialAccountType;
};

type AccountDraft = {
  accountName: string;
  id: string | null;
  isActive: boolean;
  providerName: string;
};

const EMPTY_DRAFT: AccountDraft = {
  accountName: "",
  id: null,
  isActive: true,
  providerName: "",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

export function FinancialSettingsSection() {
  const query = useQuery({
    ...orpc.finance.getFinancialSettingsAccounts.queryOptions({ input: {} }),
    staleTime: 30_000,
  });

  const accounts = (query.data?.accounts ?? []) as FinancialAccount[];
  const bankAccounts = accounts.filter((account) => account.type === "bank");
  const mobileAccounts = accounts.filter(
    (account) => account.type === "mobile_banking",
  );

  return (
    <section
      id="financial-settings"
      className="overflow-hidden rounded-xl border bg-white"
      aria-labelledby="financial-settings-heading"
    >
      <div className="border-b bg-gradient-to-r from-emerald-50/70 via-white to-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
            <CircleDollarSign className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="financial-settings-heading"
              className="text-lg font-semibold text-gray-950"
            >
              Financial settings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage the bank and mobile banking accounts connected to this
              business.
            </p>
          </div>
        </div>
      </div>

      {query.isPending ? (
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : query.isError ? (
        <div className="p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Financial accounts could not be loaded. {errorMessage(query.error)}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 lg:divide-x">
          <FinancialAccountPanel
            type="bank"
            accounts={bankAccounts}
            icon={Landmark}
            title="Bank accounts"
            description="Accounts used for business banking and transfers."
          />
          <FinancialAccountPanel
            type="mobile_banking"
            accounts={mobileAccounts}
            icon={Smartphone}
            title="Mobile banking"
            description="Mobile financial services available to the business."
          />
        </div>
      )}
    </section>
  );
}

function FinancialAccountPanel({
  accounts,
  description,
  icon: Icon,
  title,
  type,
}: {
  accounts: FinancialAccount[];
  description: string;
  icon: typeof Landmark;
  title: string;
  type: FinancialAccountType;
}) {
  const isBank = type === "bank";

  return (
    <div className="flex min-h-72 flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-950 uppercase">
            <Icon className="size-4 text-emerald-700" aria-hidden="true" />
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {accounts.length}
        </span>
      </div>

      <div className="mt-5 flex-1">
        {accounts.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/60 px-5 text-center">
            <Icon className="size-5 text-gray-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-gray-700">
              No {isBank ? "bank accounts" : "mobile banking providers"} added
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Use Manage to add the first one.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            <div
              className={`grid gap-3 pb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase ${isBank ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"}`}
            >
              <span>{isBank ? "Bank name" : "Provider"}</span>
              {isBank && <span>Account name</span>}
              <span>Status</span>
            </div>
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`grid items-center gap-3 py-3 text-sm ${isBank ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"}`}
              >
                <span className="truncate font-medium text-gray-900">
                  {account.providerName}
                </span>
                {isBank && (
                  <span className="truncate text-gray-600">
                    {account.accountName}
                  </span>
                )}
                <StatusBadge
                  active={account.isActive}
                  activeLabel={isBank ? "Active" : "Enabled"}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end border-t pt-5">
        <ManageFinancialAccountsDialog type={type} accounts={accounts} />
      </div>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
}: {
  active: boolean;
  activeLabel: "Active" | "Enabled";
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`}
        aria-hidden="true"
      />
      {active ? activeLabel : "Disabled"}
    </span>
  );
}

function ManageFinancialAccountsDialog({
  accounts,
  type,
}: {
  accounts: FinancialAccount[];
  type: FinancialAccountType;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const isBank = type === "bank";
  const label = isBank ? "bank accounts" : "mobile banking";

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.finance.getFinancialSettingsAccounts.key(),
    });
  };

  const createMutation = useMutation(
    orpc.finance.createFinancialSettingsAccount.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.success(isBank ? "Bank account added" : "Mobile banking added");
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );

  const updateMutation = useMutation(
    orpc.finance.updateFinancialSettingsAccount.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.success("Financial account updated");
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const edit = (account: FinancialAccount) => {
    setDraft({
      accountName: account.accountName,
      id: account.id,
      isActive: account.isActive,
      providerName: account.providerName,
    });
  };

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const input = {
      accountName: isBank ? draft.accountName : draft.providerName,
      isActive: draft.isActive,
      providerName: draft.providerName,
    };

    try {
      if (draft.id) {
        await updateMutation.mutateAsync({ ...input, id: draft.id });
      } else {
        await createMutation.mutateAsync({ ...input, type });
      }
      setDraft(null);
    } catch {
      // The mutation callback presents the server error and keeps the form open.
    }
  };

  const toggleStatus = (account: FinancialAccount, active: boolean) => {
    updateMutation.mutate({
      accountName: account.accountName,
      id: account.id,
      isActive: active,
      providerName: account.providerName,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setDraft(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Manage {isBank ? "bank accounts" : "mobile banking"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="capitalize">Manage {label}</DialogTitle>
          <DialogDescription>
            Add accounts, update their details, or control whether they are
            available to the business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Saved {label}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
              disabled={isSaving}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add new
            </Button>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nothing has been added yet.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-3 sm:p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    {isBank ? (
                      <Landmark className="size-4" aria-hidden="true" />
                    ) : (
                      <Smartphone className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {account.providerName}
                    </p>
                    {isBank && (
                      <p className="truncate text-xs text-gray-500">
                        {account.accountName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={account.isActive}
                      onCheckedChange={(checked) =>
                        toggleStatus(account, checked)
                      }
                      disabled={isSaving}
                      aria-label={`${account.isActive ? "Disable" : "Enable"} ${account.providerName}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => edit(account)}
                      disabled={isSaving}
                      aria-label={`Edit ${account.providerName}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {draft && (
          <form
            onSubmit={saveDraft}
            className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-950">
                {draft.id ? "Edit account" : "Add account"}
              </h3>
              <div className="flex items-center gap-2">
                <Label htmlFor={`${type}-active`} className="text-xs">
                  Active
                </Label>
                <Switch
                  id={`${type}-active`}
                  checked={draft.isActive}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, isActive: checked } : current,
                    )
                  }
                />
              </div>
            </div>

            <div className={isBank ? "grid gap-4 sm:grid-cols-2" : ""}>
              <div className="space-y-2">
                <Label htmlFor={`${type}-provider`}>
                  {isBank ? "Bank name" : "Provider name"}
                </Label>
                <Input
                  id={`${type}-provider`}
                  value={draft.providerName}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, providerName: event.target.value }
                        : current,
                    )
                  }
                  placeholder={isBank ? "Enter bank name" : "Enter provider"}
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>
              {isBank && (
                <div className="space-y-2">
                  <Label htmlFor={`${type}-account-name`}>Account name</Label>
                  <Input
                    id={`${type}-account-name`}
                    value={draft.accountName}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, accountName: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Enter account name"
                    maxLength={180}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={
                  isSaving ||
                  !draft.providerName.trim() ||
                  (isBank && !draft.accountName.trim())
                }
              >
                {isSaving && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {draft.id ? "Save changes" : "Add account"}
              </Button>
            </div>
          </form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
