"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";
import { getCustomers } from "@/actions/user/get-customers";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  shopName?: string | null;
}

interface CustomerSelectProps {
  value?: string;
  onSelect: (customerId: string) => void;
}

export function CustomerSelect({ value, onSelect }: CustomerSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phoneNumber?.includes(searchTerm),
  );

  React.useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const result = await getCustomers();
        if (result.success) {
          setCustomers(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch customers", error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch customers if popover opens OR if there's an initial value (for edit mode)
    if (open || value) {
      fetchCustomers();
    }
  }, [open, value]);

  const selectedCustomer = customers.find((customer) => customer.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? selectedCustomer?.name || "Customer selected"
            : "Select customer..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-2rem)] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex flex-col max-h-[300px]">
          <div className="flex items-center border-b px-3">
            <Loader2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search customers..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="animate-spin size-4" />
              </div>
            )}
            {!loading && filteredCustomers.length === 0 && (
              <div className="py-6 text-center text-sm">No customer found.</div>
            )}
            {!loading &&
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onSelect(customer.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === customer.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {customer.shopName && <span>{customer.shopName}</span>}
                      <span>{customer.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
