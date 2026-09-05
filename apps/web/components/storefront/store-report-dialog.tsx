"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

export function StoreReportDialog({
  shopId,
  name,
}: {
  shopId: string;
  name: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("report") === "issue");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [validation, setValidation] = useState("");
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const role = session?.user.role;
  const isConsumer = !role || role === "consumer" || role === "user";
  const returnParams = new URLSearchParams(searchParams.toString());
  returnParams.set("report", "issue");
  const loginHref = `/login?redirect=${encodeURIComponent(`${pathname}?${returnParams}`)}`;
  const mutation = useMutation({
    mutationFn: () =>
      client.userTicket.create({
        shopId,
        subject: subject.trim(),
        message: message.trim(),
        category: "other",
        priority: "medium",
      }),
    onSuccess: () => {
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: orpc.userTicket.key() });
    },
  });

  function changeOpen(next: boolean) {
    if (mutation.isPending) return;
    setOpen(next);
    if (!next && searchParams.has("report")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("report");
      window.history.replaceState(
        null,
        "",
        `${pathname}${params.size ? `?${params}` : ""}${window.location.hash}`,
      );
    }
    if (next && mutation.isSuccess) mutation.reset();
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-left hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Report issue
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto p-6 sm:max-w-lg"
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl leading-tight">
            {mutation.isSuccess ? "Report sent" : "Report an issue"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {name} will receive your report through Bikalpo support.
          </DialogDescription>
        </DialogHeader>
        {sessionPending ? (
          <p role="status" className="py-6 text-muted-foreground">
            Checking your account…
          </p>
        ) : !session ? (
          <div className="space-y-5">
            <p className="leading-6 text-muted-foreground">
              Sign in to send your report and keep track of replies. You’ll
              return to this store’s report form.
            </p>
            <Button asChild className="min-h-11 w-full">
              <a href={loginHref}>Sign in to continue</a>
            </Button>
          </div>
        ) : !isConsumer ? (
          <p className="py-3 leading-6 text-muted-foreground">
            Store reports are available with a consumer account. Use your
            dashboard’s support section for business support.
          </p>
        ) : mutation.isSuccess ? (
          <div className="space-y-5">
            <p className="flex items-start gap-3 leading-6">
              <CheckCircle2
                className="mt-1 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                Ticket {mutation.data.ticketNumber} has been created. You can
                follow replies in Support tickets.
              </span>
            </p>
            <Button asChild className="min-h-11 w-full">
              <Link href={`/account/support/${mutation.data.id}`}>
                View report
              </Link>
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => changeOpen(false)}
            >
              Back to store
            </Button>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (subject.trim().length < 5 || message.trim().length < 10) {
                setValidation(
                  "Use at least 5 characters for the subject and 10 characters for the description.",
                );
                return;
              }
              setValidation("");
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <label htmlFor="store-report-subject" className="font-medium">
                Subject
              </label>
              <Input
                id="store-report-subject"
                required
                minLength={5}
                maxLength={200}
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setValidation("");
                }}
                placeholder="Briefly describe the issue"
                className="min-h-11 text-base"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="store-report-message" className="font-medium">
                What happened?
              </label>
              <Textarea
                id="store-report-message"
                required
                minLength={10}
                maxLength={5000}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setValidation("");
                }}
                placeholder="Tell the store what went wrong and how they can help."
                className="min-h-36 text-base"
                disabled={mutation.isPending}
                aria-describedby="store-report-hint"
              />
              <p
                id="store-report-hint"
                className="text-xs leading-5 text-muted-foreground"
              >
                Include your order number if relevant. Don’t share passwords or
                payment card details.
              </p>
            </div>
            {(validation || mutation.isError) && (
              <p role="alert" className="text-sm text-destructive">
                {validation ||
                  mutation.error?.message ||
                  "Your report could not be sent. Please try again."}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={mutation.isPending}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={mutation.isPending}
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {mutation.isPending ? "Sending report…" : "Send report"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
