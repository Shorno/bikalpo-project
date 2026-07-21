"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AccountType,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import { ACCOUNT_TYPES } from "@/components/dashboard/finance/chart-of-accounts-data";
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
    if (!open) {
      setName("");
      setAccountType("ASSET");
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
