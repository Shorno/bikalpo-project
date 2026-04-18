"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FolderOpen,
  Loader,
  Package,
  Power,
  Store,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";



export default function TypeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Number(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ["adminProductType", "getById", id],
    queryFn: () => orpc.adminProductType.getById.call({ id }),
    enabled: !isNaN(id),
  });

  const toggleMutation = useMutation({
    mutationFn: () => orpc.adminProductType.toggleActive.call({ id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to toggle status.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => orpc.adminProductType.delete.call({ id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      router.push("/dashboard/admin/types");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete type.");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data?.type) {
    return (
      <div className="container mx-auto text-center py-16">
        <p className="text-muted-foreground">Product type not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/admin/types">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Types
          </Link>
        </Button>
      </div>
    );
  }

  const t = data.type;
  const categories = t.categories || [];
  const products = data.products || [];
  const sellerCount = data.sellerCount ?? 0;


  return (
    <div className="container mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/admin/types">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{t.name}</h1>
              <Badge variant={t.isActive ? "default" : "secondary"}>
                {t.isActive ? "Active" : "Draft"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">{t.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            {t.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (categories.length > 0) {
                toast.error(
                  `Cannot delete — ${categories.length} categories are linked to this type.`,
                );
                return;
              }
              if (confirm("Are you sure you want to delete this type?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {/* Categories Under This Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Categories ({categories.length})
          </CardTitle>
          <CardDescription>
            Categories assigned to this product type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No categories under this type yet.
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cat.slug}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sellerCount}</p>
              <p className="text-xs text-muted-foreground">Sellers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Products Under This Type */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Products ({products.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No products under this type yet.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((prod: any) => {
                  const cat = categories.find((c: any) => c.id === prod.categoryId);
                  return (
                    <TableRow key={prod.id}>
                      <TableCell>
                        {prod.image ? (
                          <div className="h-10 w-10 relative">
                            <Image
                              src={prod.image}
                              alt={prod.name}
                              fill
                              className="object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{prod.name}</TableCell>
                      <TableCell className="text-muted-foreground">{prod.size}</TableCell>
                      <TableCell className="text-muted-foreground">{cat?.name || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={prod.status === "active" ? "default" : "secondary"}>
                          {prod.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
