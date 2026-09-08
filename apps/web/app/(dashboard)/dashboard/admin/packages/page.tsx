import { PackagesManagement } from "@/components/admin/packages/packages-management";
import { RetailerSubscriptionsManagement } from "@/components/admin/packages/retailer-subscriptions-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPackagesPage() {
  return (
    <Tabs defaultValue="retailer">
      <TabsList className="mx-4 mt-4">
        <TabsTrigger value="retailer">Retailer Subscriptions</TabsTrigger>
        <TabsTrigger value="landing">Landing Page Packages</TabsTrigger>
      </TabsList>
      <TabsContent value="retailer">
        <RetailerSubscriptionsManagement />
      </TabsContent>
      <TabsContent value="landing">
        <PackagesManagement />
      </TabsContent>
    </Tabs>
  );
}
