"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Package,
  Plus,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function CoreProductDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({
      input: { id },
    }),
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-40 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const cp = data?.coreProduct;
  if (!cp) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold mb-2">
            Core Product Not Found
          </h2>
          <Button asChild variant="outline">
            <Link href={`${ADMIN_BASE}/core-products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to list
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`${ADMIN_BASE}/core-products`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cp.name}</h1>
          <p className="text-muted-foreground text-sm">
            SKU: <span className="font-mono">{cp.sku}</span> · Slug:{" "}
            <span className="font-mono">{cp.slug}</span>
          </p>
        </div>
        <Badge
          variant={cp.status === "active" ? "default" : "secondary"}
          className={cn(
            "text-sm",
            cp.status === "active" && "bg-green-600",
            cp.status === "draft" && "bg-yellow-600",
          )}
        >
          {cp.status.charAt(0).toUpperCase() + cp.status.slice(1)}
        </Badge>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image + Basic Info */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border shadow-sm shrink-0">
                <Image
                  src={cp.image}
                  alt={cp.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{cp.category.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sub Category</span>
                    <p className="font-medium">
                      {cp.subCategory?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Brand Support</span>
                    <p className="font-medium">
                      {cp.brandSupport === "multi_brand"
                        ? "Multi Brand"
                        : "Single Brand"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="font-medium capitalize">{cp.status}</p>
                  </div>
                </div>
                {cp.description && (
                  <p className="text-sm text-muted-foreground">
                    {cp.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Variant Linking Section */}
          <VariantLinkingSection coreProduct={cp} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Linked Brands */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Linked Brands</h3>
            </div>
            {cp.brands.length > 0 ? (
              <div className="space-y-2">
                {cp.brands.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                  >
                    {b.brand.logo && (
                      <div className="w-8 h-8 relative rounded overflow-hidden shrink-0">
                        <Image
                          src={b.brand.logo}
                          alt={b.brand.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium flex-1">
                      {b.brand.name}
                    </span>
                    {b.isDefault && (
                      <Badge variant="secondary" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No brands linked.
              </p>
            )}
          </div>

          {/* Usage Insights */}
          <div className="border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">Usage Insights</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Linked Brands</span>
                <span className="font-medium">{cp.brands.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Linked Variants</span>
                <span className="font-medium">{cp.variantLinks?.length ?? 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{cp.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Variant Linking Section
// ============================================================

function VariantLinkingSection({ coreProduct }: { coreProduct: any }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = React.useState(false);

  const linkedVariants = coreProduct.variantLinks ?? [];

  // Fetch eligible variants (scoped by type/category, excludes already linked)
  const { data: eligibleVariants, isLoading: isLoadingEligible } = useQuery(
    orpc.adminCoreProduct.getEligibleVariants.queryOptions({
      input: { coreProductId: coreProduct.id },
    }),
  );

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.adminCoreProduct.getById.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.adminCoreProduct.getEligibleVariants.key(),
    });
  };

  // Link mutation
  const linkMutation = useMutation(
    orpc.adminCoreProduct.linkVariant.mutationOptions({
      onSuccess: () => {
        invalidateQueries();
        toast.success("Variant linked");
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to link variant");
      },
    }),
  );

  // Unlink mutation
  const unlinkMutation = useMutation(
    orpc.adminCoreProduct.unlinkVariant.mutationOptions({
      onSuccess: () => {
        invalidateQueries();
        toast.success("Variant unlinked");
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to unlink variant");
      },
    }),
  );

  const handleLink = (variantOptionId: number) => {
    linkMutation.mutate({
      coreProductId: coreProduct.id,
      variantOptionId,
    });
  };

  const handleUnlink = (variantOptionId: number) => {
    unlinkMutation.mutate({
      coreProductId: coreProduct.id,
      variantOptionId,
    });
  };

  const getScopeBadge = (v: any) => {
    if (!v.type && !v.category) return { label: "Global", className: "bg-blue-600" };
    if (v.type && !v.category) return { label: v.type.name, className: "bg-purple-600" };
    if (v.type && v.category) return { label: v.category.name, className: "bg-orange-600" };
    return { label: "—", className: "" };
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Linked Variants</h3>
          {linkedVariants.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {linkedVariants.length}
            </Badge>
          )}
        </div>
        {!showPicker && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Link Variant
          </Button>
        )}
      </div>

      {/* Currently linked variants */}
      {linkedVariants.length > 0 ? (
        <div className="space-y-2">
          {linkedVariants.map((link: any) => {
            const v = link.variantOption;
            const scope = getScopeBadge(v);
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{v.name}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {v.variantType === "pack" ? "Pack" : "Loose"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {v.size ? `${v.size} ${v.unit}` : v.unit}
                    </span>
                    <span>·</span>
                    <Badge
                      className={cn(
                        "text-[9px] h-4 px-1.5 text-white",
                        scope.className,
                      )}
                    >
                      {scope.label}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleUnlink(v.id)}
                  disabled={unlinkMutation.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        !showPicker && (
          <div className="text-center py-6 border border-dashed rounded-lg">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No variants linked yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Link First Variant
            </Button>
          </div>
        )
      )}

      {/* Eligible variants picker */}
      {showPicker && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Available Variants (filtered by type & category)
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPicker(false)}
              >
                <X className="h-3 w-3 mr-1" />
                Close
              </Button>
            </div>

            {isLoadingEligible ? (
              <div className="py-6 text-center">
                <div className="animate-pulse space-y-2">
                  <div className="h-10 bg-muted rounded-lg" />
                  <div className="h-10 bg-muted rounded-lg" />
                </div>
              </div>
            ) : !eligibleVariants || eligibleVariants.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg">
                <Check className="h-6 w-6 mx-auto text-green-600 mb-2" />
                <p className="text-sm text-muted-foreground">
                  All eligible variants are already linked!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {eligibleVariants.map((v: any) => {
                  const scope = getScopeBadge(v);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left",
                        "hover:bg-primary/5 hover:border-primary/30 transition-all",
                        "cursor-pointer group",
                        linkMutation.isPending && "opacity-50 pointer-events-none",
                      )}
                      onClick={() => handleLink(v.id)}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{v.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {v.variantType === "pack" ? "Pack" : "Loose"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{v.size ? `${v.size} ${v.unit}` : v.unit}</span>
                          <span>·</span>
                          <Badge
                            className={cn(
                              "text-[9px] h-4 px-1.5 text-white",
                              scope.className,
                            )}
                          >
                            {scope.label}
                          </Badge>
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
