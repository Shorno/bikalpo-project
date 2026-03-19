"use client";

import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    BarChart3,
    Globe,
    MapPin,
    TrendingUp,
    Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";

const StaticMap = dynamic(
    () => import("@/components/shared/static-map"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
        ),
    },
);

export default function AreaAnalyticsPage() {
    const [activeTab, setActiveTab] = useState("coverage");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-indigo-600" />
                    Area Analytics
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Coverage gaps, seller density, violations, and recruitment
                    insights
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="space-y-4"
            >
                <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                    <TabsTrigger value="coverage" className="text-xs">
                        <Globe className="h-3.5 w-3.5 mr-1.5" />
                        Coverage
                    </TabsTrigger>
                    <TabsTrigger value="density" className="text-xs">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        Density
                    </TabsTrigger>
                    <TabsTrigger value="violations" className="text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                        Violations
                    </TabsTrigger>
                    <TabsTrigger value="recruitment" className="text-xs">
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                        Recruitment
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="coverage">
                    <CoverageGapTab />
                </TabsContent>
                <TabsContent value="density">
                    <SellerDensityTab />
                </TabsContent>
                <TabsContent value="violations">
                    <ViolationsTab />
                </TabsContent>
                <TabsContent value="recruitment">
                    <RecruitmentTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Coverage Gap Tab ──────────────────────────────────

function CoverageGapTab() {
    const { data, isLoading } = useQuery(
        orpc.adminAreaAnalytics.coverageGapReport.queryOptions({
            input: undefined,
            staleTime: 1000 * 60 * 5,
        }),
    );

    if (isLoading) return <AnalyticsLoadingSkeleton />;

    const summary = data?.summary;
    const areas = data?.areas ?? [];

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    label="Total Areas"
                    value={summary?.totalAreas ?? 0}
                    icon={<Globe className="h-4 w-4 text-blue-500" />}
                />
                <SummaryCard
                    label="Empty (No Sellers)"
                    value={summary?.emptyAreas ?? 0}
                    icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                    variant="danger"
                />
                <SummaryCard
                    label="Underserved (1-2)"
                    value={summary?.underservedAreas ?? 0}
                    icon={<Users className="h-4 w-4 text-amber-500" />}
                    variant="warning"
                />
                <SummaryCard
                    label="Well Covered (3+)"
                    value={summary?.wellCoveredAreas ?? 0}
                    icon={<Users className="h-4 w-4 text-emerald-500" />}
                    variant="success"
                />
            </div>

            {/* Area List */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">
                        Areas by Coverage (least covered first)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="divide-y">
                        {areas.map((a: any) => (
                            <div
                                key={a.areaId}
                                className="flex items-center justify-between py-2.5"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-2 h-2 rounded-full ${
                                            a.sellerCount === 0
                                                ? "bg-red-500"
                                                : a.sellerCount <= 2
                                                  ? "bg-amber-500"
                                                  : "bg-emerald-500"
                                        }`}
                                    />
                                    <div>
                                        <p className="text-sm font-medium">
                                            {a.areaName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {a.radiusKm
                                                ? `Radius: ${a.radiusKm}km`
                                                : "Polygon area"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {a.sellerCount}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            sellers
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {a.orderCount}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            orders
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            a.sellerCount === 0
                                                ? "destructive"
                                                : a.sellerCount <= 2
                                                  ? "secondary"
                                                  : "default"
                                        }
                                        className="text-xs"
                                    >
                                        {a.sellerCount === 0
                                            ? "No Coverage"
                                            : a.sellerCount <= 2
                                              ? "Low"
                                              : "Good"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                        {areas.length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No areas defined yet
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Seller Density Tab ─────────────────────────────────

function SellerDensityTab() {
    const { data, isLoading } = useQuery(
        orpc.adminAreaAnalytics.sellerDensity.queryOptions({
            input: undefined,
            staleTime: 1000 * 60 * 5,
        }),
    );

    if (isLoading) return <AnalyticsLoadingSkeleton />;

    const sellers = data?.sellers ?? [];
    const areas = data?.areas ?? [];
    const sellersWithCoords = sellers.filter(
        (s: any) => s.shopLat && s.shopLng,
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SummaryCard
                    label="Total Sellers"
                    value={sellers.length}
                    icon={<Users className="h-4 w-4 text-blue-500" />}
                />
                <SummaryCard
                    label="With Location"
                    value={sellersWithCoords.length}
                    icon={<MapPin className="h-4 w-4 text-emerald-500" />}
                />
                <SummaryCard
                    label="Active Areas"
                    value={areas.length}
                    icon={<Globe className="h-4 w-4 text-indigo-500" />}
                />
            </div>

            {/* Seller list with coordinates */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">
                        Sellers with Location Data
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                        {sellersWithCoords.map((seller: any) => (
                            <div
                                key={seller.id}
                                className="flex items-center justify-between py-2.5"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {seller.shopName || seller.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {seller.shopAddress || "No address"}
                                    </p>
                                </div>
                                <div className="text-xs text-muted-foreground text-right">
                                    <p>
                                        {parseFloat(seller.shopLat).toFixed(4)},{" "}
                                        {parseFloat(seller.shopLng).toFixed(4)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {sellersWithCoords.length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No sellers have location data set
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Violations Tab ─────────────────────────────────────

function ViolationsTab() {
    const { data, isLoading } = useQuery(
        orpc.adminAreaAnalytics.areaViolations.queryOptions({
            input: { limit: 50, page: 1 },
            staleTime: 1000 * 60 * 5,
        }),
    );

    if (isLoading) return <AnalyticsLoadingSkeleton />;

    const violations = data?.violations ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-4">
            <SummaryCard
                label="Orders Outside Any Area"
                value={pagination?.totalCount ?? 0}
                icon={
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                }
                variant={
                    (pagination?.totalCount ?? 0) > 0
                        ? "warning"
                        : "success"
                }
            />

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">
                        Orders with Location but No Matched Area
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                        {violations.map((v: any) => (
                            <div
                                key={v.orderId}
                                className="flex items-center justify-between py-2.5"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {v.orderNumber}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {v.customerName} •{" "}
                                        {v.shippingArea || v.shippingCity}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">
                                        {v.locationLat &&
                                            `${parseFloat(v.locationLat).toFixed(4)}, ${parseFloat(v.locationLng).toFixed(4)}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        ৳
                                        {Number(
                                            v.totalAmount,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {violations.length === 0 && (
                            <div className="text-center py-6">
                                <AlertTriangle className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    No violations found — all located orders
                                    matched an area
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Recruitment Tab ────────────────────────────────────

function RecruitmentTab() {
    const { data, isLoading } = useQuery(
        orpc.adminAreaAnalytics.recruitmentPriority.queryOptions({
            input: undefined,
            staleTime: 1000 * 60 * 5,
        }),
    );

    if (isLoading) return <AnalyticsLoadingSkeleton />;

    const priorities = data?.priorities ?? [];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">
                        Recruitment Priority (highest need first)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="divide-y">
                        {priorities.map((p: any, idx: number) => (
                            <div
                                key={p.areaId}
                                className="flex items-center justify-between py-2.5"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-muted-foreground w-5">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium">
                                            {p.areaName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {p.sellerCount} sellers •{" "}
                                            {p.orderCount} orders
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="text-sm font-bold">
                                            {p.sellerCount === 0
                                                ? "∞"
                                                : (
                                                      p.orderCount /
                                                      p.sellerCount
                                                  ).toFixed(1)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            orders/seller
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            p.sellerCount === 0
                                                ? "destructive"
                                                : p.priorityScore > 10
                                                  ? "secondary"
                                                  : "default"
                                        }
                                        className="text-xs"
                                    >
                                        {p.sellerCount === 0
                                            ? "Critical"
                                            : p.priorityScore > 10
                                              ? "High"
                                              : "Normal"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                        {priorities.length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No active areas to analyze
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Shared Components ──────────────────────────────────

function SummaryCard({
    label,
    value,
    icon,
    variant = "default",
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    variant?: "default" | "danger" | "warning" | "success";
}) {
    const bgColors = {
        default: "bg-white",
        danger: "bg-red-50 border-red-100",
        warning: "bg-amber-50 border-amber-100",
        success: "bg-emerald-50 border-emerald-100",
    };

    return (
        <Card className={`${bgColors[variant]} py-3`}>
            <CardContent className="pt-0">
                <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

function AnalyticsLoadingSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-4">
                            <Skeleton className="h-4 w-20 mb-2" />
                            <Skeleton className="h-8 w-12" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardContent className="pt-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full mb-2" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
