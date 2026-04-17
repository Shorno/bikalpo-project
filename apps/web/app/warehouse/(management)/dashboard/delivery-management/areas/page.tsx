"use client";

import { Fragment, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  MapPinIcon,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { orpc } from "@/utils/orpc";

// Dynamic import for map (Leaflet needs window)
const AreaPolygonEditor = dynamic(
  () => import("@/components/admin/areas/area-polygon-editor"),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> },
);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ── KPI Card ──
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Area Dialog ──
function CreateAreaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [polygon, setPolygon] = useState<number[][][] | null>(null);
  const [centerLat, setCenterLat] = useState<string | null>(null);
  const [centerLng, setCenterLng] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<string | null>(null);

  const createMutation = useMutation({
    ...orpc.warehouseDelivery.createArea.mutationOptions(),
    onSuccess: () => {
      toast.success("Delivery area created");
      queryClient.invalidateQueries({ queryKey: orpc.warehouseDelivery.key() });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message || "Failed to create area"),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPolygon(null);
    setCenterLat(null);
    setCenterLng(null);
    setRadiusKm(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Delivery Area</DialogTitle>
          <DialogDescription>
            Define a new delivery area with map boundaries
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="area-name">Area Name</Label>
            <Input
              id="area-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Uttara Zone, Mirpur-10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area-desc">Description (optional)</Label>
            <Textarea
              id="area-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Coverage details, landmarks, etc."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Area Boundary</Label>
            <p className="text-xs text-muted-foreground">
              Search a location, draw a polygon boundary, or set a center point
            </p>
            <AreaPolygonEditor
              polygon={polygon}
              centerLat={centerLat}
              centerLng={centerLng}
              radiusKm={radiusKm}
              onPolygonChange={setPolygon}
              onCenterChange={(lat, lng) => {
                setCenterLat(lat);
                setCenterLng(lng);
              }}
              onAddressResolved={(info) => {
                if (!name) setName(info.area || "");
              }}
              height="300px"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate({
              name: name.trim(),
              description: description || undefined,
              polygon,
              centerLat,
              centerLng,
              radiusKm,
            })}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Area Dialog ──
function EditAreaDialog({
  area,
  open,
  onOpenChange,
}: {
  area: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(area?.name ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
  const [polygon, setPolygon] = useState<number[][][] | null>(area?.polygon ?? null);
  const [centerLat, setCenterLat] = useState<string | null>(area?.centerLat ?? null);
  const [centerLng, setCenterLng] = useState<string | null>(area?.centerLng ?? null);
  const [status, setStatus] = useState<string>(area?.status ?? "active");

  const updateMutation = useMutation({
    ...orpc.warehouseDelivery.updateArea.mutationOptions(),
    onSuccess: () => {
      toast.success("Area updated");
      queryClient.invalidateQueries({ queryKey: orpc.warehouseDelivery.key() });
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update area"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Delivery Area</DialogTitle>
          <DialogDescription>Update area details and boundaries</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Area Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Area name"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Coverage details"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Area Boundary</Label>
            <AreaPolygonEditor
              polygon={polygon}
              centerLat={centerLat}
              centerLng={centerLng}
              onPolygonChange={setPolygon}
              onCenterChange={(lat, lng) => {
                setCenterLat(lat);
                setCenterLng(lng);
              }}
              height="300px"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate({
              id: area.id,
              name: name.trim() || undefined,
              description: description || null,
              polygon,
              centerLat,
              centerLng,
              status: status as "active" | "inactive",
            })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Schedule Dialog ──
function ScheduleDialog({
  area,
  open,
  onOpenChange,
}: {
  area: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const existingDays = area?.deliveryDays?.map((d: any) => d.dayOfWeek) ?? [];
  const existingRiderId = area?.deliveryDays?.[0]?.riderId ?? null;

  const [selectedDays, setSelectedDays] = useState<number[]>(existingDays);
  const [riderId, setRiderId] = useState<string>(existingRiderId ?? "none");

  const { data: ridersData } = useQuery(
    orpc.warehouseDelivery.getAvailableRiders.queryOptions({ input: {} }),
  );

  const upsertMutation = useMutation({
    ...orpc.warehouseDelivery.upsertSchedule.mutationOptions(),
    onSuccess: () => {
      toast.success("Schedule updated");
      queryClient.invalidateQueries({ queryKey: orpc.warehouseDelivery.key() });
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update schedule"),
  });

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Delivery Schedule</DialogTitle>
          <DialogDescription>
            Set delivery days for <span className="font-semibold">{area?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Delivery Days</Label>
            <div className="grid grid-cols-4 gap-2">
              {DAY_NAMES.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleDay(index)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    selectedDays.includes(index)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {DAY_SHORT[index]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Rider (optional)</Label>
            <Select value={riderId} onValueChange={setRiderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a rider..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default rider</SelectItem>
                {ridersData?.riders?.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.phoneNumber ? `(${r.phoneNumber})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => upsertMutation.mutate({
              areaId: area.id,
              days: selectedDays,
              defaultRiderId: riderId === "none" ? null : riderId,
            })}
            disabled={upsertMutation.isPending}
          >
            {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Area Detail Panel ──
function AreaDetailPanel({ area }: { area: any }) {
  return (
    <div className="border-t bg-muted/30 px-4 py-4 space-y-4">
      {/* Map Preview */}
      {(area.polygon || area.centerLat) && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Map Preview
          </p>
          <AreaPolygonEditor
            polygon={area.polygon}
            centerLat={area.centerLat}
            centerLng={area.centerLng}
            radiusKm={area.radiusKm}
            readOnly
            height="200px"
          />
        </div>
      )}

      {/* Delivery Days */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Delivery Days
        </p>
        {area.deliveryDays?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {area.deliveryDays.map((d: any) => (
              <div
                key={d.dayOfWeek}
                className="flex items-center gap-1.5 bg-background border rounded-lg px-3 py-1.5"
              >
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium">{d.dayName}</span>
                {d.riderName && (
                  <span className="text-xs text-muted-foreground">• {d.riderName}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No scheduled delivery days</p>
        )}
      </div>

      {/* Description */}
      {area.description && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Description
          </p>
          <p className="text-sm text-muted-foreground">{area.description}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ──
export default function DeliveryAreasPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArea, setExpandedArea] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editArea, setEditArea] = useState<any | null>(null);
  const [scheduleArea, setScheduleArea] = useState<any | null>(null);
  const [deleteArea, setDeleteArea] = useState<any | null>(null);

  // Queries
  const { data: areasData, isLoading: areasLoading } = useQuery(
    orpc.warehouseDelivery.getAreas.queryOptions({ input: {} }),
  );
  const { data: kpiData, isLoading: kpiLoading } = useQuery(
    orpc.warehouseDelivery.getAreaKpis.queryOptions({ input: {} }),
  );
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery(
    orpc.warehouseDelivery.getWeeklySchedule.queryOptions({ input: {} }),
  );
  const { data: todayData } = useQuery(
    orpc.warehouseDelivery.getTodayPlan.queryOptions({ input: {} }),
  );

  // Mutations
  const deleteMutation = useMutation({
    ...orpc.warehouseDelivery.deleteArea.mutationOptions(),
    onSuccess: () => {
      toast.success("Area deleted");
      queryClient.invalidateQueries({ queryKey: orpc.warehouseDelivery.key() });
      setDeleteArea(null);
    },
    onError: (error) => toast.error(error.message || "Failed to delete area"),
  });

  // Filter areas
  const filteredAreas = useMemo(() => {
    if (!areasData?.areas) return [];
    if (!searchQuery.trim()) return areasData.areas;
    const q = searchQuery.toLowerCase();
    return areasData.areas.filter(
      (a: any) =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }, [areasData?.areas, searchQuery]);

  const today = new Date().getDay();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Delivery Areas
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage delivery zones and weekly schedules
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Area
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              label="Total Areas"
              value={kpiData?.totalAreas ?? 0}
              icon={MapPin}
              color="bg-blue-50 text-blue-600"
            />
            <KpiCard
              label="Active Areas"
              value={kpiData?.activeAreas ?? 0}
              icon={Route}
              color="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              label="Today's Areas"
              value={kpiData?.todayAreas ?? 0}
              icon={Truck}
              color="bg-amber-50 text-amber-600"
            />
            <KpiCard
              label="Weekly Plans"
              value={kpiData?.weeklyPlans ?? 0}
              icon={CalendarDays}
              color="bg-purple-50 text-purple-600"
            />
          </>
        )}
      </div>

      {/* Today's Delivery Plan */}
      {todayData && todayData.areas.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <CardTitle className="text-base">
                Today&apos;s Delivery Plan — {todayData.dayName}
              </CardTitle>
            </div>
            <CardDescription>
              {todayData.date}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todayData.areas.map((a: any) => (
                <div
                  key={a.scheduleId}
                  className="flex items-center gap-3 bg-background rounded-lg border p-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <MapPinIcon className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {a.areaName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.riderName || "No rider assigned"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Delivery Schedule</CardTitle>
          <CardDescription>
            Delivery areas and riders assigned for each day
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Day</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rider Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyData?.weekly?.map((day: any) => (
                    <TableRow
                      key={day.dayOfWeek}
                      className={day.dayOfWeek === today ? "bg-primary/[0.03]" : day.isOff ? "bg-muted/30" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {day.dayOfWeek === today && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                          {day.dayName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {day.isOff ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {day.areas.map((a: any) => (
                              <Badge key={a.scheduleId} variant="secondary" className="text-xs">
                                {a.areaName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {day.isOff ? (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            OFF
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {day.isOff ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {day.areas.map((a: any) => (
                              <span key={a.scheduleId} className="text-sm">
                                {a.riderName || <span className="text-muted-foreground italic">Unassigned</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Area List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Delivery Areas</CardTitle>
              <CardDescription>
                {filteredAreas.length} area{filteredAreas.length !== 1 ? "s" : ""} configured
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search areas..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {areasLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAreas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No areas match your search" : "No delivery areas created yet"}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first area
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area Name</TableHead>
                    <TableHead>Delivery Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAreas.map((area: any) => (
                    <Fragment key={area.id}>
                      <TableRow
                        key={area.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedArea(expandedArea === area.id ? null : area.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <MapPinIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{area.name}</p>
                              {area.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {area.description}
                                </p>
                              )}
                            </div>
                            {expandedArea === area.id ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {area.deliveryDays?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {area.deliveryDays.map((d: any) => (
                                <Badge key={d.dayOfWeek} variant="secondary" className="text-[10px]">
                                  {DAY_SHORT[d.dayOfWeek as number]}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              No schedule
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={area.status === "active" ? "outline" : "secondary"}
                            className={
                              area.status === "active"
                                ? "text-emerald-600 border-emerald-200 text-[10px]"
                                : "text-muted-foreground text-[10px]"
                            }
                          >
                            {area.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setScheduleArea(area)}
                              title="Edit schedule"
                            >
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditArea(area)}
                              title="Edit area"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteArea(area)}
                              title="Delete area"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedArea === area.id && (
                        <TableRow key={`${area.id}-detail`}>
                          <TableCell colSpan={4} className="p-0">
                            <AreaDetailPanel area={area} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateAreaDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editArea && (
        <EditAreaDialog
          area={editArea}
          open={!!editArea}
          onOpenChange={(open) => !open && setEditArea(null)}
        />
      )}
      {scheduleArea && (
        <ScheduleDialog
          area={scheduleArea}
          open={!!scheduleArea}
          onOpenChange={(open) => !open && setScheduleArea(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteArea} onOpenChange={(open) => !open && setDeleteArea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Area</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteArea?.name}</strong>?
              This will also remove all associated delivery schedules. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteArea && deleteMutation.mutate({ id: deleteArea.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
