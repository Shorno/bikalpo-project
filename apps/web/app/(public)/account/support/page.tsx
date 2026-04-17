"use client";

import { UserSupportPanel } from "@/components/support/user-support-panel";

export default function SupportPage() {
    return (
        <div className="space-y-6">
            <UserSupportPanel userRole="consumer" />
        </div>
    );
}
