"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  ImageIcon,
  type Layers3,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Store,
  User,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SetupEntityTable,
  SetupErrorState,
  SetupMetricStrip,
  SetupPageHeader,
  SetupPageShell,
  SetupStatusBadge,
  SetupToolbar,
} from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

type RequestType = "brand" | "variant_option" | "core_product";
type RequestTypeFilter = RequestType | "all";
type RequestStatus = "pending" | "approved" | "rejected";
type StatusFilter = RequestStatus | "all";
type DateRange =
  | "all"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "this_month";

type RequestPayload = Record<string, any>;

type CatalogApprovalRequest = {
  id: number;
  requestType: RequestType;
  status: RequestStatus;
  payload: RequestPayload;
  adminNote: string | null;
  createdEntityId: number | null;
  createdEntitySnapshot: Record<string, any> | null;
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
  requester?: {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    shopName: string | null;
    warehouseName: string | null;
    phoneNumber: string | null;
  } | null;
  reviewer?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type RequestOptions = {
  types: Array<{ id: number; name: string; slug?: string }>;
  categories: Array<{
    id: number;
    name: string;
    slug?: string;
    typeId: number | null;
  }>;
  subCategories: Array<{
    id: number;
    name: string;
    slug?: string;
    categoryId: number;
  }>;
  brands?: Array<{ id: number; name: string; slug: string }>;
  variantOptions?: Array<{
    id: number;
    name: string;
    unit: string;
    size: string | null;
    variantType: "pack" | "loose";
    typeId: number | null;
    categoryId: number | null;
  }>;
  coreProducts?: Array<{
    id: number;
    name: string;
    slug: string;
    sku: string;
    categoryId: number;
    subCategoryId: number | null;
  }>;
  units: string[];
};

type RequestStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

const requestTypeLabels: Record<RequestType, string> = {
  brand: "Brand",
  variant_option: "Variant",
  core_product: "Core Product",
};

const statusLabels: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const statusClasses: Record<RequestStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const typeClasses: Record<RequestType, string> = {
  brand: "border-sky-200 bg-sky-50 text-sky-700",
  variant_option: "border-amber-200 bg-amber-50 text-amber-700",
  core_product: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function _formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRole(role?: string | null) {
  if (!role) return "User";
  if (role === "shop_owner") return "Retailer";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function requesterName(request: CatalogApprovalRequest) {
  const requester = request.requester;
  return (
    requester?.warehouseName ||
    requester?.shopName ||
    requester?.name ||
    requester?.email ||
    "Unknown requester"
  );
}

function itemName(
  request: Pick<CatalogApprovalRequest, "requestType" | "payload">,
) {
  return (
    request.payload.name ||
    request.payload.productName ||
    `${requestTypeLabels[request.requestType]} request`
  );
}

function findType(options: RequestOptions | undefined, id: unknown) {
  return options?.types.find((type) => type.id === Number(id));
}

function findCategory(options: RequestOptions | undefined, id: unknown) {
  return options?.categories.find((category) => category.id === Number(id));
}

function findSubCategory(options: RequestOptions | undefined, id: unknown) {
  return options?.subCategories.find(
    (subCategory) => subCategory.id === Number(id),
  );
}

function mappingRows(
  request: Pick<CatalogApprovalRequest, "requestType">,
  payload: RequestPayload,
  options: RequestOptions | undefined,
) {
  if (request.requestType === "core_product") {
    const category = findCategory(options, payload.categoryId);
    return [
      {
        label: "Type",
        value: findType(options, payload.typeId)?.name || "Not selected",
      },
      { label: "Category", value: category?.name || "Not selected" },
      {
        label: "Sub Category",
        value: payload.subCategoryId
          ? findSubCategory(options, payload.subCategoryId)?.name || "Not found"
          : "None",
      },
      { label: "Core Identity", value: payload.name || "New core product" },
    ];
  }

  if (request.requestType === "variant_option") {
    const isGlobal = payload.typeId === null || payload.typeId === undefined;
    return [
      {
        label: "Type",
        value: isGlobal
          ? "Global"
          : findType(options, payload.typeId)?.name || "Not found",
      },
      {
        label: "Category",
        value: isGlobal
          ? "All categories"
          : payload.categoryId
            ? findCategory(options, payload.categoryId)?.name || "Not found"
            : "All categories in type",
      },
      { label: "Sub Category", value: "All matching sub categories" },
      { label: "Core Identity", value: "All matching core products" },
    ];
  }

  return [
    { label: "Type", value: "Global catalog" },
    { label: "Category", value: "Not captured in current brand request" },
    { label: "Sub Category", value: "Not captured in current brand request" },
    { label: "Core Identity", value: "Not captured in current brand request" },
  ];
}

function parentMapping(
  request: Pick<CatalogApprovalRequest, "requestType" | "payload">,
  options: RequestOptions | undefined,
) {
  const rows = mappingRows(request, request.payload, options);
  if (request.requestType === "brand") return "Global brand catalog";
  return rows
    .filter(
      (row) =>
        row.label !== "Core Identity" || request.requestType === "core_product",
    )
    .map((row) => row.value)
    .filter(Boolean)
    .join(" / ");
}

type PayloadField = {
  label: string;
  value: unknown;
  fieldType?: "text" | "image" | "boolean";
};

function payloadSummary(
  requestType: RequestType,
  payload: RequestPayload,
): PayloadField[] {
  if (requestType === "brand") {
    return [
      { label: "Brand Name", value: payload.name },
      { label: "Slug", value: payload.slug },
      { label: "Logo", value: payload.logo || null, fieldType: "image" },
      { label: "Display Order", value: payload.displayOrder ?? 0 },
    ];
  }

  if (requestType === "variant_option") {
    return [
      { label: "Variant Name", value: payload.name },
      { label: "Variant Type", value: payload.variantType || "pack" },
      { label: "Unit", value: payload.unit },
      { label: "Size", value: payload.size || "Generic" },
      { label: "Sort Order", value: payload.sortOrder ?? 0 },
    ];
  }

  return [
    { label: "Core Product Name", value: payload.name },
    { label: "SKU", value: payload.sku || "Auto-generate" },
    { label: "Slug", value: payload.slug },
    { label: "Image", value: payload.image || null, fieldType: "image" },
    { label: "Description", value: payload.description || "None" },
  ];
}

function exportRequests(
  requests: CatalogApprovalRequest[],
  options: RequestOptions | undefined,
) {
  const headers = [
    "#",
    "Request Type",
    "Requested Item",
    "Parent Mapping",
    "Requested By",
    "Requester Role",
    "Status",
    "Request Date",
  ];
  const rows = requests.map((request, index) => [
    index + 1,
    requestTypeLabels[request.requestType],
    itemName(request),
    parentMapping(request, options),
    requesterName(request),
    formatRole(request.requester?.role),
    statusLabels[request.status],
    formatDate(request.createdAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `setup-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminSetupRequestsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [requestTypeValue, setRequestType] = useQueryState(
    "type",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [statusValue, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("pending").withOptions({ clearOnDefault: true }),
  );
  const [dateRangeValue, setDateRange] = useQueryState(
    "date",
    parseAsString
      .withDefault("last_7_days")
      .withOptions({ clearOnDefault: true }),
  );
  const requestType = requestTypeValue as RequestTypeFilter;
  const status = statusValue as StatusFilter;
  const dateRange = dateRangeValue as DateRange;
  const [selectedRequest, setSelectedRequest] =
    useState<CatalogApprovalRequest | null>(null);

  const listInput = {
    requestType: requestType === "all" ? undefined : requestType,
    status,
    dateRange,
    search: search.trim() || undefined,
    limit: 100,
  };

  const requestsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "setupRequests", listInput],
    queryFn: () => orpc.adminCatalogApproval.listRequests.call(listInput),
  });

  const statsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "stats"],
    queryFn: () => orpc.adminCatalogApproval.getStats.call({}),
  });

  const optionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "requestOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
  });

  const approveMutation = useMutation({
    mutationFn: (input: {
      request: CatalogApprovalRequest;
      payload: RequestPayload;
      adminNote?: string;
    }) =>
      orpc.adminCatalogApproval.approveRequest.call({
        id: input.request.id,
        requestType: input.request.requestType,
        payload: input.payload,
        adminNote: input.adminNote || undefined,
      } as any),
    onSuccess: async () => {
      toast.success("Request approved");
      setSelectedRequest(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminCatalogApproval"] }),
        queryClient.invalidateQueries({ queryKey: orpc.brand.getAll.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.adminVariantOption.getAll.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        }),
      ]);
    },
    onError: (error: any) => toast.error(error.message || "Approval failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { id: number; adminNote: string }) =>
      orpc.adminCatalogApproval.rejectRequest.call(input),
    onSuccess: async () => {
      toast.success("Request rejected");
      setSelectedRequest(null);
      await queryClient.invalidateQueries({
        queryKey: ["adminCatalogApproval"],
      });
    },
    onError: (error: any) => toast.error(error.message || "Reject failed"),
  });

  const stats = (statsQuery.data ?? {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  }) as RequestStats;
  const requests = (requestsQuery.data?.requests ??
    []) as CatalogApprovalRequest[];
  const options = optionsQuery.data as RequestOptions | undefined;
  const currentSelection =
    requests.find((request) => request.id === selectedRequest?.id) ??
    selectedRequest;

  const isRefreshing =
    requestsQuery.isFetching ||
    statsQuery.isFetching ||
    optionsQuery.isFetching;

  const refresh = async () => {
    await Promise.all([
      requestsQuery.refetch(),
      statsQuery.refetch(),
      optionsQuery.refetch(),
    ]);
  };

  const columns = useMemo<ColumnDef<CatalogApprovalRequest, unknown>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "requestType",
        header: "Request type",
        cell: ({ row }) => (
          <Badge variant="outline">
            {requestTypeLabels[row.original.requestType]}
          </Badge>
        ),
      },
      {
        id: "item",
        header: "Requested item",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{itemName(row.original)}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatDate(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        id: "mapping",
        header: "Parent mapping",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {parentMapping(row.original, options)}
          </span>
        ),
      },
      {
        id: "requester",
        header: "Requested by",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{requesterName(row.original)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRole(row.original.requester?.role)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <SetupStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              onClick={() => setSelectedRequest(row.original)}
              size="sm"
              variant="outline"
            >
              Review
            </Button>
          </div>
        ),
      },
    ],
    [options],
  );

  return (
    <SetupPageShell>
      <SetupPageHeader
        count={stats.total}
        secondaryActions={
          <>
            <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => exportRequests(requests, options)}
              disabled={requests.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
        title="Setup Requests"
      />

      <SetupMetricStrip
        metrics={[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Approved", value: stats.approved },
          { label: "Rejected", value: stats.rejected },
        ]}
      />

      <SetupToolbar
        filterDefinitions={[
          {
            key: "requestType",
            label: "Request type",
            value: requestType,
            onChange: (value) => void setRequestType(value),
            options: [
              { value: "all", label: "All types" },
              { value: "brand", label: "Brand" },
              { value: "variant_option", label: "Variant" },
              { value: "core_product", label: "Core Identity" },
            ],
            widthClassName: "md:w-44",
          },
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: (value) => void setStatus(value),
            options: [
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ],
          },
          {
            key: "dateRange",
            label: "Date",
            value: dateRange,
            onChange: (value) => void setDateRange(value),
            options: [
              { value: "last_7_days", label: "Last 7 days" },
              { value: "last_30_days", label: "Last 30 days" },
              { value: "today", label: "Today" },
              { value: "this_month", label: "This month" },
              { value: "all", label: "All time" },
            ],
            widthClassName: "md:w-44",
          },
        ]}
        hasActiveFilters={Boolean(
          search ||
            requestType !== "all" ||
            status !== "pending" ||
            dateRange !== "last_7_days",
        )}
        onClear={() => {
          void setSearch("");
          void setRequestType("all");
          void setStatus("pending");
          void setDateRange("last_7_days");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search item or requester"
        searchValue={search}
      />

      {requestsQuery.isLoading ||
      statsQuery.isLoading ||
      optionsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading setup
          requests…
        </div>
      ) : requestsQuery.isError ||
        statsQuery.isError ||
        optionsQuery.isError ? (
        <SetupErrorState onRetry={() => void refresh()} />
      ) : (
        <SetupEntityTable
          columns={columns}
          data={requests}
          emptyDescription="No requests match the current filters."
          emptyTitle="No Setup Requests"
          getRowId={(request) => String(request.id)}
          mobile={{
            onSelect: setSelectedRequest,
            title: itemName,
            description: (request) => requestTypeLabels[request.requestType],
            meta: (request) => [
              requesterName(request),
              formatDate(request.createdAt),
            ],
            status: (request) => <SetupStatusBadge status={request.status} />,
          }}
        />
      )}

      {currentSelection && (
        <RequestDetailDialog
          request={currentSelection}
          options={options}
          open={!!currentSelection}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setSelectedRequest(null);
          }}
          onApprove={(payload, adminNote) =>
            approveMutation.mutate({
              request: currentSelection,
              payload,
              adminNote,
            })
          }
          onReject={(adminNote) =>
            rejectMutation.mutate({
              id: currentSelection.id,
              adminNote,
            })
          }
        />
      )}
    </SetupPageShell>
  );
}

function RequestDetailDialog({
  request,
  options,
  open,
  isApproving,
  isRejecting,
  onOpenChange,
  onApprove,
  onReject,
}: {
  request: CatalogApprovalRequest;
  options: RequestOptions | undefined;
  open: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (payload: RequestPayload, adminNote?: string) => void;
  onReject: (adminNote: string) => void;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [draftPayload, setDraftPayload] = useState<RequestPayload>(
    request.payload,
  );

  useEffect(() => {
    setAdminNote("");
    setEditMode(false);
    setDraftPayload(request.payload);
  }, [request.payload]);

  const activePayload = editMode ? draftPayload : request.payload;
  const mapping = mappingRows(request, activePayload, options);
  const canReview = request.status === "pending";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {/* ── Header ── */}
        <div className="border-b bg-slate-50/60 px-4 py-3">
          <DialogHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle className="text-base font-semibold">
                {itemName(request)}
              </DialogTitle>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`${typeClasses[request.requestType]} px-2 py-0.5 text-[11px]`}
                >
                  {requestTypeLabels[request.requestType]}
                </Badge>
                <Badge
                  variant="outline"
                  className={`${statusClasses[request.status]} px-2 py-0.5 text-[11px]`}
                >
                  {statusLabels[request.status]}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs">
              By {requesterName(request)} · {formatDate(request.createdAt)}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            {/* ── Left Column ── */}
            <div className="space-y-3">
              {/* Mapping */}
              <DetailSection title="Mapping" icon={Link2}>
                <div className="flex flex-wrap items-center gap-1">
                  {mapping.map((row, i) => (
                    <div key={row.label} className="flex items-center gap-1">
                      <div className="rounded border bg-white px-2 py-1">
                        <p className="text-[9px] font-medium uppercase text-muted-foreground">
                          {row.label}
                        </p>
                        <p className="text-xs font-medium text-slate-800">
                          {String(row.value)}
                        </p>
                      </div>
                      {i < mapping.length - 1 && (
                        <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </DetailSection>

              {/* Request Data */}
              <DetailSection
                title="Request Data"
                icon={FileText}
                action={
                  canReview ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setEditMode((v) => !v)}
                    >
                      <Pencil className="mr-1 h-2.5 w-2.5" />
                      {editMode ? "Cancel" : "Edit"}
                    </Button>
                  ) : undefined
                }
              >
                {editMode ? (
                  <PayloadEditor
                    requestType={request.requestType}
                    payload={draftPayload}
                    options={options}
                    onChange={setDraftPayload}
                  />
                ) : (
                  <PayloadDisplay
                    requestType={request.requestType}
                    payload={activePayload}
                  />
                )}
              </DetailSection>
            </div>

            {/* ── Right Column ── */}
            <div className="space-y-3">
              {/* Request Info */}
              <DetailSection title="Request Info" icon={User}>
                <div className="space-y-2">
                  <RequesterInfoRow
                    icon={Store}
                    label="Requested By"
                    value={requesterName(request)}
                  />
                  <RequesterInfoRow
                    icon={User}
                    label="Role"
                    value={formatRole(request.requester?.role)}
                  />
                  <RequesterInfoRow
                    icon={Mail}
                    label="Email"
                    value={request.requester?.email || "--"}
                  />
                  <RequesterInfoRow
                    icon={Phone}
                    label="Phone"
                    value={request.requester?.phoneNumber || "--"}
                  />
                </div>
              </DetailSection>

              {/* Request History */}
              <DetailSection title="History" icon={Clock3}>
                <div className="relative space-y-0 pl-3">
                  <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200" />
                  <HistoryTimelineItem
                    date={formatDate(request.createdAt)}
                    action="Requested"
                    by={requesterName(request)}
                    dotColor="bg-sky-500"
                  />
                  {request.reviewedAt ? (
                    <HistoryTimelineItem
                      date={formatDate(request.reviewedAt)}
                      action={statusLabels[request.status]}
                      by={
                        request.reviewer?.name ||
                        request.reviewer?.email ||
                        "Admin"
                      }
                      dotColor={
                        request.status === "approved"
                          ? "bg-emerald-500"
                          : request.status === "rejected"
                            ? "bg-red-500"
                            : "bg-amber-500"
                      }
                    />
                  ) : (
                    <HistoryTimelineItem
                      date="Now"
                      action="Awaiting review"
                      by="Admin"
                      dotColor="bg-amber-400"
                      muted
                    />
                  )}
                </div>
              </DetailSection>

              {/* Action */}
              {canReview && (
                <DetailSection title="Action" icon={Pencil}>
                  <div className="space-y-2">
                    <Textarea
                      id="setup-request-admin-note"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Admin note (required for rejection)"
                      className="min-h-[60px] resize-none text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={isApproving || isRejecting}
                        onClick={() =>
                          onApprove(
                            activePayload,
                            adminNote.trim() || undefined,
                          )
                        }
                      >
                        {isApproving ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {isApproving ? "..." : "Approve"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={
                          !adminNote.trim() || isRejecting || isApproving
                        }
                        onClick={() => onReject(adminNote.trim())}
                      >
                        {isRejecting ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {isRejecting ? "..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                </DetailSection>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end border-t bg-slate-50/60 px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Layers3;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-slate-400" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function PayloadDisplay({
  requestType,
  payload,
}: {
  requestType: RequestType;
  payload: RequestPayload;
}) {
  const fields = payloadSummary(requestType, payload);
  const imageFields = fields.filter((f) => f.fieldType === "image");
  const textFields = fields.filter((f) => f.fieldType !== "image");

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {textFields.map((field) => (
          <div key={field.label} className="rounded bg-slate-50 px-2 py-1.5">
            <p className="text-[9px] font-medium uppercase text-muted-foreground">
              {field.label}
            </p>
            <p className="text-xs font-medium text-slate-800">
              {field.fieldType === "boolean" ? (
                <span
                  className={
                    String(field.value) === "Yes"
                      ? "text-emerald-600"
                      : "text-slate-500"
                  }
                >
                  {String(field.value)}
                </span>
              ) : (
                String(field.value ?? "--")
              )}
            </p>
          </div>
        ))}
      </div>

      {imageFields.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {imageFields.map((field) => (
            <div key={field.label} className="space-y-1">
              <p className="text-[9px] font-medium uppercase text-muted-foreground">
                {field.label}
              </p>
              <ImagePreview
                src={field.value as string | null}
                alt={field.label}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagePreview({
  src,
  alt,
}: {
  src: string | null | undefined;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src) {
    return (
      <div className="flex h-16 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50">
        <div className="text-center">
          <ImageIcon className="mx-auto h-4 w-4 text-slate-300" />
          <p className="text-[10px] text-muted-foreground">No image</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-16 items-center justify-center rounded border border-amber-200 bg-amber-50">
        <div className="text-center">
          <ImageIcon className="mx-auto h-4 w-4 text-amber-400" />
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 hover:underline"
          >
            Open URL <ArrowRight className="h-2 w-2" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border bg-white">
      <div className="flex h-16 items-center justify-center bg-slate-50/50 p-1">
        <Image
          alt={alt}
          className="max-h-full max-w-full rounded object-contain"
          height={64}
          onError={() => setHasError(true)}
          src={src}
          unoptimized
          width={160}
        />
      </div>
      <div className="flex items-center justify-between border-t px-2 py-1">
        <p className="max-w-[120px] truncate text-[10px] text-muted-foreground">
          {src}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-sky-600 hover:underline"
        >
          Open
        </a>
      </div>
    </div>
  );
}

function RequesterInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-3 w-3 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function HistoryTimelineItem({
  date,
  action,
  by,
  dotColor,
  muted = false,
}: {
  date: string;
  action: string;
  by: string;
  dotColor: string;
  muted?: boolean;
}) {
  return (
    <div className="relative pb-2.5 pl-4 last:pb-0">
      <div
        className={`absolute left-0 top-1 h-[7px] w-[7px] rounded-full ring-2 ring-white ${dotColor}`}
      />
      <div className={muted ? "opacity-60" : ""}>
        <p className="text-xs font-medium text-slate-800">{action}</p>
        <p className="text-[10px] text-muted-foreground">
          {by} · {date}
        </p>
      </div>
    </div>
  );
}

function _SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
      {title}
    </h2>
  );
}

function _InfoField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-normal break-words text-sm font-medium text-slate-900">
        {String(value ?? "--")}
      </p>
    </div>
  );
}

function PayloadEditor({
  requestType,
  payload,
  options,
  onChange,
}: {
  requestType: RequestType;
  payload: RequestPayload;
  options: RequestOptions | undefined;
  onChange: (payload: RequestPayload) => void;
}) {
  const categories = useMemo(
    () =>
      options?.categories.filter(
        (category) => category.typeId === Number(payload.typeId),
      ) ?? [],
    [options?.categories, payload.typeId],
  );

  const subCategories = useMemo(
    () =>
      options?.subCategories.filter(
        (subCategory) => subCategory.categoryId === Number(payload.categoryId),
      ) ?? [],
    [options?.subCategories, payload.categoryId],
  );

  const update = (key: string, value: any) =>
    onChange({ ...payload, [key]: value });

  if (requestType === "brand") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledInput
          label="Brand Name"
          value={payload.name || ""}
          onChange={(value) => {
            update("name", value);
            update("slug", generateSlug(value));
          }}
        />
        <LabeledInput
          label="Slug"
          value={payload.slug || ""}
          onChange={(value) => update("slug", value)}
        />
        <LabeledInput
          label="Logo URL"
          value={payload.logo || ""}
          onChange={(value) => update("logo", value)}
        />
        <LabeledInput
          label="Display Order"
          type="number"
          value={String(payload.displayOrder ?? 0)}
          onChange={(value) => update("displayOrder", Number(value))}
        />
      </div>
    );
  }

  if (requestType === "variant_option") {
    return (
      <div className="space-y-3">
        <LabeledInput
          label="Variant Name"
          value={payload.name || ""}
          onChange={(value) => update("name", value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Type Scope"
            value={payload.typeId == null ? "global" : String(payload.typeId)}
            onChange={(value) => {
              update("typeId", value === "global" ? null : Number(value));
              update("categoryId", null);
            }}
            items={[
              { value: "global", label: "Global" },
              ...(options?.types.map((type) => ({
                value: String(type.id),
                label: type.name,
              })) ?? []),
            ]}
          />
          <SelectField
            label="Category Scope"
            value={
              payload.categoryId == null ? "none" : String(payload.categoryId)
            }
            onChange={(value) =>
              update("categoryId", value === "none" ? null : Number(value))
            }
            disabled={payload.typeId == null}
            items={[
              { value: "none", label: "All categories" },
              ...categories.map((category) => ({
                value: String(category.id),
                label: category.name,
              })),
            ]}
          />
          <SelectField
            label="Variant Type"
            value={payload.variantType || "pack"}
            onChange={(value) => update("variantType", value)}
            items={[
              { value: "pack", label: "Pack" },
              { value: "loose", label: "Loose" },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Unit"
            value={payload.unit || "KG"}
            onChange={(value) => update("unit", value)}
            items={(options?.units?.length ? options.units : ["KG"]).map(
              (unit) => ({
                value: unit,
                label: unit,
              }),
            )}
          />
          <LabeledInput
            label="Size"
            value={payload.size || ""}
            onChange={(value) => update("size", value)}
          />
          <LabeledInput
            label="Sort Order"
            type="number"
            value={String(payload.sortOrder ?? 0)}
            onChange={(value) => update("sortOrder", Number(value))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <LabeledInput
        label="Product Name"
        value={payload.name || ""}
        onChange={(value) => {
          update("name", value);
          update("slug", generateSlug(value));
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledInput
          label="SKU"
          value={payload.sku || ""}
          onChange={(value) => update("sku", value)}
          placeholder="Leave empty to auto-generate"
        />
        <LabeledInput
          label="Slug"
          value={payload.slug || ""}
          onChange={(value) => update("slug", value)}
        />
        <LabeledInput
          label="Image URL"
          value={payload.image || ""}
          onChange={(value) => update("image", value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Type"
          value={payload.typeId ? String(payload.typeId) : "none"}
          onChange={(value) => {
            update("typeId", value === "none" ? null : Number(value));
            update("categoryId", 0);
            update("subCategoryId", null);
          }}
          items={[
            { value: "none", label: "Select type" },
            ...(options?.types.map((type) => ({
              value: String(type.id),
              label: type.name,
            })) ?? []),
          ]}
        />
        <SelectField
          label="Category"
          value={payload.categoryId ? String(payload.categoryId) : "none"}
          onChange={(value) => {
            update("categoryId", value === "none" ? 0 : Number(value));
            update("subCategoryId", null);
          }}
          items={[
            { value: "none", label: "Select category" },
            ...categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            })),
          ]}
        />
        <SelectField
          label="Sub Category"
          value={payload.subCategoryId ? String(payload.subCategoryId) : "none"}
          onChange={(value) =>
            update("subCategoryId", value === "none" ? null : Number(value))
          }
          items={[
            { value: "none", label: "No sub category" },
            ...subCategories.map((subCategory) => ({
              value: String(subCategory.id),
              label: subCategory.name,
            })),
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={payload.description || ""}
          onChange={(event) => update("description", event.target.value)}
        />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  items,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
