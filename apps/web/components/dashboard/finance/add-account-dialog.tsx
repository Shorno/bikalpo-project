"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AccountType,
  ChartAccount,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import {
  ACCOUNT_TYPES,
  DUMMY_PARENT_ACCOUNTS,
} from "@/components/dashboard/finance/chart-of-accounts-data";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AddAccountDialogProps = {
  account?: ChartAccount | null;
  categories: FinanceCategory[];
  open: boolean;
  onCreate: (account: Omit<ChartAccount, "id">) => void;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (account: ChartAccount) => void;
};

export function AddAccountDialog({
  account,
  categories,
  open,
  onCreate,
  onOpenChange,
  onUpdate,
}: AddAccountDialogProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ASSET");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentAccountId, setParentAccountId] = useState("");
  const availableCategories = useMemo(
    () => categories.filter((category) => category.accountType === accountType),
    [accountType, categories],
  );
  const [categoryId, setCategoryId] = useState("");
  const isEditing = Boolean(account);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (
      categoryId &&
      availableCategories.some((category) => category.id === categoryId)
    ) {
      return;
    }

    setCategoryId(availableCategories[0]?.id ?? "");
  }, [availableCategories, categoryId, open]);

  useEffect(() => {
    if (isSubaccount && !parentAccountId) {
      setParentAccountId(DUMMY_PARENT_ACCOUNTS[0]?.id ?? "");
    }

    if (!isSubaccount) {
      setParentAccountId("");
    }
  }, [isSubaccount, parentAccountId]);

  useEffect(() => {
    if (!open) {
      setName("");
      setAccountType("ASSET");
      setAmount("");
      setDescription("");
      setIsSubaccount(false);
      setParentAccountId("");
      setCategoryId("");
      return;
    }

    if (account) {
      setName(account.name);
      setAccountType(account.accountType);
      setAmount(String(account.amount));
      setDescription(account.description);
      setIsSubaccount(account.isSubaccount);
      setParentAccountId(account.parentAccountId);
      setCategoryId(account.categoryId);
      return;
    }

    setName("");
    setAccountType("ASSET");
    setAmount("");
    setDescription("");
    setIsSubaccount(false);
    setParentAccountId("");
    setCategoryId("");
  }, [account, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !categoryId) {
      return;
    }

    const parsedAmount = Number(amount.replace(/,/g, ""));

    const nextAccount = {
      name: name.trim(),
      accountType,
      categoryId,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      description: description.trim(),
      isSubaccount,
      parentAccountId: isSubaccount ? parentAccountId : "",
    };

    if (account && onUpdate) {
      onUpdate({ ...nextAccount, id: account.id });
    } else {
      onCreate(nextAccount);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Account" : "New Account"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this chart account and finance category."
              : "Add a chart account and connect it to a finance category."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="account-name">Account Name *</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Account name"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Account Type *</Label>
              <Select
                value={accountType}
                onValueChange={(value) => setAccountType(value as AccountType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isSubaccount}
                onCheckedChange={(checked) => setIsSubaccount(checked === true)}
              />
              <span>Make this a Subaccount</span>
            </label>

            <div className="grid gap-2">
              <Label>Parent Account *</Label>
              <Select
                disabled={!isSubaccount}
                value={parentAccountId}
                onValueChange={setParentAccountId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {DUMMY_PARENT_ACCOUNTS.map((parentAccount) => (
                    <SelectItem key={parentAccount.id} value={parentAccount.id}>
                      {parentAccount.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-description">Description</Label>
            <Textarea
              id="account-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short note for this account"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-amount">Amount</Label>
            <Input
              id="account-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter Amount"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() ||
                !categoryId ||
                (isSubaccount && !parentAccountId)
              }
            >
              {isEditing ? "Save changes" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
