import { redirect } from "next/navigation";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { checkAuth } from "@/utils/auth";

export default async function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await checkAuth();

    if (!session?.user) {
        redirect("/login?redirect=/account");
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                        Your Account
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {session.user.name}, Email: {session.user.email}
                    </p>
                </div>

                {/* Layout */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <AccountSidebar />

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">{children}</main>
                </div>
            </div>
        </div>
    );
}
