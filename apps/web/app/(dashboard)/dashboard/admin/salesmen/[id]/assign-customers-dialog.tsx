"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/utils/orpc";

interface AssignCustomersDialogProps {
  salesmanId: string;
  salesmanName: string;
  onAssigned: () => void;
  children: React.ReactNode;
}


export function AssignCustomersDialog({
  salesmanId,
  salesmanName,
  onAssigned,
  children,
}: AssignCustomersDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Fetch unassigned customers via ORPC
  const { data, isLoading } = useQuery({
    ...orpc.salesman.getUnassignedCustomers.queryOptions(),
    enabled: open, // Only fetch when dialog is open
  });

  const customers = data?.customers ?? [];

  // Assign mutation via ORPC
  const assignMutation = useMutation({
    ...orpc.salesman.assignCustomers.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message || `Assigned customers to ${salesmanName}`);
      queryClient.invalidateQueries({ queryKey: ["salesman"] });
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setOpen(false);
      onAssigned();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign customers");
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedIds([]);
      setSearch("");
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.shopName?.toLowerCase().includes(s) ?? false),
    );
  }, [customers, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleAssign = () => {
    assignMutation.mutate({
      salesmanId,
      customerIds: selectedIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Customers</DialogTitle>
          <DialogDescription>
            Select customers to assign to {salesmanName}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-64 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-sm text-muted-foreground">
                {customers.length === 0
                  ? "No unassigned customers"
                  : "No customers match your search"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                  onClick={() => toggleSelect(customer.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(customer.id)}
                    onCheckedChange={() => toggleSelect(customer.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {customer.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {customer.shopName || customer.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {selectedIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} customer(s) selected
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedIds.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
