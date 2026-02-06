"use client";

import { Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface DashboardCustomersHeroProps {
  totalCount: number;
  areas: string[];
  topCustomers: Array<{
    id: string;
    name: string;
    shopName: string | null;
  }>;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = ["bg-emerald-500", "bg-teal-500", "bg-green-500"];

export function DashboardCustomersHero({
  totalCount,
  areas,
  topCustomers,
}: DashboardCustomersHeroProps) {
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
    <div className="relative">
      {/* Background with Emerald Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-800" />

      {/* Content */}
      <div className="relative py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          {/* Title */}
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-wide">
            VERIFIED B2B CUSTOMERS
          </h1>

          {/* Subtitle */}
          <p className="text-emerald-100 text-base mb-6">
            View other verified buyers and their purchase history.
          </p>

          {/* Verified Buyer Count with Avatar Stack */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {/* Avatar Stack using shadcn pattern */}
            <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2">
              {topCustomers.slice(0, 3).map((customer, index) => (
                <Avatar key={customer.id}>
                  <AvatarFallback
                    className={`${avatarColors[index % avatarColors.length]} text-white`}
                  >
                    {getInitials(customer.shopName || customer.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="text-white text-left">
              <span className="font-bold">{totalCount}+</span> Verified
              <br />
              <span className="font-bold">Buyers</span>
            </div>
          </div>

          {/* Search & Filters Card */}
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
        </div>
      </div>
    </div>
  );
}
