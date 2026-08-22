"use client";

import type { OfferTemplate } from "@bikalpo-project/db/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Eye,
  FileStack,
  Filter,
  Layers3,
  Plus,
  Search,
  Store,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { OfferTemplateForm } from "@/components/admin/offers/offer-template-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/utils/orpc";

const ALL = "all";

const typeLabels: Record<string, string> = {
  discount: "Discount",
  cashback: "Cashback",
  combo: "Combo",
};

const statusStyles: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  disabled: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

function sentenceCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function benefitLabel(template: OfferTemplate) {
  if (
    template.type === "combo" &&
    template.comboRule === "buy_x_get_y" &&
    template.buyProducts.length > 0 &&
    template.getProducts.length > 0
  ) {
    const buy = template.buyProducts.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const get = template.getProducts.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    if (template.benefitType === "free_product")
      return `Buy ${buy}, Get ${get} Free`;
    if (template.benefitType === "percentage_discount") {
      return `Buy ${buy}, Get ${get} at ${Number(template.benefitValue)}% off`;
    }
    return `Buy ${buy}, Get ${get} at ৳${Number(template.benefitValue)}`;
  }
  if (template.benefitType === "cashback_amount") {
    return `৳${Number(template.benefitValue).toLocaleString("en-BD")} back`;
  }
  if (template.benefitType === "percentage_discount") {
    return `${Number(template.benefitValue)}% off`;
  }
  return `৳${Number(template.benefitValue ?? 0).toLocaleString("en-BD")} discount`;
}

function scopeLabel(template: OfferTemplate) {
  if (template.applyOn === "full_store") return "Full store";
  if (template.targetSelection.length > 0) {
    return template.targetSelection.map((item) => item.label).join(", ");
  }
  if (template.buyProducts.length > 0) {
    return [...new Set(template.buyProducts.map((item) => item.category))].join(
      ", ",
    );
  }
  return sentenceCase(template.applyOn);
}

function formatDate(value: Date | string | null) {
  if (!value) return "No limit";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Layers3;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-r px-4 py-4 last:border-r-0">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

export function OfferManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<OfferTemplate | null>(null);
  const [editing, setEditing] = useState<OfferTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["offer-templates"],
    queryFn: () => client.adminOfferTemplate.getAll(),
  });
  const templates = useMemo(
    () =>
      ((templatesQuery.data ?? []) as OfferTemplate[]).map((template) =>
        template.status === "scheduled"
          ? { ...template, status: "draft" }
          : template,
      ),
    [templatesQuery.data],
  );

  const counts = useMemo(
    () => ({
      total: templates.length,
      active: templates.filter((item) => item.status === "active").length,
      draft: templates.filter((item) => item.status === "draft").length,
      disabled: templates.filter((item) => item.status === "disabled").length,
    }),
    [templates],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.code.toLowerCase().includes(query);
      return (
        matchesSearch &&
        (typeFilter === ALL || template.type === typeFilter) &&
        (statusFilter === ALL || template.status === statusFilter)
      );
    });
  }, [search, statusFilter, templates, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (template: OfferTemplate) => {
    setSelected(null);
    setEditing(template);
    setFormOpen(true);
  };

  const changeStatus = async (
    template: OfferTemplate,
    status: "active" | "draft" | "disabled",
  ) => {
    try {
      await client.adminOfferTemplate.setStatus({ id: template.id, status });
      await queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      setSelected((current) =>
        current?.id === template.id ? { ...current, status } : current,
      );
      toast.success(`Template marked ${status}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update status",
      );
    }
  };

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <FileStack className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  Offer Structure Management
                </h1>
                <Badge
                  variant="outline"
                  className="font-normal text-muted-foreground"
                >
                  Admin control
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Create global offer templates for retailers and wholesalers.
                Templates define rules only and never apply discounts directly.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="size-4" />
            Create offer structure
          </Button>
        </div>
        <div className="grid grid-cols-2 border-t bg-muted/20 md:grid-cols-4">
          <SummaryTile
            label="Total templates"
            value={counts.total}
            icon={Layers3}
            tone="bg-blue-50 text-blue-700"
          />
          <SummaryTile
            label="Active"
            value={counts.active}
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-700"
          />
          <SummaryTile
            label="Draft"
            value={counts.draft}
            icon={CircleDashed}
            tone="bg-amber-50 text-amber-700"
          />
          <SummaryTile
            label="Disabled"
            value={counts.disabled}
            icon={Ban}
            tone="bg-zinc-100 text-zinc-600"
          />
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Filter className="size-4 text-muted-foreground" />
            <span>Search &amp; filter</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(18rem,1fr)_13rem_13rem]">
            <div className="space-y-1.5">
              <Label htmlFor="offer-search" className="text-xs">
                Offer name or code
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="offer-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search templates…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="cashback">Cashback</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Offer structure list</h2>
            <p className="text-xs text-muted-foreground">
              Template-based system · no direct execution
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {templatesQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
            Loading offer templates…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
              <FileStack className="size-5" />
            </span>
            <h3 className="text-sm font-semibold">No offer templates found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a reusable structure that stores can customize and
              activate.
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2" size="sm">
              <Plus className="size-4" /> Create first template
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Offer name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Benefit</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((template, index) => (
                  <TableRow key={template.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {template.code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {typeLabels[template.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {benefitLabel(template)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {scopeLabel(template)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[template.status]}
                      >
                        {sentenceCase(template.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(template)}
                      >
                        <Eye className="size-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <OfferTemplateForm
        template={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["offer-templates"] })
        }
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {selected ? (
            <>
              <DialogHeader className="border-b pb-4 pr-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Eye className="size-4" />
                  </span>
                  <DialogTitle className="text-lg">
                    Offer structure details
                  </DialogTitle>
                </div>
                <DialogDescription className="sr-only">
                  View the selected offer template structure and usage rules.
                </DialogDescription>
              </DialogHeader>

              <div className="py-1">
                <section className="grid gap-5 border-b py-5 first:pt-2 sm:grid-cols-3">
                  <Detail label="Offer name" value={selected.name} />
                  <Detail label="Type" value={typeLabels[selected.type]} />
                  <Detail label="Benefit" value={benefitLabel(selected)} />
                </section>

                <section className="grid gap-5 border-b py-5 sm:grid-cols-2">
                  <Detail label="Scope" value={scopeLabel(selected)} />
                  <Detail
                    label="Target users"
                    value={[
                      selected.targetRetailers && "Retailer",
                      selected.targetWholesalers && "Wholesaler",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                </section>

                <section className="border-b py-5">
                  <h3 className="mb-4 text-sm font-semibold">Usage rules</h3>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Detail
                      label="Min order"
                      value={`৳${Number(selected.minimumOrderAmount).toLocaleString("en-BD")}`}
                    />
                    <Detail
                      label="Max per user"
                      value={String(selected.maxUsePerCustomer)}
                      mono
                    />
                    <Detail
                      label="Total limit"
                      value={
                        selected.totalUsageLimit
                          ? String(selected.totalUsageLimit)
                          : "Unlimited"
                      }
                      mono
                    />
                  </div>
                  <div className="mt-5 border-t pt-5">
                    <Detail
                      label="Validity"
                      value={`${formatDate(selected.startDate)} – ${formatDate(selected.endDate)}`}
                    />
                  </div>
                </section>

                <section className="py-5 last:pb-2">
                  <h3 className="mb-4 text-sm font-semibold">Template usage</h3>
                  <div className="grid grid-cols-2 divide-x">
                    <div className="pr-5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Store className="size-3.5" /> Used by
                      </div>
                      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums">
                        {selected.usedByCount}{" "}
                        <span className="font-sans text-sm font-normal">
                          Stores
                        </span>
                      </p>
                    </div>
                    <div className="pl-5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3.5" /> Active offers
                        created
                      </div>
                      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums">
                        {selected.activeOffersCreated}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <DialogFooter className="-mx-4 -mb-4 px-4 sm:-mx-4 sm:px-4">
                {selected.status === "disabled" ? (
                  <Button
                    variant="outline"
                    onClick={() => changeStatus(selected, "draft")}
                  >
                    Restore to draft
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => changeStatus(selected, "disabled")}
                  >
                    <Ban className="size-4" /> Disable
                  </Button>
                )}
                <Button onClick={() => openEdit(selected)}>
                  Edit structure <ChevronRight className="size-4" />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
