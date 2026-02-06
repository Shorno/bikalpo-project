"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Search, User, X } from "lucide-react";
import * as React from "react";
import { getCustomers } from "@/actions/user/get-customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MultiCustomerSelectProps {
  value: string[];
  onSelect: (customerIds: string[]) => void;
}

export function MultiCustomerSelect({
  value = [],
  onSelect,
}: MultiCustomerSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["estimate-customers"],
    queryFn: async () => {
      const result = await getCustomers();
      if (result.success) {
        return result.data;
      }
      return [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phoneNumber?.includes(searchTerm),
  );

  const selectedCustomers = customers.filter((customer) =>
    value.includes(customer.id),
  );

  const handleSelect = (customerId: string) => {
    const newValue = value.includes(customerId)
      ? value.filter((id) => id !== customerId)
      : [...value, customerId];
    onSelect(newValue as string[]);
  };

  const handleRemove = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(value.filter((id) => id !== customerId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-12 py-2 px-4 bg-background hover:border-primary hover:bg-muted/30 transition-all rounded-lg"
        >
          {value.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 py-1">
              {selectedCustomers.map((customer) => (
                <Badge
                  key={customer.id}
                  variant="secondary"
                  className="pl-2 pr-1 h-7 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors rounded-md"
                >
                  <span className="max-w-[150px] truncate">
                    {customer.name}
                  </span>
                  <button
                    type="button"
                    className="ml-1 text-primary/50 hover:text-primary transition-colors focus:outline-none"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => handleRemove(customer.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground/60" />
              <span className="text-muted-foreground/60">
                Select customers for estimate...
              </span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-2rem)] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex flex-col max-h-[400px]">
          <div className="flex items-center border-b px-3 bg-muted/20">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-40 text-muted-foreground" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search customers by name, shop, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto p-1 custom-scrollbar">
            {isLoading && (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                <Loader2 className="animate-spin size-6" />
                <span className="text-xs font-medium">
                  Loading customers...
                </span>
              </div>
            )}
            {!isLoading && filteredCustomers.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <User className="size-8 opacity-20" />
                <span>No customers found.</span>
              </div>
            )}
            {!isLoading &&
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
                    value.includes(customer.id)
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground/80",
                  )}
                  onClick={() => handleSelect(customer.id)}
                >
                  <div
                    className={cn(
                      "mr-3 flex size-4 items-center justify-center rounded border border-primary/30 transition-all",
                      value.includes(customer.id)
                        ? "bg-primary border-primary"
                        : "bg-background",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3 text-primary-foreground transition-opacity",
                        value.includes(customer.id)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="font-semibold">{customer.name}</span>
                    <div className="flex items-center gap-3 text-xs opacity-70 mt-0.5">
                      {customer.shopName && (
                        <span className="font-medium text-muted-foreground">
                          {customer.shopName}
                        </span>
                      )}
                      {customer.phoneNumber && (
                        <span className="text-muted-foreground">
                          {customer.phoneNumber}
                        </span>
                      )}
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
