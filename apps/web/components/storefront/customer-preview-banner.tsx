import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getShopStoreDashboardUrl } from "@/lib/customer-storefront-preview";

export function CustomerPreviewBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Eye className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-950">
              Customer preview
            </p>
            <p className="text-xs leading-5 text-amber-800">
              You are viewing the consumer experience. Ordering and item
              requests are disabled.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
        >
          <a href={getShopStoreDashboardUrl()}>
            Back to My Store
            <ExternalLink className="ml-1.5 size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
