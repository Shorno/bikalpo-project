"use client";

import type { Offer } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

const OFFER_TYPES = [
  "Weekly Offers",
  "Combo Deals",
  "Brand Campaigns",
  "More Offers",
];

const BADGES = [
  "New",
  "Hot Deal",
  "Limited Time",
  "Bestseller",
  "Flash Sale",
  "Exclusive",
];

const offerFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().default(""),
  type: z
    .enum(["Weekly Offers", "Combo Deals", "Brand Campaigns", "More Offers"])
    .default("Weekly Offers"),
  discountPercentage: z.coerce
    .number()
    .min(0, "At least 0%")
    .max(100, "At most 100%"),
  originalPrice: z.coerce.number().optional(),
  comboPrice: z.coerce.number().optional(),
  products: z.string().default(""),
  bannerImage: z.string().optional().default(""),
  badge: z.string().default(""),
  priority: z.coerce.number().default(0),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  active: z.boolean().default(true),
}) as any;

type OfferFormValues = {
  title: string;
  description: string;
  type: "Weekly Offers" | "Combo Deals" | "Brand Campaigns" | "More Offers";
  discountPercentage: number;
  originalPrice?: number;
  comboPrice?: number;
  products: string;
  bannerImage: string;
  badge: string;
  priority: number;
  startDate: string;
  endDate: string;
  active: boolean;
};

interface OfferFormProps {
  offer?: Offer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OfferForm({ offer, open, onOpenChange }: OfferFormProps) {
  const queryClient = useQueryClient();
  const [bannerImage, setBannerImage] = useState<string>("");

  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Weekly Offers",
      discountPercentage: 10,
      originalPrice: 0,
      comboPrice: 0,
      products: "",
      bannerImage: "",
      badge: "",
      priority: 0,
      startDate: "",
      endDate: "",
      active: true,
    },
  });

  useEffect(() => {
    if (offer) {
      form.reset({
        title: offer.title,
        description: offer.description || "",
        type: (offer.type as any) || "Weekly Offers",
        discountPercentage: offer.discountPercentage,
        originalPrice: offer.originalPrice || 0,
        comboPrice: offer.comboPrice || 0,
        products: offer.products || "",
        bannerImage: offer.bannerImage || "",
        badge: offer.badge || "",
        priority: offer.priority ?? 0,
        startDate: offer.startDate || "",
        endDate: offer.endDate || "",
        active: offer.active ?? true,
      });
      setBannerImage(offer.bannerImage || "");
    } else {
      form.reset({
        title: "",
        description: "",
        type: "Weekly Offers",
        discountPercentage: 10,
        originalPrice: 0,
        comboPrice: 0,
        products: "",
        bannerImage: "",
        badge: "",
        priority: 0,
        startDate: "",
        endDate: "",
        active: true,
      });
      setBannerImage("");
    }
  }, [offer, open, form]);

  const onSubmit = async (values: OfferFormValues) => {
    try {
      // Clean up empty optional fields
      const cleanedData = {
        ...values,
        bannerImage: values.bannerImage?.trim() || undefined,
        products: values.products?.trim() || undefined,
        badge: values.badge?.trim() || undefined,
        startDate: values.startDate?.trim() || undefined,
        endDate: values.endDate?.trim() || undefined,
        originalPrice:
          values.originalPrice && values.originalPrice > 0
            ? values.originalPrice
            : undefined,
        comboPrice:
          values.comboPrice && values.comboPrice > 0
            ? values.comboPrice
            : undefined,
      };

      if (offer) {
        await client.adminOffer.update({
          id: offer.id,
          data: cleanedData as any,
        });
        toast.success("Offer updated successfully");
      } else {
        await client.adminOffer.create(cleanedData as any);
        toast.success("Offer created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-[600px] p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl sm:text-2xl">
            {offer ? "Edit Offer" : "Create New Offer"}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {offer
              ? "Update the offer details below"
              : "Add a new offer with type, products and pricing"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 sm:space-y-5"
          >
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Offer Title *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Summer Sale 2024"
                      {...field}
                      className="text-sm sm:text-base h-10 sm:h-11"
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the offer details..."
                      {...field}
                      rows={3}
                      className="text-sm sm:text-base"
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Offer Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Offer Type *
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OFFER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Pricing Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="originalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">
                      Original Price
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        step="1"
                        min={0}
                        {...field}
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comboPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">
                      Combo Price
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        step="1"
                        min={0}
                        {...field}
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">
                      Discount %
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="10"
                        {...field}
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </FormControl>
                    <FormDescription className="text-xs sm:text-sm">
                      0-100%
                    </FormDescription>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>

            {/* Products */}
            <FormField
              control={form.control}
              name="products"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Products List
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Potato Chips, Energy Biscuit, Apple Juice"
                      {...field}
                      rows={3}
                      className="text-sm sm:text-base font-mono"
                    />
                  </FormControl>
                  <FormDescription className="text-xs sm:text-sm">
                    Enter plain text product names separated by commas
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Badge */}
            <FormField
              control={form.control}
              name="badge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">Badge</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BADGES.map((badge) => (
                        <SelectItem key={badge} value={badge}>
                          {badge}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs sm:text-sm">
                    Optional badge to highlight
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Banner Image */}
            <FormField
              control={form.control}
              name="bannerImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Banner Image
                  </FormLabel>
                  <FormControl>
                    <ImageUploader
                      value={field.value}
                      onChange={(url) => {
                        field.onChange(url);
                        setBannerImage(url);
                      }}
                      folder="offers"
                      maxSizeMB={5}
                    />
                  </FormControl>
                  {bannerImage && (
                    <div className="mt-2 relative w-full aspect-video bg-muted rounded overflow-hidden">
                      <img
                        src={bannerImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <FormDescription className="text-xs sm:text-sm">
                    Upload image (5MB max)
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Priority
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      className="text-sm sm:text-base h-10 sm:h-11"
                    />
                  </FormControl>
                  <FormDescription className="text-xs sm:text-sm">
                    Higher = appears first
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">
                      Start Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">
                      End Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>

            {/* Active */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 sm:p-4">
                  <div>
                    <FormLabel className="text-sm sm:text-base cursor-pointer">
                      Active
                    </FormLabel>
                    <FormDescription className="text-xs sm:text-sm">
                      Show this offer on homepage
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-sm sm:text-base h-10 sm:h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-sm sm:text-base h-10 sm:h-11 sm:flex-1"
              >
                {offer ? "Update Offer" : "Create Offer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
