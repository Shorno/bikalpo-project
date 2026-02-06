"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { SearchModal } from "@/components/features/home/search/search-modal";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  className?: string;
  variant?: "public" | "customer";
}

export default function SearchInput({
  className,
  variant = "customer",
}: SearchInputProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        variant={variant}
      />
      <div
        className={cn("cursor-pointer", className)}
        onClick={() => setSearchOpen(true)}
      >
        <InputGroup className="max-w-96 rounded-2xl w-full">
          <InputGroupInput
            placeholder="Search..."
            readOnly
            className="cursor-pointer"
          />
          <InputGroupAddon align="inline-end">
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      </div>
    </>
  );
}
