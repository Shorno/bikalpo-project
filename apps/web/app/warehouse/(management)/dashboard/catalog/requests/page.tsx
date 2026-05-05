"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, Layers3, XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";
import BrandRequestModal from "./_components/brand-request-modal";
import VariantRequestModal from "./_components/variant-request-modal";
import CoreProductRequestModal from "./_components/core-product-request-modal";

type RequestType = "brand" | "variant_option" | "core_product";
type RequestStatus = "pending" | "approved" | "rejected";

type CatalogApprovalRequest = {
  id: number;
  requestType: RequestType;
  status: RequestStatus;
  payload: Record<string, any>;
  adminNote: string | null;
  createdEntityId: number | null;
  createdEntitySnapshot: Record<string, any> | null;
  createdAt: string | Date;
};

const requestLabels: Record<RequestType, string> = {
  brand: "Brand",
  variant_option: "Variant",
  core_product: "Core Product",
};

function statusIcon(status: RequestStatus) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "rejected") return <XCircle className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function statusClass(status: RequestStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function WarehouseCatalogRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");

  const optionsQuery = useQuery({
    queryKey: ["warehouseCatalogApproval", "requestOptions"],
    queryFn: () => orpc.warehouseCatalogApproval.getRequestOptions.call({}),
  });

  const requestsQuery = useQuery({
    queryKey: ["warehouseCatalogApproval", "myRequests"],
    queryFn: () =>
      orpc.warehouseCatalogApproval.getMyRequests.call({ limit: 100 }),
  });

  const requests = (requestsQuery.data?.requests ?? []) as CatalogApprovalRequest[];
  const options = optionsQuery.data;

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Layers3 className="h-5 w-5" />
            </span>
            Catalog Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request global brands, reusable variants, and core products for
            admin approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BrandRequestModal />
          <VariantRequestModal options={options} />
          <CoreProductRequestModal options={options} />
        </div>
      </div>

      {/* Request History */}
      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">My Requests</h2>
              <p className="text-sm text-muted-foreground">
                Track pending, approved, and rejected catalog submissions.
              </p>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList className="h-auto">
                <TabsTrigger value="all" className="text-xs">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">Pending ({counts.pending})</TabsTrigger>
                <TabsTrigger value="approved" className="text-xs">Approved ({counts.approved})</TabsTrigger>
                <TabsTrigger value="rejected" className="text-xs">Rejected ({counts.rejected})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="divide-y">
          {requestsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "No catalog requests yet. Use the buttons above to submit your first request."
                : `No ${statusFilter} requests.`}
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestHistoryRow key={request.id} request={request} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RequestHistoryRow({ request }: { request: CatalogApprovalRequest }) {
  const title =
    request.payload.name ||
    request.payload.productName ||
    requestLabels[request.requestType];
  const createdName = request.createdEntitySnapshot?.name;

  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{title}</p>
          <Badge variant="outline">{requestLabels[request.requestType]}</Badge>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(request.status)}`}
          >
            {statusIcon(request.status)}
            {request.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Submitted {formatDate(request.createdAt)}
          {createdName ? ` · Created: ${createdName}` : ""}
        </p>
        {request.adminNote && (
          <p className="mt-2 text-sm text-slate-600">
            Admin note: {request.adminNote}
          </p>
        )}
      </div>
      {request.createdEntityId && (
        <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          Catalog ID #{request.createdEntityId}
        </Badge>
      )}
    </div>
  );
}
