"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number | null;
    originalPrice?: string | number | null;
    image: string | null;
    inStock: boolean;
    size?: string | null;
    discountPercent?: number;
    category?: { slug: string } | null;
  };
  href?: string;
  showDeliveryTime?: boolean;
  onAddToCart?: (productId: number) => void;
  isLoading?: boolean;
}

export function ProductCard({
  product,
  href,
  showDeliveryTime = true,
  onAddToCart,
  isLoading = false,
}: ProductCardProps) {
  const productUrl =
    href || `/products/${product.category?.slug ?? "all"}/${product.slug}`;

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product.id);
    }
  };

  return (
    <Link href={productUrl} className="group block">
      <Card className="overflow-hidden border hover:shadow-lg transition-shadow rounded-lg h-full">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <p className="text-gray-400 text-xs">No image</p>
            </div>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="destructive" className="text-[10px] font-bold">
                OUT OF STOCK
              </Badge>
            </div>
          )}
          {product.discountPercent && product.discountPercent > 0 && (
            <Badge className="absolute top-2 left-2 bg-primary text-white text-[10px] px-1.5 py-0.5 font-bold">
              {product.discountPercent}% OFF
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          {showDeliveryTime && (
            <p className="text-[10px] text-gray-500 italic mb-1">
              Delivery 1-2 hours
            </p>
          )}
          <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug mb-1.5 group-hover:text-primary transition-colors min-h-[2.25rem]">
            {product.name}
          </h3>
          {product.size && (
            <p className="text-[11px] text-gray-400 mb-1">{product.size}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div>
              {product.originalPrice && (
                <p className="text-[10px] text-gray-400 line-through">
                  ৳{Number(product.originalPrice).toLocaleString("en-BD")}
                </p>
              )}
              <p className="text-sm font-bold text-primary">
                ৳{Number(product.price || 0).toLocaleString("en-BD")}
              </p>
              <p className="text-[9px] text-gray-500">Per Piece</p>
            </div>
            {product.inStock && onAddToCart && (
              <Button
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 rounded-full",
                  isLoading && "opacity-50 cursor-not-allowed",
                )}
                onClick={handleAddClick}
                disabled={isLoading}
              >
                <Plus className="size-3 mr-1" />
                Add to Bag
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
