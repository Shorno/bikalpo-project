"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLoginRequired } from "@/components/features/auth/login-required-modal";
import { ToLetAlertManager } from "@/components/features/to-let/alerts/to-let-alert-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import type { ToLetMarketRentalType } from "@/lib/to-let-marketplace";

export function ToLetAlertDialog({
  query,
  selectedType,
}: {
  query: string;
  selectedType?: ToLetMarketRentalType;
}) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const { showLoginModal } = useLoginRequired();
  const isCheckingSession = !isHydrated || isSessionPending;
  const role = (session?.user as { role?: string | null } | undefined)?.role;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const openAlertManager = () => {
    if (isCheckingSession) return;

    if (!session?.user) {
      showLoginModal();
      return;
    }

    if (role !== "consumer") {
      toast.error("A consumer account is required to save a To-Let alert");
      return;
    }

    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openAlertManager}
        disabled={isCheckingSession}
        className="min-h-11 w-fit border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Bell className="size-4" />
        {isCheckingSession ? "Checking..." : "My Alert"}
      </Button>

      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved To-Let alerts</DialogTitle>
          <DialogDescription>
            Save your preferred location and unit requirements. You can return
            here to pause or resume each saved search.
          </DialogDescription>
        </DialogHeader>
        <ToLetAlertManager
          query={query}
          selectedType={selectedType}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
