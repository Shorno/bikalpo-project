"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Search,
  Store,
  XCircle,
  InboxIcon,
  Eye,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useStoreRequests,
  useStoreRequestStats,
  useApproveStoreRequest,
  useRejectStoreRequest,
} from "@/hooks/use-warehouse-connections";
import { toast } from "sonner";

export default function StoreRequestsPage() {
  const [statusTab, setStatusTab] = useState<"pending" | "disconnected">("pending");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  const { data: statsData, isLoading: isLoadingStats } = useStoreRequestStats();
  const { data: requestsData, isLoading: isLoadingRequests } = useStoreRequests({
    status: statusTab,
    search: search.trim() || undefined,
  });

  const { mutate: approveRequest, isPending: isApproving } = useApproveStoreRequest();
  const { mutate: rejectRequest, isPending: isRejecting } = useRejectStoreRequest();

  const handleApprove = (id: number) => {
    approveRequest({ connectionId: id }, {
      onSuccess: () => setSelectedRequest(null)
    });
  };

  const handleReject = (id: number) => {
    if (confirm("Are you sure you want to reject this request?")) {
      rejectRequest({ connectionId: id }, {
        onSuccess: () => setSelectedRequest(null)
      });
    }
  };

  const requests = requestsData?.items ?? [];
  const stats = statsData ?? { pending: 0, approved: 0, rejected: 0, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Store Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and manage incoming connection requests from retailers
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Clock className="w-6 h-6 text-amber-500 mb-2" />
            <h3 className="text-2xl font-bold text-gray-900">
              {isLoadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats.pending}
            </h3>
            <p className="text-xs font-medium text-gray-500">Pending Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
            <h3 className="text-2xl font-bold text-gray-900">
              {isLoadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats.approved}
            </h3>
            <p className="text-xs font-medium text-gray-500">Active Stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <XCircle className="w-6 h-6 text-red-500 mb-2" />
            <h3 className="text-2xl font-bold text-gray-900">
              {isLoadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats.rejected}
            </h3>
            <p className="text-xs font-medium text-gray-500">Rejected / Blocked</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Store className="w-6 h-6 text-blue-500 mb-2" />
            <h3 className="text-2xl font-bold text-blue-900">
              {isLoadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats.total}
            </h3>
            <p className="text-xs font-medium text-blue-600">Total Connections</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="pending" className="relative">
                Pending
                {stats.pending > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-1.5 h-4 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="disconnected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store name, phone..."
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="divide-y">
          {isLoadingRequests ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <InboxIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No {statusTab} requests found</p>
              <p className="text-sm mt-1">
                {search ? "Try adjusting your search filters." : "When retailers request to connect with your warehouse, they will appear here."}
              </p>
            </div>
          ) : (
            requests.map((req: any) => (
              <div key={req.connectionId} className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={req.image || undefined} />
                    <AvatarFallback className="bg-emerald-50 text-emerald-600">
                      <Store className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {req.shopName}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3" /> {req.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {req.phone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-auto">
                  <div className="text-xs text-gray-400 sm:text-right hidden sm:block">
                    <div>Requested on</div>
                    <div className="font-medium text-gray-600">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 hidden sm:flex"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <Eye className="w-4 h-4 mr-1.5" /> View Details
                    </Button>
                    
                    {statusTab === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => handleReject(req.connectionId)}
                          disabled={isRejecting || isApproving}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApprove(req.connectionId)}
                          disabled={isApproving || isRejecting}
                        >
                          {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} 
                          Approve
                        </Button>
                      </>
                    )}
                    
                    {statusTab === "disconnected" && (
                      <Button
                        size="sm"
                        className="h-8 bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleApprove(req.connectionId)}
                        disabled={isApproving || isRejecting}
                      >
                        {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-Approve"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(v) => !v && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Store Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={selectedRequest.image || undefined} />
                  <AvatarFallback className="bg-emerald-50 text-emerald-600">
                    <Store className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{selectedRequest.shopName}</h3>
                  <Badge variant={selectedRequest.status === "pending" ? "default" : "destructive"} className="mt-1">
                    {selectedRequest.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Owner Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Name</span>
                    <span className="font-medium">{selectedRequest.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Phone</span>
                    <span className="font-medium">{selectedRequest.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 block mb-0.5">Email</span>
                    <span className="font-medium">N/A</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Store Location</h4>
                <div className="text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700">{selectedRequest.address || "No address provided"}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Requested On
                </span>
                <span className="font-medium text-gray-900">
                  {new Date(selectedRequest.createdAt).toLocaleString()}
                </span>
              </div>

              {selectedRequest.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => handleReject(selectedRequest.connectionId)}
                    disabled={isRejecting || isApproving}
                  >
                    Reject Request
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprove(selectedRequest.connectionId)}
                    disabled={isApproving || isRejecting}
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} 
                    Approve Access
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
