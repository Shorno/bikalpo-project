"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AccountType,
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

type AddAccountDialogProps = {
  categories: FinanceCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddAccountDialog({
  categories,
  open,
  onOpenChange,
}: AddAccountDialogProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ASSET");
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentAccountId, setParentAccountId] = useState("");
  const availableCategories = useMemo(
    () =>
      categories.filter((category) => category.accountType === accountType),
    [accountType, categories]
  );
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    setCategoryId(availableCategories[0]?.id ?? "");
  }, [availableCategories]);

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
      setIsSubaccount(false);
      setParentAccountId("");
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Account</DialogTitle>
          <DialogDescription>
            Add a chart account and connect it to a finance category.
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
