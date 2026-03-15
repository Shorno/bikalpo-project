"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

type HomeTabProduct = {
  id: number;
  tabId: number;
  name: string;
  description: string | null;
  image: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
};

type HomeTab = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  products: HomeTabProduct[];
};

type TabFormValues = {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
};

type ProductFormValues = {
  name: string;
  description: string;
  image: string;
  price: string;
  isActive: boolean;
};

const emptyTabForm: TabFormValues = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
};

const emptyProductForm: ProductFormValues = {
  name: "",
  description: "",
  image: "",
  price: "",
  isActive: true,
};

function swapItems<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function TabFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValues,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialValues: TabFormValues;
  isPending: boolean;
  onSubmit: (values: TabFormValues) => void;
}) {
  const [values, setValues] = useState<TabFormValues>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id="customer-home-tab-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="tab-name">
              Tab name
            </label>
            <Input
              id="tab-name"
              value={values.name}
              onChange={(event) => {
                const name = event.target.value;
                setValues((current) => ({
                  ...current,
                  name,
                  slug:
                    current.slug === "" ||
                    current.slug === generateSlug(current.name)
                      ? generateSlug(name)
                      : current.slug,
                }));
              }}
              placeholder="Pasta"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="tab-slug">
              Slug
            </label>
            <Input
              id="tab-slug"
              value={values.slug}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  slug: generateSlug(event.target.value),
                }))
              }
              placeholder="pasta"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="tab-description">
              Description
            </label>
            <Textarea
              id="tab-description"
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Short context for this curated section"
              rows={4}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Only active tabs appear on the customer homepage.
              </p>
            </div>
            <Switch
              checked={values.isActive}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, isActive: checked }))
              }
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            form="customer-home-tab-form"
            type="submit"
            disabled={isPending}
          >
            Save tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValues,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialValues: ProductFormValues;
  isPending: boolean;
  onSubmit: (values: ProductFormValues) => void;
}) {
  const [values, setValues] = useState<ProductFormValues>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id="customer-home-product-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Product image</label>
            <ImageUploader
              value={values.image}
              onChange={(image) =>
                setValues((current) => ({ ...current, image }))
              }
              folder="customer-home-products"
              maxSizeMB={5}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="product-name">
                Product name
              </label>
              <Input
                id="product-name"
                value={values.name}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Arabica Coffee"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="product-price">
                Price
              </label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={values.price}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
                placeholder="350"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="product-description"
            >
              Description
            </label>
            <Textarea
              id="product-description"
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Short description shown under the product title"
              rows={4}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive products stay in admin but are hidden from customers.
              </p>
            </div>
            <Switch
              checked={values.isActive}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, isActive: checked }))
              }
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            form="customer-home-product-form"
            type="submit"
            disabled={isPending}
          >
            Save product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerHomeTabsClient() {
  const queryClient = useQueryClient();
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [isCreateTabOpen, setIsCreateTabOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<HomeTab | null>(null);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<HomeTabProduct | null>(
    null,
  );

  const tabsQuery = useQuery({
    ...orpc.adminCustomerHomeTab.list.queryOptions(),
    queryKey: orpc.adminCustomerHomeTab.list.key(),
  });

  const tabs = (tabsQuery.data?.tabs ?? []) as HomeTab[];

  useEffect(() => {
    if (!tabs.length) {
      setSelectedTabId(null);
      return;
    }

    if (!selectedTabId || !tabs.some((tab) => tab.id === selectedTabId)) {
      setSelectedTabId(tabs[0]!.id);
    }
  }, [tabs, selectedTabId]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null;

  const invalidateTabs = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.adminCustomerHomeTab.list.key(),
    });
  };

  const createTabMutation = useMutation({
    ...orpc.adminCustomerHomeTab.createTab.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      setIsCreateTabOpen(false);
      toast.success("Tab created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTabMutation = useMutation({
    ...orpc.adminCustomerHomeTab.updateTab.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      setEditingTab(null);
      toast.success("Tab updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTabMutation = useMutation({
    ...orpc.adminCustomerHomeTab.deleteTab.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      toast.success("Tab deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderTabsMutation = useMutation({
    ...orpc.adminCustomerHomeTab.reorderTabs.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
    },
    onError: (error) => toast.error(error.message),
  });

  const createProductMutation = useMutation({
    ...orpc.adminCustomerHomeTab.createProduct.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      setIsCreateProductOpen(false);
      toast.success("Product added to tab");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateProductMutation = useMutation({
    ...orpc.adminCustomerHomeTab.updateProduct.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      setEditingProduct(null);
      toast.success("Product updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteProductMutation = useMutation({
    ...orpc.adminCustomerHomeTab.deleteProduct.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
      toast.success("Product removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderProductsMutation = useMutation({
    ...orpc.adminCustomerHomeTab.reorderProducts.mutationOptions(),
    onSuccess: async () => {
      await invalidateTabs();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleMoveTab = (tabId: number, direction: -1 | 1) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    const reorderedTabs = swapItems(
      tabs,
      currentIndex,
      currentIndex + direction,
    );
    reorderTabsMutation.mutate({
      orderedIds: reorderedTabs.map((tab) => tab.id),
    });
  };

  const handleMoveProduct = (productId: number, direction: -1 | 1) => {
    if (!selectedTab) {
      return;
    }

    const currentIndex = selectedTab.products.findIndex(
      (product) => product.id === productId,
    );
    const reorderedProducts = swapItems(
      selectedTab.products,
      currentIndex,
      currentIndex + direction,
    );

    reorderProductsMutation.mutate({
      tabId: selectedTab.id,
      orderedIds: reorderedProducts.map((product) => product.id),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Home Tabs
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage curated homepage tabs and the products shown under each one.
          </p>
        </div>
        <Button onClick={() => setIsCreateTabOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New tab
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
            <CardDescription>
              Reorder tabs and control which sections customers can see.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tabs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No tabs yet. Create the first one to start curating the customer
                homepage.
              </div>
            ) : (
              <ScrollArea className="h-[560px] pr-3">
                <div className="space-y-3">
                  {tabs.map((tab, index) => {
                    const isSelected = tab.id === selectedTabId;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedTabId(tab.id)}
                        className={[
                          "w-full rounded-xl border p-4 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">
                                {tab.name}
                              </p>
                              <Badge
                                variant={tab.isActive ? "default" : "secondary"}
                              >
                                {tab.isActive ? "Active" : "Hidden"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              /{tab.slug}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tab.products.length} product
                              {tab.products.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div
                            className="flex items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={
                                index === 0 || reorderTabsMutation.isPending
                              }
                              onClick={() => handleMoveTab(tab.id, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={
                                index === tabs.length - 1 ||
                                reorderTabsMutation.isPending
                              }
                              onClick={() => handleMoveTab(tab.id, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingTab(tab)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteTabMutation.isPending}
                              onClick={() =>
                                deleteTabMutation.mutate({ id: tab.id })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {tab.description ? (
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                            {tab.description}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>
                {selectedTab ? `${selectedTab.name} products` : "Products"}
              </CardTitle>
              <CardDescription>
                {selectedTab
                  ? "Add, edit, remove, and reorder the cards shown under this tab."
                  : "Select a tab to manage its products."}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreateProductOpen(true)}
              disabled={!selectedTab}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add product
            </Button>
          </CardHeader>
          <CardContent>
            {!selectedTab ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Pick a tab from the left to manage its products.
              </div>
            ) : selectedTab.products.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                This tab has no products yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedTab.products.map((product, index) => (
                  <div
                    key={product.id}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          unoptimized={product.image.startsWith("http")}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold leading-tight">
                              {product.name}
                            </p>
                            <p className="text-sm font-medium text-primary">
                              ৳{product.price.toLocaleString("en-BD")}
                            </p>
                          </div>
                          <Badge
                            variant={product.isActive ? "default" : "secondary"}
                          >
                            {product.isActive ? "Active" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {product.description || "No description added."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={
                            index === 0 || reorderProductsMutation.isPending
                          }
                          onClick={() => handleMoveProduct(product.id, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={
                            index === selectedTab.products.length - 1 ||
                            reorderProductsMutation.isPending
                          }
                          onClick={() => handleMoveProduct(product.id, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deleteProductMutation.isPending}
                          onClick={() =>
                            deleteProductMutation.mutate({ id: product.id })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TabFormDialog
        open={isCreateTabOpen}
        onOpenChange={setIsCreateTabOpen}
        title="Create customer tab"
        description="Tabs appear across the top of the customer homepage."
        initialValues={emptyTabForm}
        isPending={createTabMutation.isPending}
        onSubmit={(values) => createTabMutation.mutate(values)}
      />

      <TabFormDialog
        open={editingTab !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTab(null);
          }
        }}
        title="Edit tab"
        description="Update the tab label, slug, and visibility."
        initialValues={
          editingTab
            ? {
                name: editingTab.name,
                slug: editingTab.slug,
                description: editingTab.description ?? "",
                isActive: editingTab.isActive,
              }
            : emptyTabForm
        }
        isPending={updateTabMutation.isPending}
        onSubmit={(values) => {
          if (!editingTab) {
            return;
          }

          updateTabMutation.mutate({
            id: editingTab.id,
            displayOrder: editingTab.displayOrder,
            ...values,
          });
        }}
      />

      <ProductFormDialog
        open={isCreateProductOpen}
        onOpenChange={setIsCreateProductOpen}
        title="Add tab product"
        description="This card will appear inside the selected homepage tab."
        initialValues={emptyProductForm}
        isPending={createProductMutation.isPending}
        onSubmit={(values) => {
          if (!selectedTab) {
            toast.error("Select a tab first");
            return;
          }

          createProductMutation.mutate({
            tabId: selectedTab.id,
            ...values,
          });
        }}
      />

      <ProductFormDialog
        open={editingProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
          }
        }}
        title="Edit tab product"
        description="Update the product card shown in this homepage tab."
        initialValues={
          editingProduct
            ? {
                name: editingProduct.name,
                description: editingProduct.description ?? "",
                image: editingProduct.image,
                price: String(editingProduct.price),
                isActive: editingProduct.isActive,
              }
            : emptyProductForm
        }
        isPending={updateProductMutation.isPending}
        onSubmit={(values) => {
          if (!editingProduct || !selectedTab) {
            return;
          }

          updateProductMutation.mutate({
            id: editingProduct.id,
            tabId: selectedTab.id,
            displayOrder: editingProduct.displayOrder,
            ...values,
          });
        }}
      />
    </div>
  );
}
