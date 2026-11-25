"use client";

import { ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchCreateOption = {
  id: number;
  name: string;
};

/**
 * Pick from a list or type a new name: when nothing matches, an
 * "Add …" row creates it. Used for Sub category and Core identity.
 */
export function SearchCreateCombobox({
  noun,
  options,
  selected,
  disabled,
  disabledLabel,
  creating = false,
  clearLabel,
  onSelect,
  onCreate,
  onClear,
}: {
  noun: string;
  options: SearchCreateOption[];
  selected?: SearchCreateOption;
  disabled: boolean;
  disabledLabel: string;
  creating?: boolean;
  /** Shown as the first row when something is selected and it can be unset. */
  clearLabel?: string;
  onSelect: (id: number) => void;
  onCreate: (name: string) => boolean | Promise<boolean>;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = query.trim();
  const matches = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()),
  );
  const canCreate =
    !creating &&
    search.length >= 2 &&
    matches.length === 0 &&
    !options.some(
      (option) => option.name.toLowerCase() === search.toLowerCase(),
    );

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  const choose = (id: number) => {
    onSelect(id);
    close();
  };

  const create = async () => {
    if (!canCreate) return;
    const created = await onCreate(search);
    if (created) close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Select or add a ${noun}`}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={selected ? "truncate" : "truncate text-muted-foreground"}
          >
            {selected?.name ?? (disabled ? disabledLabel : `Search ${noun}`)}
          </span>
          {creating ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search or add a ${noun}`}
            value={query}
            onValueChange={setQuery}
            maxLength={100}
          />
          <CommandList>
            <CommandEmpty>
              {search.length < 2
                ? `Type at least 2 characters to add a new ${noun}.`
                : `No ${noun} found.`}
            </CommandEmpty>
            <CommandGroup>
              {selected && onClear && clearLabel && !search && (
                <CommandItem
                  value="clear-selection"
                  className="text-muted-foreground"
                  onSelect={() => {
                    onClear();
                    close();
                  }}
                >
                  {clearLabel}
                </CommandItem>
              )}
              {matches.map((option) => (
                <CommandItem
                  key={option.id}
                  value={String(option.id)}
                  data-checked={option.id === selected?.id}
                  onSelect={() => choose(option.id)}
                >
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`create-${search}`}
                  onSelect={() => void create()}
                  className="text-primary"
                >
                  <Plus className="size-4" />
                  <span className="truncate">
                    Add &ldquo;{search}&rdquo; as a new {noun}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
