"use client";

import { Bell, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ToLetAlertManager } from "@/components/features/to-let/alerts/to-let-alert-manager";
import { Button } from "@/components/ui/button";
import { ToLetAlertInbox } from "./to-let-alert-inbox";

export function MyAlertsClient() {
  const [showForm, setShowForm] = useState(true);
  const createButton = useRef<HTMLButtonElement>(null);
  const closeForm = () => {
    setShowForm(false);
    createButton.current?.focus();
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900">My Alert</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Save the type and location you need, then manage your To-Let search
            preferences from one place.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/to-let#listings">
            <Search className="size-4" aria-hidden="true" />
            Browse To-Let
          </Link>
        </Button>
        <Button ref={createButton} aria-expanded={showForm} aria-controls="alert-preferences-panel" onClick={() => setShowForm(value => !value)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Close form" : "Create Alert"}
        </Button>
        </div>
      </header>

      {showForm && <section id="alert-preferences-panel" aria-labelledby="alert-preferences-heading" className="rounded-xl border border-border bg-white p-4 sm:p-6">
        <h2 id="alert-preferences-heading" className="mb-5 text-lg font-semibold">Create alert & manage preferences</h2>
        <ToLetAlertManager onClose={closeForm} />
      </section>}
      <ToLetAlertInbox onCreateAlert={() => { setShowForm(true); createButton.current?.focus(); }} />
    </div>
  );
}
