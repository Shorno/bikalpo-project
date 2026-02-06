"use client";

import { format } from "date-fns";
import {
  CheckCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  List,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ItemRequestWithRelations } from "@/db/schema/item-request";
import { RequestFormModal } from "./request-form-modal";

interface RequestItemsListProps {
  requests: ItemRequestWithRelations[];
  onRefresh?: () => void;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-yellow-700", bg: "bg-yellow-50", label: "Pending" },
  approved: { color: "text-green-700", bg: "bg-green-50", label: "Approved" },
  rejected: { color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  suggested: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    label: "Alternative Suggested",
  },
};

function RequestCard({ request }: { request: ItemRequestWithRelations }) {
  const config = statusConfig[request.status] || statusConfig.pending;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 truncate">
            {request.requestNumber}
          </h3>
          <Badge
            className={`${config.bg} ${config.color} border-0 text-xs shrink-0`}
          >
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{format(new Date(request.createdAt), "MMM d, yyyy")}</span>
          <span>•</span>
          <span className="font-medium text-gray-900">
            Qty: {request.quantity}
          </span>
        </div>
      </div>

      {/* Item Info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden shrink-0 flex items-center justify-center">
            {request.image ? (
              <Image
                src={request.image}
                alt={request.itemName}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{request.itemName}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              {request.brand && <span>{request.brand}</span>}
              {request.brand && request.category && <span>•</span>}
              {request.category && <span>{request.category}</span>}
            </div>
          </div>
        </div>

        {/* Description */}
        {request.description && (
          <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-2">
            {request.description}
          </div>
        )}

        {/* Admin Response */}
        {request.adminResponse && (
          <div
            className={`mt-3 text-sm rounded p-2 ${
              request.status === "approved"
                ? "bg-green-50 text-green-800"
                : request.status === "rejected"
                  ? "bg-red-50 text-red-800"
                  : request.status === "suggested"
                    ? "bg-blue-50 text-blue-800"
                    : "bg-gray-50 text-gray-800"
            }`}
          >
            <span className="font-medium">Response: </span>
            {request.adminResponse}
          </div>
        )}

        {/* Suggested Product */}
        {request.status === "suggested" && request.suggestedProduct && (
          <div className="mt-3 flex items-center justify-between gap-3 bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white rounded overflow-hidden shrink-0 flex items-center justify-center border border-emerald-100">
                {request.suggestedProduct.image ? (
                  <Image
                    src={request.suggestedProduct.image}
                    alt={request.suggestedProduct.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {request.suggestedProduct.name}
                </p>
                <p className="text-sm font-bold text-emerald-700">
                  ৳{Number(request.suggestedProduct.price).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              asChild
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Link href={`/products/${request.suggestedProduct.id}`}>
                View
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function filterRequests(requests: ItemRequestWithRelations[], status: string) {
  if (status === "all") return requests;
  return requests.filter((request) => request.status === status);
}

function RequestsList({
  requests,
  status,
}: {
  requests: ItemRequestWithRelations[];
  status: string;
}) {
  const filtered = filterRequests(requests, status);

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">No requests found</h3>
        <p className="text-sm text-gray-500 mt-1">
          {status === "all"
            ? "Submit a request to ask us about products you need."
            : `No ${status} requests at the moment.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

export function RequestItemsList({
  requests,
  onRefresh,
}: RequestItemsListProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Request products that aren't in our catalog yet
          </p>
        </div>
        <RequestFormModal onSuccess={onRefresh} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-muted/50 mb-4">
          <TabsTrigger
            value="all"
            className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-600"
          >
            <List className="size-4" />
            <span className="hidden sm:inline">All</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
              {requests.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-yellow-600 dark:text-yellow-400"
          >
            <Clock className="size-4" />
            <span className="hidden sm:inline">Pending</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
              {requests.filter((r) => r.status === "pending").length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-green-600 dark:text-green-400"
          >
            <CheckCircle className="size-4" />
            <span className="hidden sm:inline">Approved</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
              {requests.filter((r) => r.status === "approved").length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="suggested"
            className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-blue-600 dark:text-blue-400"
          >
            <Lightbulb className="size-4" />
            <span className="hidden sm:inline">Alternatives</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
              {requests.filter((r) => r.status === "suggested").length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <RequestsList requests={requests} status="all" />
        </TabsContent>
        <TabsContent value="pending">
          <RequestsList requests={requests} status="pending" />
        </TabsContent>
        <TabsContent value="approved">
          <RequestsList requests={requests} status="approved" />
        </TabsContent>
        <TabsContent value="suggested">
          <RequestsList requests={requests} status="suggested" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
