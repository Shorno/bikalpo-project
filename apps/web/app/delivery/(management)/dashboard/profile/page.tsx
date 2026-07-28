import {
  BadgeCheck,
  Bike,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireFulfillmentDeliveryman } from "@/utils/auth";
import { client } from "@/utils/orpc";

export const dynamic = "force-dynamic";

type DeliveryProfileUser = {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  image?: string | null;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "Delivery Man";
  return source
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function DeliveryProfilePage() {
  const session = await requireFulfillmentDeliveryman();
  const user = session.user as DeliveryProfileUser;
  const stats = await client.deliveryman.getStats().catch(() => null);
  const warehouseDetails = await client.deliveryman
    .getAssignedWarehouse()
    .catch(() => null);

  const displayName = user.name || "Delivery Man";
  const warehouseLabel =
    user.warehouseName ||
    warehouseDetails?.warehouseName ||
    warehouseDetails?.name;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            My Profile
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Your delivery account details
          </p>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
              {getInitials(displayName, user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold leading-tight">
                  {displayName}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  <BadgeCheck className="mr-1 size-3" />
                  Deliveryman
                </Badge>
              </div>

              <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0" />
                    <span>{user.email}</span>
                  </div>
                )}
                {user.phoneNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0" />
                    <span>{user.phoneNumber}</span>
                  </div>
                )}
                {warehouseLabel && (
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{warehouseLabel}</span>
                  </div>
                )}
                {!user.email && !user.phoneNumber && (
                  <p>No contact information added</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {warehouseDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Organization Name
                </p>
                <p className="text-sm font-semibold">
                  {warehouseDetails.warehouseName || warehouseDetails.name}
                </p>
              </div>
              {warehouseDetails.phoneNumber && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Organization Phone
                  </p>
                  <p className="text-sm font-semibold">
                    {warehouseDetails.phoneNumber}
                  </p>
                </div>
              )}
              {warehouseDetails.email && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Organization Email
                  </p>
                  <p className="text-sm font-semibold">
                    {warehouseDetails.email}
                  </p>
                </div>
              )}
              {warehouseDetails.warehouseAddress && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Dispatch Location
                  </p>
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                    {warehouseDetails.warehouseAddress}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">
                    {stats.delivered}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Delivered
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bike className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">
                    {stats.activeGroups}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Active Groups
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">
                    {stats.successRate}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Success Rate
                  </p>
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Based on Delivery Groups assigned by your organization.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
