"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncomingSupportPanel } from "@/components/support/incoming-support-panel";
import { UserSupportPanel } from "@/components/support/user-support-panel";

export default function WarehouseSupportPage() {
    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Support Center</h1>
                <p className="text-sm text-muted-foreground">
                    Handle shop tickets and manage your own support requests.
                </p>
            </div>

            <Tabs defaultValue="incoming" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="incoming">Shop Tickets</TabsTrigger>
                    <TabsTrigger value="my-tickets">My Tickets</TabsTrigger>
                </TabsList>

                <TabsContent value="incoming">
                    <IncomingSupportPanel />
                </TabsContent>

                <TabsContent value="my-tickets">
                    <UserSupportPanel userRole="warehouse" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
