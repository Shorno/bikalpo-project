"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Search,
  Store,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMyWarehouses,
  useLookupWarehouse,
  useConnectToWarehouse,
  useCancelWarehouseRequest,
  useDisconnectWarehouse,
} from "@/hooks/use-shop-owner-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MyWarehousesPage() {
  const [statusTab, setStatusTab] = useState<"all" | "active" | "pending" | "disconnected">("all");

  const { data: myWarehousesData, isLoading: isLoadingMyWarehouses } = useMyWarehouses(statusTab);
  const connections = myWarehousesData?.warehouses ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Warehouses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your connected wholesale suppliers
          </p>
        </div>
        <ConnectWarehouseDialog />
      </div>

      <Tabs
        defaultValue="all"
        value={statusTab}
        onValueChange={(val) => setStatusTab(val as any)}
      >
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Connected</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="disconnected">Rejected / Disconnected</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={statusTab} className="mt-0 outline-none">
          {isLoadingMyWarehouses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed p-12 text-center">
              <Warehouse className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No warehouses found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {statusTab === "all"
                  ? "You haven't connected to any warehouses yet. Connect to a warehouse to start ordering."
                  : `You have no ${statusTab} warehouse connections.`}
              </p>
              {statusTab === "all" && (
                <div className="mt-6">
                  <ConnectWarehouseDialog />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((conn: any) => (
                <WarehouseCard key={conn.connectionId} connection={conn} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WarehouseCard({ connection }: { connection: any }) {
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelWarehouseRequest();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectWarehouse();

  const isPending = connection.status === "pending";
  const isActive = connection.status === "active";
  const isDisconnected = connection.status === "disconnected";

  return (
    <Card className={`relative overflow-hidden ${isActive ? 'hover:border-emerald-500/50 hover:shadow-md transition-all' : ''}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3 items-center">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={connection.image || undefined} />
              <AvatarFallback className="bg-primary/5 text-primary">
                <Store className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-base leading-none mb-1">
                {connection.warehouseName || connection.name}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                {connection.warehouseAddress || "No address provided"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {isActive && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
              <Clock className="w-3 h-3 mr-1" /> Request Pending
            </Badge>
          )}
          {isDisconnected && (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
              <XCircle className="w-3 h-3 mr-1" /> Not Connected
            </Badge>
          )}

          {isActive && (
            <Badge variant="secondary" className="text-xs font-normal">
              <Package className="w-3 h-3 mr-1" /> {connection.productCount} Products
            </Badge>
          )}
        </div>

        <div className="pt-4 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {isActive && connection.connectedAt
              ? `Connected: ${new Date(connection.connectedAt).toLocaleDateString()}`
              : `Requested: ${new Date(connection.createdAt || Date.now()).toLocaleDateString()}`}
          </div>

          <div className="flex gap-2">
            {isPending && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                onClick={() => cancelRequest({ connectionId: connection.connectionId })}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : "Cancel"}
              </Button>
            )}

            {isActive && (
              <Button asChild size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                <Link href={`/dashboard/warehouses/${connection.warehouseSlug}`}>
                  Order <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            )}

            {isDisconnected && (
              <Button disabled variant="outline" size="sm" className="h-8 text-xs">
                Request Denied
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectWarehouseDialog() {
  const [open, setOpen] = useState(false);
  const [searchSlug, setSearchSlug] = useState("");
  const [submittedSlug, setSubmittedSlug] = useState("");

  const { data, isLoading, isError, error } = useLookupWarehouse(submittedSlug);
  const { mutate: connect, isPending: isConnecting } = useConnectToWarehouse();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchSlug.trim()) return;
    setSubmittedSlug(searchSlug.trim());
  };

  const handleConnect = () => {
    if (!data?.warehouse?.warehouseSlug) return;
    connect(
      { warehouseSlug: data.warehouse.warehouseSlug },
      {
        onSuccess: () => {
          setOpen(false);
          setSearchSlug("");
          setSubmittedSlug("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Warehouse className="w-4 h-4 mr-2" /> Connect Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:w-lg">
        <DialogHeader>
          <DialogTitle>Connect to a Warehouse</DialogTitle>
          <DialogDescription>
            Enter the warehouse code or slug provided by your supplier to request access to their catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchSlug}
              onChange={(e) => setSearchSlug(e.target.value)}
              placeholder="e.g. mims-distribution"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!searchSlug.trim() || isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="mt-4 min-h-[120px] flex flex-col justify-center">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-6">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-sm">Searching...</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-200 text-center">
              <AlertCircle className="w-6 h-6 mb-2" />
              <p className="text-sm font-medium">Warehouse not found</p>
              <p className="text-xs mt-1 text-amber-700">Please check the code and try again.</p>
            </div>
          )}

          {data?.warehouse && !isLoading && !isError && (
            <div className="border rounded-lg p-4 bg-muted/30 overflow-hidden">
              <div className="flex gap-3 items-center">
                <Avatar className="h-12 w-12 border bg-background shrink-0">
                  <AvatarImage src={data.warehouse.image || undefined} />
                  <AvatarFallback className="bg-primary/5 text-primary">
                    <Store className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-foreground truncate">
                    {data.warehouse.warehouseName || data.warehouse.name}
                  </h4>
                  <p className="text-sm text-muted-foreground truncate">
                    {data.warehouse.warehouseAddress || "No address"}
                  </p>
                  <p className="text-xs font-medium text-emerald-600 mt-1">
                    {data.warehouse.productCount} Products available
                  </p>
                </div>
              </div>
            </div>
          )}

          {!submittedSlug && !isLoading && !isError && (
            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">
              Enter a code above to search
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!data?.warehouse || isConnecting}
          >
            {isConnecting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Request...</>
            ) : (
              "Request Access"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
