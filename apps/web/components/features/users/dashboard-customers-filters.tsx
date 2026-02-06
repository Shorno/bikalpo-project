"use client";

import { Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardCustomersFiltersProps {
  areas: string[];
}

export function DashboardCustomersFilters({
  areas,
}: DashboardCustomersFiltersProps) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );
  const [area, setArea] = useQueryState(
    "area",
    parseAsString.withDefault("all").withOptions({ shallow: false }),
  );
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("top_buyers").withOptions({ shallow: false }),
  );

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchValue = formData.get("search") as string;
    setSearch(searchValue || null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 max-w-4xl mx-auto">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              name="search"
              type="text"
              placeholder="Search buyer, shop, area..."
              defaultValue={search}
              className="pl-10 py-6 text-base"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="px-8 py-6 bg-emerald-600 hover:bg-emerald-700"
          >
            Search
          </Button>
        </div>
      </form>

      {/* Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Area Filter */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500 text-left block">
            Area
          </Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a.toLowerCase()}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort By Filter */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500 text-left block">
            Sort By
          </Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Top Buyers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top_buyers">Top Buyers</SelectItem>
              <SelectItem value="most_orders">Most Orders</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        <div className="space-y-1 flex items-end">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-gray-500 hover:text-gray-700"
            onClick={() => {
              setSearch(null);
              setArea("all");
              setSortBy("top_buyers");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
