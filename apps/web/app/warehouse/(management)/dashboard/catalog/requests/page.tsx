"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  FileText,
  Layers3,
  Package,
  Plus,
  Tags,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

type RequestType = "brand" | "variant_option" | "core_product";

type CatalogApprovalRequest = {
  id: number;
  requestType: RequestType;
  status: "pending" | "approved" | "rejected";
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

function statusIcon(status: CatalogApprovalRequest["status"]) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "rejected") return <XCircle className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function statusClass(status: CatalogApprovalRequest["status"]) {
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RequestType>("brand");

  const optionsQuery = useQuery({
    queryKey: ["warehouseCatalogApproval", "requestOptions"],
    queryFn: () => orpc.warehouseCatalogApproval.getRequestOptions.call({}),
  });

  const requestsQuery = useQuery({
    queryKey: ["warehouseCatalogApproval", "myRequests"],
    queryFn: () =>
      orpc.warehouseCatalogApproval.getMyRequests.call({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (input: any) =>
      orpc.warehouseCatalogApproval.createRequest.call(input),
    onSuccess: async (result) => {
      toast.success(result.message || "Request submitted");
      await queryClient.invalidateQueries({
        queryKey: ["warehouseCatalogApproval", "myRequests"],
      });
    },
    onError: (error: any) => toast.error(error.message || "Request failed"),
  });

  const requests = (requestsQuery.data?.requests ??
    []) as CatalogApprovalRequest[];
  const options = optionsQuery.data;

  return (
    <div className="space-y-6">
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
        <Badge variant="outline" className="w-fit">
          {requests.filter((request) => request.status === "pending").length}{" "}
          pending
        </Badge>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as RequestType)}
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="brand">
            <Tags className="h-4 w-4" />
            Brand Request
          </TabsTrigger>
          <TabsTrigger value="variant_option">
            <Package className="h-4 w-4" />
            Variant Request
          </TabsTrigger>
          <TabsTrigger value="core_product">
            <FileText className="h-4 w-4" />
            Core Product Request
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandRequestForm
            isPending={createMutation.isPending}
            onSubmit={(payload) =>
              createMutation.mutate({ requestType: "brand", payload })
            }
          />
        </TabsContent>

        <TabsContent value="variant_option">
          <VariantRequestForm
            options={options}
            isPending={createMutation.isPending}
            onSubmit={(payload) =>
              createMutation.mutate({ requestType: "variant_option", payload })
            }
          />
        </TabsContent>

        <TabsContent value="core_product">
          <CoreProductRequestForm
            options={options}
            isPending={createMutation.isPending}
            onSubmit={(payload) =>
              createMutation.mutate({ requestType: "core_product", payload })
            }
          />
        </TabsContent>
      </Tabs>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">My Requests</h2>
          <p className="text-sm text-muted-foreground">
            Track pending, approved, and rejected catalog submissions.
          </p>
        </div>
        <div className="divide-y">
          {requestsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No catalog requests yet.
            </div>
          ) : (
            requests.map((request) => (
              <RequestHistoryRow key={request.id} request={request} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function BrandRequestForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (payload: Record<string, any>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);

  return (
    <RequestCard title="Request a Brand">
      <div className="grid gap-4 lg:grid-cols-2">
        <LabeledInput
          label="Brand Name"
          value={name}
          onChange={(value) => {
            setName(value);
            setSlug(generateSlug(value));
          }}
          placeholder="Unilever"
        />
        <LabeledInput
          label="Slug"
          value={slug}
          onChange={setSlug}
          placeholder="unilever"
        />
        <LabeledInput
          label="Logo URL"
          value={logo}
          onChange={setLogo}
          placeholder="Optional"
        />
        <LabeledInput
          label="Display Order"
          type="number"
          value={String(displayOrder)}
          onChange={(value) => setDisplayOrder(Number(value))}
        />
      </div>
      <SubmitButton
        isPending={isPending}
        disabled={!name.trim() || !slug.trim()}
        onClick={() =>
          onSubmit({
            name,
            slug,
            logo: logo || undefined,
            displayOrder,
          })
        }
      />
    </RequestCard>
  );
}

function VariantRequestForm({
  options,
  onSubmit,
  isPending,
}: {
  options: any;
  onSubmit: (payload: Record<string, any>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [variantType, setVariantType] = useState<"pack" | "loose">("pack");
  const [unit, setUnit] = useState("KG");
  const [size, setSize] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const categories = useMemo(
    () =>
      options?.categories?.filter(
        (category: any) => category.typeId === typeId,
      ) ?? [],
    [options?.categories, typeId],
  );

  return (
    <RequestCard title="Request a Variant Option">
      <div className="grid gap-4 lg:grid-cols-3">
        <LabeledInput
          label="Variant Name"
          value={name}
          onChange={setName}
          placeholder="1KG Pack"
        />
        <SelectField
          label="Type Scope"
          value={typeId === null ? "global" : String(typeId)}
          onChange={(value) => {
            setTypeId(value === "global" ? null : Number(value));
            setCategoryId(null);
          }}
          items={[
            { value: "global", label: "Global" },
            ...(options?.types ?? []).map((type: any) => ({
              value: String(type.id),
              label: type.name,
            })),
          ]}
        />
        <SelectField
          label="Category Scope"
          value={categoryId === null ? "none" : String(categoryId)}
          onChange={(value) =>
            setCategoryId(value === "none" ? null : Number(value))
          }
          disabled={typeId === null}
          items={[
            { value: "none", label: "All categories" },
            ...categories.map((category: any) => ({
              value: String(category.id),
              label: category.name,
            })),
          ]}
        />
        <SelectField
          label="Variant Type"
          value={variantType}
          onChange={(value) => setVariantType(value as "pack" | "loose")}
          items={[
            { value: "pack", label: "Pack" },
            { value: "loose", label: "Loose" },
          ]}
        />
        <SelectField
          label="Unit"
          value={unit}
          onChange={setUnit}
          items={(options?.units ?? ["KG"]).map((unit: string) => ({
            value: unit,
            label: unit,
          }))}
        />
        <LabeledInput
          label="Size"
          value={size}
          onChange={setSize}
          placeholder="1, 5, XL"
        />
        <LabeledInput
          label="Sort Order"
          type="number"
          value={String(sortOrder)}
          onChange={(value) => setSortOrder(Number(value))}
        />
      </div>
      <SubmitButton
        isPending={isPending}
        disabled={!name.trim() || !unit}
        onClick={() =>
          onSubmit({
            name,
            unit,
            size: size || undefined,
            variantType,
            typeId,
            categoryId,
            sortOrder,
          })
        }
      />
    </RequestCard>
  );
}

function CoreProductRequestForm({
  options,
  onSubmit,
  isPending,
}: {
  options: any;
  onSubmit: (payload: Record<string, any>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [supportsPack, setSupportsPack] = useState(true);
  const [supportsLoose, setSupportsLoose] = useState(false);

  const categories = useMemo(
    () =>
      options?.categories?.filter(
        (category: any) => category.typeId === typeId,
      ) ?? [],
    [options?.categories, typeId],
  );
  const subCategories = useMemo(
    () =>
      options?.subCategories?.filter(
        (subCategory: any) => subCategory.categoryId === categoryId,
      ) ?? [],
    [options?.subCategories, categoryId],
  );

  return (
    <RequestCard title="Request a Core Product">
      <div className="grid gap-4 lg:grid-cols-3">
        <LabeledInput
          label="Product Name"
          value={name}
          onChange={(value) => {
            setName(value);
            setSlug(generateSlug(value));
          }}
          placeholder="Miniket Rice"
        />
        <LabeledInput
          label="Slug"
          value={slug}
          onChange={setSlug}
          placeholder="miniket-rice"
        />
        <LabeledInput
          label="SKU"
          value={sku}
          onChange={setSku}
          placeholder="Optional"
        />
        <LabeledInput
          label="Image URL"
          value={image}
          onChange={setImage}
          placeholder="Required"
        />
        <SelectField
          label="Type"
          value={typeId ? String(typeId) : "none"}
          onChange={(value) => {
            setTypeId(value === "none" ? null : Number(value));
            setCategoryId(null);
            setSubCategoryId(null);
          }}
          items={[
            { value: "none", label: "Select type" },
            ...(options?.types ?? []).map((type: any) => ({
              value: String(type.id),
              label: type.name,
            })),
          ]}
        />
        <SelectField
          label="Category"
          value={categoryId ? String(categoryId) : "none"}
          onChange={(value) => {
            setCategoryId(value === "none" ? null : Number(value));
            setSubCategoryId(null);
          }}
          disabled={!typeId}
          items={[
            { value: "none", label: "Select category" },
            ...categories.map((category: any) => ({
              value: String(category.id),
              label: category.name,
            })),
          ]}
        />
        <SelectField
          label="Sub Category"
          value={subCategoryId ? String(subCategoryId) : "none"}
          onChange={(value) =>
            setSubCategoryId(value === "none" ? null : Number(value))
          }
          disabled={!categoryId}
          items={[
            { value: "none", label: "No sub category" },
            ...subCategories.map((subCategory: any) => ({
              value: String(subCategory.id),
              label: subCategory.name,
            })),
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional product description"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={supportsPack}
            onChange={(event) => setSupportsPack(event.target.checked)}
          />
          Supports pack based variants
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={supportsLoose}
            onChange={(event) => setSupportsLoose(event.target.checked)}
          />
          Supports loose variants
        </label>
      </div>
      <SubmitButton
        isPending={isPending}
        disabled={
          !name.trim() ||
          !slug.trim() ||
          !image.trim() ||
          !typeId ||
          !categoryId
        }
        onClick={() =>
          onSubmit({
            sku: sku || undefined,
            name,
            slug,
            image,
            description: description || undefined,
            typeId,
            categoryId,
            subCategoryId,
            supportsPack,
            supportsLoose,
          })
        }
      />
    </RequestCard>
  );
}

function RequestCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SubmitButton({
  disabled,
  isPending,
  onClick,
}: {
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <Button disabled={disabled || isPending} onClick={onClick}>
      <Plus className="h-4 w-4" />
      {isPending ? "Submitting..." : "Submit Request"}
    </Button>
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
