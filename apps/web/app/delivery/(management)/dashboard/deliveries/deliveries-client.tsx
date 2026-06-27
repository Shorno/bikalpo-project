"use client";

import { Bike, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DeliveryGroupsList,
  EmptyState,
  type DeliveryGroupListItem,
} from "@/components/features/delivery/deliveries-list";
import {
  DeliveryHistoryList,
  type DeliveryHistoryItem,
} from "@/components/features/delivery/deliveries-list/delivery-history-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DeliveriesClientProps {
  activeGroups: DeliveryGroupListItem[];
  historyGroups: DeliveryHistoryItem[];
  defaultTab?: "active" | "history";
}

function TabCount({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        "bg-muted text-muted-foreground",
        "group-data-[state=active]/tab-trigger:bg-primary/10 group-data-[state=active]/tab-trigger:text-primary",
      )}
    >
      {count}
    </span>
  );
}

function DeliveryTabTrigger({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: string;
  icon: typeof Bike;
  label: string;
  count: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "group/tab-trigger relative flex h-11 flex-1 items-center justify-center gap-2 rounded-none border-0 bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none",
        "hover:text-foreground",
        "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
        "data-[state=active]:after:opacity-100",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70 group-data-[state=active]/tab-trigger:opacity-100" />
      <span>{label}</span>
      <TabCount count={count} />
    </TabsTrigger>
  );
}

export function DeliveriesClient({
  activeGroups,
  historyGroups,
  defaultTab = "active",
}: DeliveriesClientProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full gap-0">
      <TabsList
        variant="line"
        className="h-auto w-full justify-stretch gap-0 rounded-none border-b bg-transparent p-0"
      >
        <DeliveryTabTrigger
          value="active"
          icon={Bike}
          label="Active"
          count={activeGroups.length}
        />
        <DeliveryTabTrigger
          value="history"
          icon={History}
          label="History"
          count={historyGroups.length}
        />
      </TabsList>

      <TabsContent value="active" className="mt-4 outline-none sm:mt-5">
        {activeGroups.length > 0 ? (
          <DeliveryGroupsList groups={activeGroups} />
        ) : (
          <EmptyState />
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4 outline-none sm:mt-5">
        <DeliveryHistoryList groups={historyGroups} />
      </TabsContent>
    </Tabs>
  );
}
