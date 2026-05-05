"use client";

import { useState } from "react";
import {
  Search,
  Store,
  User,
  Phone,
  Calendar,
  Package,
  TrendingUp,
  MapPin,
  MoreVertical,
  XCircle,
  Clock,
  Loader2,
  InboxIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useConnectedStores,
  useRejectStoreRequest,
} from "@/hooks/use-warehouse-connections";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ConnectedStoresPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "orders_desc" | "orders_asc" | "revenue_desc">("recent");

  const { data, isLoading } = useConnectedStores({
    search: search.trim() || undefined,
  });

  const { mutate: disconnectStore, isPending: isDisconnecting } = useRejectStoreRequest();

  const handleDisconnect = (connectionId: number, storeName: string) => {
    if (confirm(`Are you sure you want to disconnect access for ${storeName}? They will no longer be able to browse or order from your catalog.`)) {
      disconnectStore({ connectionId, isDisconnection: true });
    }
  };

  const stores = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-600" />
            Connected Stores
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage approved retailer shops and view their ordering activity
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store name, owner, phone..."
              className="pl-9 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm font-medium text-gray-500 shrink-0">Sort by:</span>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-full sm:w-48 bg-white">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Connected</SelectItem>
                <SelectItem value="orders_desc">Most Orders</SelectItem>
                <SelectItem value="orders_asc">Least Orders</SelectItem>
                <SelectItem value="revenue_desc">Highest Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="divide-y">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 flex items-start sm:items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="hidden sm:block space-y-2 text-right">
                  <Skeleton className="h-5 w-24 ml-auto" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </div>
            ))
          ) : stores.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <InboxIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="font-medium text-gray-900 text-lg">No connected stores found</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                {search 
                  ? "Try adjusting your search filters." 
                  : "You haven't approved any store requests yet. Check the 'Store Requests' tab to accept new retailers."}
              </p>
            </div>
          ) : (
            stores.map((store: any) => (
              <div key={store.connectionId} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  
                  {/* Store Details */}
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 border bg-white shrink-0">
                      <AvatarImage src={store.image || undefined} />
                      <AvatarFallback className="bg-emerald-50 text-emerald-600">
                        <Store className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 text-base truncate">
                          {store.shopName}
                        </h4>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] uppercase font-bold py-0 h-5">
                          Active
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> {store.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {store.phone}
                        </span>
                        {store.address && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin className="w-3.5 h-3.5" /> {store.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 mt-3 sm:mt-0 sm:pl-4 sm:border-l">
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center sm:text-right">
                        <div className="flex items-center justify-center sm:justify-end gap-1.5 text-gray-500 mb-0.5">
                          <Package className="w-3.5 h-3.5" />
                          <span className="text-xs uppercase tracking-wider font-semibold">Orders</span>
                        </div>
                        <div className="font-bold text-gray-900 text-base">
                          {store.totalOrders}
                        </div>
                      </div>

                      <div className="text-center sm:text-right hidden sm:block">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500 mb-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span className="text-xs uppercase tracking-wider font-semibold">Revenue</span>
                        </div>
                        <div className="font-bold text-gray-900 text-base">
                          ৳{(store.totalRevenue || 0).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="text-center sm:text-right hidden md:block">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500 mb-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs uppercase tracking-wider font-semibold">Last Order</span>
                        </div>
                        <div className="font-medium text-gray-700 text-sm">
                          {store.lastOrderedAt 
                            ? new Date(store.lastOrderedAt).toLocaleDateString()
                            : "Never"}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 hover:bg-gray-100">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Store Options</DropdownMenuLabel>
                        <DropdownMenuItem className="text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          View Order History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          onClick={() => handleDisconnect(store.connectionId, store.shopName)}
                          disabled={isDisconnecting}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Disconnect Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
