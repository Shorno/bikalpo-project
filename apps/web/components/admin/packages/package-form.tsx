"use client";

import type { LandingPricingPlan } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { client } from "@/utils/orpc";

type PackageFormProps = {
  plan: LandingPricingPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PackageForm({ plan, open, onOpenChange }: PackageFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!plan;

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [priceYearly, setPriceYearly] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [ctaText, setCtaText] = useState("Choose Plan");
  const [sortOrder, setSortOrder] = useState("0");
  const [loading, setLoading] = useState(false);

  // Reset/populate form whenever dialog opens or plan changes
  useEffect(() => {
    if (open) {
      setName(plan?.name ?? "");
      setSubtitle(plan?.subtitle ?? "");
      setPriceMonthly(plan?.priceMonthly?.toString() ?? "");
      setPriceYearly(plan?.priceYearly?.toString() ?? "");
      setFeatures((plan?.features as string[]) ?? []);
      setNewFeature("");
      setIsPopular(plan?.isPopular ?? false);
      setCtaText(plan?.ctaText ?? "Choose Plan");
      setSortOrder(plan?.sortOrder?.toString() ?? "0");
    }
  }, [open, plan]);

  // Reset form when plan changes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("");
      setSubtitle("");
      setPriceMonthly("");
      setPriceYearly("");
      setFeatures([]);
      setNewFeature("");
      setIsPopular(false);
      setCtaText("Choose Plan");
      setSortOrder("0");
    }
    onOpenChange(isOpen);
  };

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed]);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !priceMonthly) {
      toast.error("Name and monthly price are required");
      return;
    }

    setLoading(true);
    try {
      const data = {
        name,
        subtitle,
        priceMonthly: Number.parseInt(priceMonthly, 10),
        priceYearly: priceYearly ? Number.parseInt(priceYearly, 10) : undefined,
        features,
        isPopular,
        ctaText,
        sortOrder: Number.parseInt(sortOrder, 10),
      };

      if (isEditing && plan) {
        await client.adminLanding.updatePlan({
          id: plan.id,
          data,
        });
        toast.success("Plan updated");
      } else {
        await client.adminLanding.createPlan(data);
        toast.success("Plan created");
      }
      queryClient.invalidateQueries({ queryKey: ["pricing-plans"] });
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Package" : "Create Package"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Basic, Standard, Premium"
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. For small businesses starting out."
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceMonthly">Monthly Price (৳) *</Label>
              <Input
                id="priceMonthly"
                type="number"
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(e.target.value)}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceYearly">Yearly Price (৳)</Label>
              <Input
                id="priceYearly"
                type="number"
                value={priceYearly}
                onChange={(e) => setPriceYearly(e.target.value)}
                placeholder="15000"
              />
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Features</Label>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Add a feature..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeature();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addFeature}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pr-1">
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* CTA Text */}
          <div className="space-y-2">
            <Label htmlFor="ctaText">Button Text</Label>
            <Input
              id="ctaText"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Choose Plan"
            />
          </div>

          {/* Sort Order */}
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Popular Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Most Popular</Label>
              <p className="text-sm text-muted-foreground">
                Highlights this plan with a badge
              </p>
            </div>
            <Switch checked={isPopular} onCheckedChange={setIsPopular} />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
