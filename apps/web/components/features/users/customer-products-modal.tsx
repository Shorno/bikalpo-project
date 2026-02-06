"use client";

import { Package, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  type CustomerProduct,
  getCustomerProducts,
} from "@/actions/users/get-customer-products";
import type { VerifiedUser } from "@/actions/users/get-verified-users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerProductsModalProps {
  customer: VerifiedUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CustomerProductsModal({
  customer,
  open,
  onOpenChange,
}: CustomerProductsModalProps) {
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setLoading(true);
      getCustomerProducts(customer.id)
        .then((result) => {
          if (result.success) {
            setProducts(result.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, customer]);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage
                src={customer.image || undefined}
                alt={customer.name}
              />
              <AvatarFallback className="bg-gray-200 text-gray-600">
                {getInitials(customer.shopName || customer.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900">
                {customer.shopName || customer.name}
              </p>
              <p className="text-sm font-normal text-gray-500">
                Products Bought
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <Skeleton className="w-16 h-16 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-500">
                This customer hasn't ordered any products yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={`${product.productId}-${product.productSize}`}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Product Image */}
                  <div className="relative w-16 h-16 rounded overflow-hidden bg-gray-100 shrink-0">
                    {product.productImage ? (
                      <Image
                        src={product.productImage}
                        alt={product.productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {product.productName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {product.categoryName && (
                        <Badge variant="secondary" className="text-xs">
                          {product.categoryName}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {product.productSize}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-gray-900">
                      {product.totalQuantity} units
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.totalOrders} orders
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
