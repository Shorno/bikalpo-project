"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Box,
  ChevronRight,
  CircleDot,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  History,
  ImageIcon,
  Layers3,
  Loader2,
  MoreHorizontal,
  Package,
  Pause,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Trash2,
  TrendingUp,
  Users,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

type CatalogCoreProduct = {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  categoryId: number;
  subCategoryId: number | null;
  supportsPack?: boolean;
  supportsLoose?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  category: {
    id: number;
    name: string;
    slug: string;
    typeId: number | null;
    type?: {
      id: number;
      name: string;
    } | null;
  };
  subCategory: {
    id: number;
    name: string;
  } | null;
};

type CatalogOptions = {
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
};

type FilterOption = { id: number; name: string };

const ALL = "all";

function uniqueOptions(items: Array<FilterOption | null | undefined>) {
  const map = new Map<number, string>();
  for (const item of items) {
    if (item) map.set(item.id, item.name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function matchesText(value: string | null | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search);
}

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

function getAvailableVariants(
  coreProduct: CatalogCoreProduct,
  variantOptions: CatalogOptions["variantOptions"] = [],
) {
  const typeId = coreProduct.category.typeId;
  const categoryId = coreProduct.categoryId;

  return variantOptions
    .filter((variant) => {
      const isGlobal = variant.typeId == null && variant.categoryId == null;
      const isTypeWide =
        variant.typeId === typeId && variant.categoryId == null;
      const isCategoryScoped =
        variant.typeId === typeId && variant.categoryId === categoryId;
      return isGlobal || isTypeWide || isCategoryScoped;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);
  const [coreFilter, setCoreFilter] = useState(ALL);
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogCoreProduct | null>(null);

  const productsQuery = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({
      input: {},
    }),
  );

  const optionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "catalogOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
  });

  const coreProducts = (productsQuery.data?.coreProducts ??
    []) as CatalogCoreProduct[];
  const options = optionsQuery.data as CatalogOptions | undefined;

  const typeOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts.map((product) =>
          product.category.type
            ? {
                id: product.category.type.id,
                name: product.category.type.name,
              }
            : null,
        ),
      ),
    [coreProducts],
  );

  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              typeFilter === ALL ||
              String(product.category.typeId ?? "") === typeFilter,
          )
          .map((product) => product.category),
      ),
    [coreProducts, typeFilter],
  );

  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category.typeId ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter),
          )
          .map((product) => product.subCategory),
      ),
    [categoryFilter, coreProducts, typeFilter],
  );

  const coreOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category.typeId ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter) &&
              (subCategoryFilter === ALL ||
                String(product.subCategoryId ?? "") === subCategoryFilter),
          )
          .map((product) => ({ id: product.id, name: product.name })),
      ),
    [categoryFilter, coreProducts, subCategoryFilter, typeFilter],
  );

  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return coreProducts.filter((product) => {
      const productTypeId = String(product.category.typeId ?? "");
      const productSubCategoryId = String(product.subCategoryId ?? "");
      const matchesFilters =
        (typeFilter === ALL || productTypeId === typeFilter) &&
        (categoryFilter === ALL ||
          String(product.categoryId) === categoryFilter) &&
        (subCategoryFilter === ALL ||
          productSubCategoryId === subCategoryFilter) &&
        (coreFilter === ALL || String(product.id) === coreFilter);

      if (!matchesFilters) return false;
      if (!searchText) return true;

      return (
        matchesText(product.name, searchText) ||
        matchesText(product.sku, searchText) ||
        matchesText(product.category.name, searchText) ||
        matchesText(product.subCategory?.name, searchText) ||
        matchesText(product.category.type?.name, searchText)
      );
    });
  }, [
    categoryFilter,
    coreFilter,
    coreProducts,
    search,
    subCategoryFilter,
    typeFilter,
  ]);

  const isLoading = productsQuery.isLoading || optionsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <span className="rounded-lg border bg-white p-2 text-slate-700">
            <Layers3 className="h-5 w-5" />
          </span>
          Public Product Catalog
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse core identities by type, category, and sub category before
          viewing brands and variants.
        </p>
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="product-catalog-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product-catalog-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Product Name"
                  className="pl-8"
                />
              </div>
            </div>

            <FilterSelect
              label="Type"
              value={typeFilter}
              options={typeOptions}
              onValueChange={(value) => {
                setTypeFilter(value);
                setCategoryFilter(ALL);
                setSubCategoryFilter(ALL);
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={categoryOptions}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setSubCategoryFilter(ALL);
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Sub Category"
              value={subCategoryFilter}
              options={subCategoryOptions}
              onValueChange={(value) => {
                setSubCategoryFilter(value);
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Core Identity"
              value={coreFilter}
              options={coreOptions}
              onValueChange={setCoreFilter}
            />
          </div>

          <div className="mt-4 flex justify-end text-xs text-muted-foreground">
            <span>
              {filteredProducts.length} of {coreProducts.length} core identities
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Product Catalog</h2>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Core Identity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading catalog...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                      <div className="space-y-1">
                        <p className="font-medium">No products found</p>
                        <p className="text-sm text-muted-foreground">
                          Try different search
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product, index) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {product.category.type?.name || "Unassigned"}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.category.name}</TableCell>
                      <TableCell>
                        {product.subCategory?.name || (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          SKU {product.sku}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          brands={options?.brands ?? []}
          variants={getAvailableVariants(
            selectedProduct,
            options?.variantOptions,
          )}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProductDetailDialog({
  product,
  brands,
  variants,
  onOpenChange,
}: {
  product: CatalogCoreProduct;
  brands: Array<{ id: number; name: string; slug: string }>;
  variants: NonNullable<CatalogOptions["variantOptions"]>;
  onOpenChange: (open: boolean) => void;
}) {
  const priceQuery = useQuery(
    orpc.product.listConsumerReferencePrices.queryOptions({
      input: { coreProductId: product.id },
    }),
  );
  const priceItems = priceQuery.data?.items ?? [];

  const priceBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of priceItems) {
      if (item.brandDisplay && item.brandDisplay !== "—") {
        map.set(item.brandDisplay, item.brandDisplay);
      }
    }
    return Array.from(map.values());
  }, [priceItems]);

  const [selectedPriceBrand, setSelectedPriceBrand] = useState<string>("");

  const activePriceBrand =
    selectedPriceBrand || (priceBrands.length > 0 ? priceBrands[0] : "");

  const filteredPrices = useMemo(() => {
    if (!activePriceBrand) return priceItems;
    return priceItems.filter((item) => item.brandDisplay === activePriceBrand);
  }, [priceItems, activePriceBrand]);

  const packVariants = variants.filter(
    (variant) => variant.variantType === "pack",
  );
  const looseVariants = variants.filter(
    (variant) => variant.variantType === "loose",
  );
  const variantTypes = [
    product.supportsPack !== false || packVariants.length > 0 ? "Pack" : null,
    product.supportsLoose || looseVariants.length > 0 ? "Loose" : null,
  ].filter(Boolean);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {/* Product Header */}
        <div className="relative border-b bg-gradient-to-br from-slate-50 via-white to-slate-50/80">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-transparent to-transparent" />
          <div className="relative px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                  <Package className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                      {product.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="font-medium text-slate-600">
                      {product.category.type?.name || "Unassigned"}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>{product.category.name}</span>
                    {product.subCategory && (
                      <>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>{product.subCategory.name}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">SKU: {product.sku}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/products/${product.category.slug}/${product.slug}`}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          Preview
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View as Customer</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href={`${ADMIN_BASE}/core-products/${product.id}`}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit Product
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Activity className="mr-2 h-4 w-4" />
                      Update Now
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Pause className="mr-2 h-4 w-4" />
                      Disable Product
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="flex-1">
          <div className="border-b bg-slate-50/50 px-6">
            <TabsList variant="line" className="h-11">
              <TabsTrigger value="overview" className="gap-1.5">
                <Layers3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="variants" className="gap-1.5">
                <Box className="h-4 w-4" />
                Variants & Pricing
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-1.5">
                <ImageIcon className="h-4 w-4" />
                Media & SEO
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(95vh-180px)]">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 p-6">
              <div className="space-y-6">
                {/* Core Identity Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                          <Layers3 className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Core Product Identity
                          </CardTitle>
                          <CardDescription>
                            Fundamental product classification
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        <CircleDot className="mr-1 h-3 w-3 text-amber-500" />
                        Locked
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <DataField
                        label="Type"
                        value={product.category.type?.name || "--"}
                      />
                      <DataField
                        label="Category"
                        value={product.category.name}
                      />
                      <DataField
                        label="Sub Category"
                        value={product.subCategory?.name || "None"}
                      />
                      <DataField label="Core Name" value={product.name} />
                    </div>
                  </CardContent>
                </Card>

                {/* Product Information Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Product Information
                          </CardTitle>
                          <CardDescription>
                            Descriptions and brand associations
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Available Brands
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {brands.length > 0 ? (
                          brands.map((brand) => (
                            <Badge
                              key={brand.id}
                              variant="secondary"
                              className="font-normal"
                            >
                              {brand.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">
                            No brands available
                          </span>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Short Description
                        </Label>
                        <p className="mt-1.5 text-sm text-slate-700">
                          {product.description || "--"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Full Description
                        </Label>
                        <p className="mt-1.5 line-clamp-3 text-sm text-slate-600">
                          {product.description || "--"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <QuickStatCard
                    icon={Store}
                    label="Assigned Retailers"
                    value="--"
                    subtext=""
                    iconColor="text-violet-600"
                    iconBg="bg-violet-50"
                  />
                  <QuickStatCard
                    icon={Users}
                    label="Assigned Wholesalers"
                    value="--"
                    subtext=""
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50"
                  />
                  <QuickStatCard
                    icon={ShoppingBag}
                    label="Order Series"
                    value="--"
                    subtext=""
                    iconColor="text-amber-600"
                    iconBg="bg-amber-50"
                  />
                </div>

                {/* Change History */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                        <History className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          Change History
                        </CardTitle>
                        <CardDescription>Recent modifications</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Date
                            </TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Action
                            </TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              By
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {formatDate(product.createdAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700"
                              >
                                Created
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              Admin
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Variants & Pricing Tab */}
            <TabsContent value="variants" className="m-0 p-6">
              <div className="space-y-6">
                {/* Variant Structure */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                          <Box className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Variant Structure
                          </CardTitle>
                          <CardDescription>
                            Available product configurations
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        View Setup
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Variant Types
                      </Label>
                      <div className="mt-2 flex gap-2">
                        {variantTypes.length > 0 ? (
                          variantTypes.map((type) => (
                            <Badge key={type} className="bg-indigo-600">
                              {type}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">
                            No variants configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Pack Variants */}
                      <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-medium text-slate-900">
                            Pack Variants
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {packVariants.length} options
                          </Badge>
                        </div>
                        {packVariants.length > 0 ? (
                          <div className="space-y-2">
                            {packVariants.map((variant) => (
                              <div
                                key={variant.id}
                                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/60"
                              >
                                <span className="text-sm font-medium text-slate-700">
                                  {variant.name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {variant.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            No pack variants
                          </p>
                        )}
                      </div>

                      {/* Loose Variant */}
                      <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-medium text-slate-900">
                            Loose Variant
                          </h4>
                          <Badge
                            variant={
                              product.supportsLoose || looseVariants.length > 0
                                ? "default"
                                : "secondary"
                            }
                            className={
                              product.supportsLoose || looseVariants.length > 0
                                ? "bg-emerald-600"
                                : ""
                            }
                          >
                            {product.supportsLoose || looseVariants.length > 0
                              ? "Enabled"
                              : "Disabled"}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Sale Unit</span>
                            <span className="font-medium text-slate-700">
                              {looseVariants[0]?.unit || "--"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                          <Tags className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Consumer Pricing
                          </CardTitle>
                          <CardDescription>
                            Price configuration by brand
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit Prices
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {priceQuery.isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading prices...
                      </div>
                    ) : priceItems.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-500">
                        No prices configured for this product yet.
                      </div>
                    ) : (
                      <>
                        {priceBrands.length > 1 && (
                          <div className="mb-4 max-w-xs">
                            <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Select Brand
                            </Label>
                            <Select
                              value={activePriceBrand}
                              onValueChange={setSelectedPriceBrand}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                              <SelectContent>
                                {priceBrands.map((brandName) => (
                                  <SelectItem key={brandName} value={brandName}>
                                    {brandName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {priceBrands.length === 1 && (
                          <p className="mb-3 text-sm text-slate-600">
                            Brand:{" "}
                            <span className="font-medium">
                              {priceBrands[0]}
                            </span>
                          </p>
                        )}

                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Variant
                                </TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Price (BDT)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPrices.map((item) => (
                                <TableRow key={item.variantPriceId}>
                                  <TableCell className="font-medium">
                                    {item.variantName}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.consumerPrice &&
                                    item.consumerPrice !== "0" ? (
                                      <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                                        ৳ {item.consumerPrice}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-slate-400">
                                        --
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <CircleDot className="h-3 w-3 text-amber-500" />
                          Sellers can override these prices
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="m-0 p-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                          <Settings className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Product Behavior Settings
                          </CardTitle>
                          <CardDescription>
                            Operational configurations
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Settings className="h-3.5 w-3.5" />
                        Update Settings
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingRow label="Empty Pack Return" value="--" />
                      <SettingRow label="Tracking System" value="--" />
                      <SettingRow label="Expiry Tracking" value="--" />
                      <SettingRow label="Damage Control" value="--" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Media & SEO Tab */}
            <TabsContent value="media" className="m-0 p-6">
              <div className="space-y-6">
                {/* Media */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50">
                          <ImageIcon className="h-4 w-4 text-pink-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Product Media
                          </CardTitle>
                          <CardDescription>
                            Images and video content
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />
                        Update Media
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <MediaCard
                        icon={ImageIcon}
                        label="Thumbnail"
                        action="View Image"
                        href={product.image}
                      />
                      <MediaCard
                        icon={ImageIcon}
                        label="Gallery"
                        action="View Images"
                      />
                      <MediaCard
                        icon={Video}
                        label="Video"
                        action="View Video"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* SEO */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                          <Globe className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Visibility & SEO
                          </CardTitle>
                          <CardDescription>
                            Search optimization settings
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit SEO
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border bg-slate-50/50 p-3">
                        <div>
                          <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Visibility
                          </Label>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            --
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg border bg-slate-50/50 p-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          SEO Title
                        </Label>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          --
                        </p>
                      </div>
                      <div className="rounded-lg border bg-slate-50/50 p-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          SEO Tags
                        </Label>
                        <p className="mt-2 text-sm text-slate-500">--</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="m-0 p-6">
              <div className="space-y-6">
                {/* Performance Stats */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
                    <CardContent className="relative pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Total Sales
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            --
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                          <TrendingUp className="h-6 w-6 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                    <CardContent className="relative pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Total Orders
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            --
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                          <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
                    <CardContent className="relative pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Top Variant
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {packVariants[0]?.name ||
                              variants[0]?.name ||
                              "--"}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                          <BarChart3 className="h-6 w-6 text-violet-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Usage Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                        <Activity className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          Product Usage
                        </CardTitle>
                        <CardDescription>
                          Distribution and assignment metrics
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                            <Store className="h-5 w-5 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-900">
                              --
                            </p>
                            <p className="text-xs text-slate-500">
                              Active Retailers
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border bg-gradient-to-br from-cyan-50 to-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
                            <Users className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-900">
                              --
                            </p>
                            <p className="text-xs text-slate-500">
                              Active Wholesalers
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                            <ShoppingBag className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              --
                            </p>
                            <p className="text-xs text-slate-500">
                              Order Series
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function QuickStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColor,
  iconBg,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  subtext: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <span className="text-sm text-slate-500">{value}</span>
    </div>
  );
}

function MediaCard({
  icon: Icon,
  label,
  action,
  href,
}: {
  icon: typeof ImageIcon;
  label: string;
  action: string;
  href?: string | null;
}) {
  const hasImage = href && (href.startsWith("http") || href.startsWith("/"));

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-slate-100 to-slate-50 transition-all hover:shadow-md">
      {hasImage ? (
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          <img
            src={href}
            alt={label}
            className="h-full w-full object-contain p-2"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-white/50">
          <Icon className="h-10 w-10 text-slate-300" />
        </div>
      )}
      <div className="border-t bg-white p-3 text-center">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {href ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 gap-1.5 text-xs"
            asChild
          >
            <a href={href} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
              {action}
            </a>
          </Button>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Not uploaded</p>
        )}
      </div>
    </div>
  );
}
