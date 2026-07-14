"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  Search,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
type StatusFilter = "all" | "pending" | "approved" | "rejected";

type CatalogApprovalRequest = {
  id: number;
  requestType: RequestType;
  status: "pending" | "approved" | "rejected";
  payload: Record<string, any>;
  adminNote: string | null;
  createdEntityId: number | null;
  createdEntitySnapshot: Record<string, any> | null;
  createdAt: string | Date;
  requester?: {
    name: string | null;
    email: string;
    warehouseName: string | null;
    phoneNumber: string | null;
  } | null;
};

type RequestOptions = {
  types: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string; typeId: number | null }>;
  subCategories: Array<{ id: number; name: string; categoryId: number }>;
  units: string[];
};

const titles: Record<RequestType, string> = {
  brand: "Brand Requests",
  variant_option: "Variant Requests",
  core_product: "Core Product Requests",
};

function statusTone(status: CatalogApprovalRequest["status"]) {
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

function payloadTitle(type: RequestType, payload: Record<string, any>) {
  if (type === "brand") return payload.name || "Brand request";
  if (type === "variant_option") return payload.name || "Variant request";
  return payload.name || "Core product request";
}

function payloadMeta(
  type: RequestType,
  payload: Record<string, any>,
  options?: RequestOptions,
) {
  if (type === "brand") return payload.slug ? `/${payload.slug}` : "No slug";
  if (type === "variant_option") {
    const scope =
      payload.typeId === null
        ? "Global"
        : options?.types.find((type) => type.id === payload.typeId)?.name ||
          "Type scoped";
    return `${payload.variantType || "pack"} · ${payload.size || payload.unit} · ${scope}`;
  }
  const category = options?.categories.find(
    (item) => item.id === payload.categoryId,
  )?.name;
  const sub = options?.subCategories.find(
    (item) => item.id === payload.subCategoryId,
  )?.name;
  return [category, sub].filter(Boolean).join(" / ") || "Core product";
}

export function AdminCatalogRequests({
  requestType,
  title = titles[requestType],
}: {
  requestType: RequestType;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<CatalogApprovalRequest | null>(
    null,
  );
  const [rejecting, setRejecting] = useState<CatalogApprovalRequest | null>(
    null,
  );
  const [adminNote, setAdminNote] = useState("");

  const requestQueryKey = ["adminCatalogApproval", requestType, status, search];

  const requestsQuery = useQuery({
    queryKey: requestQueryKey,
    queryFn: () =>
      orpc.adminCatalogApproval.listRequests.call({
        requestType,
        status,
        search: search || undefined,
        limit: 50,
      }),
  });

  const optionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "requestOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
    enabled: requestType !== "brand",
  });

  const approveMutation = useMutation({
    mutationFn: (input: any) =>
      orpc.adminCatalogApproval.approveRequest.call(input),
    onSuccess: async () => {
      toast.success("Request approved");
      setApproving(null);
      setAdminNote("");
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
      setRejecting(null);
      setAdminNote("");
      await queryClient.invalidateQueries({
        queryKey: ["adminCatalogApproval"],
      });
    },
    onError: (error: any) => toast.error(error.message || "Reject failed"),
  });

  const requests = (requestsQuery.data?.requests ??
    []) as CatalogApprovalRequest[];
  const options = optionsQuery.data as RequestOptions | undefined;

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PackageCheck className="h-5 w-5 text-amber-600" />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Review warehouse submissions before adding them to the global
            catalog.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              className="pl-8 sm:w-56"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="divide-y">
        {requestsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No {status === "all" ? "" : status} {title.toLowerCase()} found.
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">
                    {payloadTitle(requestType, request.payload)}
                  </p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusTone(request.status)}`}
                  >
                    {request.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {payloadMeta(requestType, request.payload, options)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested by{" "}
                  {request.requester?.warehouseName ||
                    request.requester?.name ||
                    "Warehouse"}{" "}
                  on {formatDate(request.createdAt)}
                </p>
                {request.adminNote && (
                  <p className="mt-2 text-xs text-slate-600">
                    Admin note: {request.adminNote}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {request.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproving(request);
                        setAdminNote("");
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => {
                        setRejecting(request);
                        setAdminNote("");
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                ) : request.createdEntityId ? (
                  <Badge variant="outline">
                    Created ID #{request.createdEntityId}
                  </Badge>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {approving && (
        <ApproveDialog
          request={approving}
          options={options}
          adminNote={adminNote}
          setAdminNote={setAdminNote}
          onClose={() => setApproving(null)}
          onApprove={(payload) =>
            approveMutation.mutate({
              id: approving.id,
              requestType,
              payload,
              adminNote: adminNote || undefined,
            })
          }
          isPending={approveMutation.isPending}
        />
      )}

      <Dialog open={!!rejecting} onOpenChange={() => setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Admin note</Label>
            <Textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Explain why this request is rejected"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!adminNote.trim() || rejectMutation.isPending}
              onClick={() =>
                rejecting &&
                rejectMutation.mutate({
                  id: rejecting.id,
                  adminNote: adminNote.trim(),
                })
              }
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ApproveDialog({
  request,
  options,
  adminNote,
  setAdminNote,
  onApprove,
  onClose,
  isPending,
}: {
  request: CatalogApprovalRequest;
  options?: RequestOptions;
  adminNote: string;
  setAdminNote: (value: string) => void;
  onApprove: (payload: Record<string, any>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [payload, setPayload] = useState<Record<string, any>>(request.payload);

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
    setPayload((previous) => ({ ...previous, [key]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review {titles[request.requestType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {request.requestType === "brand" && (
            <>
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
            </>
          )}

          {request.requestType === "variant_option" && (
            <>
              <LabeledInput
                label="Variant Name"
                value={payload.name || ""}
                onChange={(value) => update("name", value)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Type Scope"
                  value={
                    payload.typeId === null ? "global" : String(payload.typeId)
                  }
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
                    payload.categoryId === null
                      ? "none"
                      : String(payload.categoryId)
                  }
                  onChange={(value) =>
                    update(
                      "categoryId",
                      value === "none" ? null : Number(value),
                    )
                  }
                  disabled={payload.typeId === null}
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
                  items={(options?.units ?? []).map((unit) => ({
                    value: unit,
                    label: unit,
                  }))}
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
            </>
          )}

          {request.requestType === "core_product" && (
            <>
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
                  value={payload.typeId ? String(payload.typeId) : ""}
                  onChange={(value) => {
                    update("typeId", Number(value));
                    update("categoryId", 0);
                    update("subCategoryId", null);
                  }}
                  items={
                    options?.types.map((type) => ({
                      value: String(type.id),
                      label: type.name,
                    })) ?? []
                  }
                />
                <SelectField
                  label="Category"
                  value={payload.categoryId ? String(payload.categoryId) : ""}
                  onChange={(value) => {
                    update("categoryId", Number(value));
                    update("subCategoryId", null);
                  }}
                  items={categories.map((category) => ({
                    value: String(category.id),
                    label: category.name,
                  }))}
                />
                <SelectField
                  label="Sub Category"
                  value={
                    payload.subCategoryId ? String(payload.subCategoryId) : ""
                  }
                  onChange={(value) => update("subCategoryId", Number(value))}
                  items={subCategories.map((subCategory) => ({
                    value: String(subCategory.id),
                    label: subCategory.name,
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={payload.description || ""}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Admin note</Label>
            <Textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Optional note for the warehouse"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onApprove(payload)} disabled={isPending}>
            {isPending ? "Approving..." : "Approve & Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
