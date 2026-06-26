import {
  BadgeCheck,
  Bike,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
  TrendingUp,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireWarehouseDeliveryman } from "@/utils/auth";
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

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium">
          {value || "Not set"}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DeliveryProfilePage() {
  const session = await requireWarehouseDeliveryman();
  const user = session.user as DeliveryProfileUser;
  const stats = await client.deliveryman.getStats().catch(() => null);

  const displayName = user.name || "Delivery Man";
  const warehouseLabel = user.warehouseName || user.warehouseId;

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
            Delivery account and warehouse assignment
          </p>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="bg-muted/40 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
                {getInitials(displayName, user.email)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold leading-tight">
                    {displayName}
                  </h2>
                  <Badge variant="secondary" className="rounded-full">
                    <BadgeCheck className="mr-1 size-3" />
                    Deliveryman
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.email || user.phoneNumber || "No contact added"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border bg-background px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Building2 className="size-4 text-primary" />
                Warehouse Scope
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {warehouseLabel || "Assigned warehouse"}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileField icon={Mail} label="Email" value={user.email} />
            <ProfileField icon={Phone} label="Phone" value={user.phoneNumber} />
            <ProfileField
              icon={ShieldCheck}
              label="Account Role"
              value={user.role || "deliveryman"}
            />
            <ProfileField
              icon={Building2}
              label="Warehouse ID"
              value={user.warehouseId}
            />
          </div>
        </CardContent>
      </Card>

      {stats && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base">Delivery Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                icon={CheckCircle2}
                label="Delivered"
                value={stats.delivered}
              />
              <StatCard
                icon={Bike}
                label="Active Groups"
                value={stats.activeGroups}
              />
              <StatCard
                icon={TrendingUp}
                label="Success Rate"
                value={`${stats.successRate}%`}
              />
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              These numbers are based on your assigned delivery groups in this
              warehouse scope.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
