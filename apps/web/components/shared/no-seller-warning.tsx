"use client";

import { AlertTriangle, MapPin } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface NoSellerWarningProps {
    /** The area name if known */
    areaName?: string;
    /** Whether to show the warning */
    show: boolean;
}

/**
 * Shows a warning banner when the customer's location
 * is outside any defined delivery area.
 */
export function NoSellerWarning({ areaName, show }: NoSellerWarningProps) {
    if (!show) return null;

    return (
        <Alert
            variant="destructive"
            className="bg-amber-50 border-amber-200 text-amber-800"
        >
            <AlertTriangle className="h-4 w-4 !text-amber-600" />
            <AlertTitle className="text-sm font-semibold">
                Limited delivery coverage
            </AlertTitle>
            <AlertDescription className="text-xs">
                {areaName ? (
                    <>
                        We currently have limited seller coverage in{" "}
                        <strong>{areaName}</strong>. Your order may take
                        longer to fulfill.
                    </>
                ) : (
                    <>
                        Your location may be outside our current delivery
                        areas. Your order may take longer to fulfill or
                        delivery charges may apply.
                    </>
                )}
            </AlertDescription>
        </Alert>
    );
}

/**
 * Shows a small info badge when area coverage is unknown.
 */
export function AreaCoverageInfo({
    hasArea,
    areaName,
}: {
    hasArea: boolean;
    areaName?: string;
}) {
    if (hasArea && areaName) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <MapPin className="h-3 w-3" />
                <span>Delivers to {areaName}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>Coverage area not confirmed</span>
        </div>
    );
}
