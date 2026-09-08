"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserRound, UserRoundPlus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { getCustomerSearchState } from "@/lib/warehouse-pos-customer-search";
import { orpc } from "@/utils/orpc";

export type PosCustomer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  isDefault: boolean;
  outstanding: number;
};

export function PosCustomerEntry({
  selectedCustomer,
  defaultCustomer,
  onSelect,
}: {
  selectedCustomer: PosCustomer | null;
  defaultCustomer: PosCustomer | null;
  onSelect: (customer: PosCustomer) => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 250);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const customersQuery = useQuery({
    queryKey: ["warehousePos", "customers", debouncedSearch],
    queryFn: () =>
      orpc.warehousePos.searchCustomers.call({ search: debouncedSearch }),
    enabled: debouncedSearch.length > 0,
    retry: false,
  });
  const matches = (customersQuery.data?.customers ?? []).filter(
    (customer) => !customer.isDefault,
  );
  const searchState = getCustomerSearchState({
    search,
    debouncedSearch,
    isFetching: customersQuery.isFetching,
    isError: customersQuery.isError,
    hasData: customersQuery.data !== undefined,
    matchCount: matches.length,
  });

  const selectCustomer = (customer: PosCustomer) => {
    onSelect(customer);
    setSearch("");
  };
  const createCustomer = useMutation({
    mutationFn: () =>
      orpc.warehousePos.createCustomer.call({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        customerType: "wholesale",
      }),
    onSuccess: async ({ customer }) => {
      selectCustomer({ ...customer, outstanding: 0 });
      setAddingCustomer(false);
      await queryClient.invalidateQueries({
        queryKey: ["warehousePos", "customers"],
      });
      toast.success("Customer added to the order");
    },
    onError: (error) => toast.error(error.message || "Could not save customer"),
  });

  const startAddingCustomer = () => {
    if (searchState !== "empty") return;
    const entered = search.trim();
    const isPhone = /^\+?[\d\s().-]+$/.test(entered) && /\d/.test(entered);
    setForm({
      name: isPhone ? "" : entered,
      phone: isPhone ? entered : "",
      address: "",
    });
    setAddingCustomer(true);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-search`}>Customer name or phone</Label>
        <Command
          shouldFilter={false}
          className="border border-zinc-200 bg-white"
        >
          <CommandInput
            id={`${id}-search`}
            aria-label="Customer name or phone"
            placeholder="Enter name or phone number"
            value={search}
            onValueChange={setSearch}
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setSearch("");
              }
            }}
          />
          <CommandList aria-label="Matching customers">
            {searchState === "loading" ? (
              <p
                role="status"
                className="flex items-center gap-2 px-3 py-4 text-xs text-zinc-600"
              >
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
                Searching customers…
              </p>
            ) : null}
            {searchState === "error" ? (
              <>
                <p role="alert" className="px-3 pt-3 text-xs text-red-700">
                  Customer search failed. Please try again.
                </p>
                <CommandItem
                  value="retry"
                  onSelect={() => void customersQuery.refetch()}
                >
                  Retry search
                </CommandItem>
              </>
            ) : null}
            {searchState === "matches"
              ? matches.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={String(customer.id)}
                    className="min-h-12 cursor-pointer items-start py-2"
                    onSelect={() => selectCustomer(customer)}
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-semibold">
                        {customer.name}
                      </span>
                      <span className="block break-words text-xs text-zinc-600">
                        {customer.phone || "No phone on file"}
                        {customer.address ? ` · ${customer.address}` : ""}
                      </span>
                    </span>
                  </CommandItem>
                ))
              : null}
            {searchState === "empty" ? (
              <>
                <p
                  role="status"
                  className="break-words px-3 pt-3 text-xs text-zinc-600"
                >
                  No customer found for “{search.trim()}”.
                </p>
                <CommandItem
                  value="create"
                  onSelect={startAddingCustomer}
                  className="min-h-10 cursor-pointer font-semibold"
                >
                  <UserRoundPlus aria-hidden="true" />
                  Add customer
                </CommandItem>
              </>
            ) : null}
          </CommandList>
        </Command>
      </div>

      <div
        className="flex items-start gap-3 border-t border-zinc-200 pt-3"
        aria-live="polite"
      >
        <UserRound
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">
            {selectedCustomer?.name || "Walk-in Customer"}
          </p>
          {selectedCustomer?.phone ? (
            <p className="mt-0.5 text-xs text-zinc-600">
              {selectedCustomer.phone}
            </p>
          ) : null}
          {selectedCustomer?.address ? (
            <p className="mt-0.5 break-words text-xs text-zinc-600">
              {selectedCustomer.address}
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-600">Customer due</span>
            <span className="font-mono font-bold tabular-nums">
              ৳
              {(selectedCustomer?.outstanding ?? 0).toLocaleString("en-BD", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          {defaultCustomer &&
          selectedCustomer &&
          !selectedCustomer.isDefault ? (
            <Button
              variant="link"
              className="mt-1 h-auto px-0 text-xs"
              onClick={() => selectCustomer(defaultCustomer)}
            >
              Use Walk-in Customer
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={addingCustomer}
        onOpenChange={(open) => {
          if (!createCustomer.isPending) setAddingCustomer(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>
              Enter the customer's details. A phone number is required for
              orders with an outstanding balance.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (form.name.trim().length >= 2 && !createCustomer.isPending)
                createCustomer.mutate();
            }}
          >
            <fieldset
              disabled={createCustomer.isPending}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>Customer name *</Label>
                <Input
                  id={`${id}-name`}
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-phone`}>Phone</Label>
                <Input
                  id={`${id}-phone`}
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  placeholder="01XXXXXXXXX"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-address`}>Location / address</Label>
                <Textarea
                  id={`${id}-address`}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddingCustomer(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    form.name.trim().length < 2 || createCustomer.isPending
                  }
                  className="bg-blue-700 hover:bg-blue-800"
                >
                  {createCustomer.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="mr-2 h-4 w-4 animate-spin"
                    />
                  ) : null}
                  Save customer
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
