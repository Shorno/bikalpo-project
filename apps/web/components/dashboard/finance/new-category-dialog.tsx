"use client";

import { useEffect, useState } from "react";
import type { AccountType } from "@/components/dashboard/finance/chart-of-accounts-data";
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

type NewCategoryDialogProps = {
  open: boolean;
  onCreate: (category: { name: string; accountType: AccountType }) => void;
  onOpenChange: (open: boolean) => void;
};

export function NewCategoryDialog({
  open,
  onCreate,
  onOpenChange,
}: NewCategoryDialogProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("EXPENSE");

  useEffect(() => {
    if (!open) {
      setName("");
      setAccountType("EXPENSE");
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    onCreate({ name: name.trim(), accountType });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Add a category under one of the fixed finance account types.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Advertising / Promotional"
            />
          </div>

          <div className="grid gap-2">
            <Label>Account Type</Label>
            <Select
              value={accountType}
              onValueChange={(value) => setAccountType(value as AccountType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
