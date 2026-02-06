import { ChevronsUpDown } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserNavSkeleton() {
  return (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <Skeleton className="h-8 w-8 rounded-lg bg-gray-200" />

      <div className="grid flex-1 text-left text-sm leading-tight">
        <Skeleton className="h-4 w-20 mb-1 bg-gray-200" />
        <Skeleton className="h-3 w-32 bg-gray-200" />
      </div>

      <ChevronsUpDown className="ml-auto size-4" />
    </SidebarMenuButton>
  );
}
