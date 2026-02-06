import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-yellow-100 p-4">
            <Clock className="h-12 w-12 text-yellow-600" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Account Pending Approval
        </h1>

        <p className="mb-6 text-muted-foreground">
          Your account has been created successfully! An administrator will
          review and approve your account shortly. You&apos;ll receive access to
          the dashboard once approved.
        </p>

        <div className="flex flex-col gap-3">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
