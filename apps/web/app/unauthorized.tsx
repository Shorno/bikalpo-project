// app/unauthorized.tsx

import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-6">
              <ShieldX className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl font-bold tracking-tight">401</h1>
            <p className="text-lg text-muted-foreground">
              You&#39;re not authorized to access this page.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
