"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function ToLetError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Unable to load To-Let</h1>
      <p role="alert" className="mt-3 text-muted-foreground">
        We couldn’t load the rental information. Please try again.
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={retry} disabled={pending} aria-busy={pending}>
          {pending ? "Trying again…" : "Try again"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/to-let">Back to listings</Link>
        </Button>
      </div>
    </section>
  );
}
