"use client";

import type { storeItemRequest } from "@bikalpo-project/db/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import { client, orpc } from "@/utils/orpc";

type Request = typeof storeItemRequest.$inferSelect;

function RequestDetails({ request }: { request: Request }) {
  return (
    <div className="space-y-2 break-words">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{request.itemName}</h2>
        <span className="text-sm font-medium capitalize">{request.status}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Request #{request.id} · Quantity: {request.quantity}
        {request.brand ? ` · ${request.brand}` : ""}
      </p>
      {request.description && (
        <p className="whitespace-pre-wrap leading-6">{request.description}</p>
      )}
      {request.response && (
        <div className="mt-4 bg-muted/40 p-4">
          <p className="text-sm font-semibold">Store reply</p>
          <p className="mt-2 whitespace-pre-wrap leading-6">
            {request.response}
          </p>
        </div>
      )}
    </div>
  );
}

function Pages({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (page: number) => void;
}) {
  return total > 20 ? (
    <nav
      aria-label="Request pages"
      className="mt-6 flex items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {page} of {Math.ceil(total / 20)}
      </span>
      <Button
        variant="outline"
        disabled={page * 20 >= total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  ) : null;
}

export function StoreItemRequests({
  shopId,
  viewerId,
  name,
  storeHref,
  openInitially,
}: {
  shopId: string;
  viewerId: string;
  name: string;
  storeHref: string;
  openInitially: boolean;
}) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(openInitially);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("request") === "new") setOpen(true);
  }, [searchParams]);
  function closeForm() {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("request");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);
  const cache = useQueryClient();
  const options = orpc.storeItemRequest.mine.queryOptions({
    input: { shopId, page },
  });
  const query = useQuery({
    ...options,
    queryKey: [...options.queryKey, viewerId],
  });
  const mutation = useMutation({
    mutationFn: () =>
      client.storeItemRequest.create({
        shopId,
        itemName,
        brand,
        quantity: Number(quantity),
        description,
      }),
    onSuccess: () => {
      closeForm();
      setItemName("");
      setBrand("");
      setQuantity("1");
      setDescription("");
      setSuccess(true);
      setPage(1);
      void cache.invalidateQueries({ queryKey: orpc.storeItemRequest.key() });
    },
  });
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={storeHref}
        className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
      >
        Back to {name}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold">Your item requests</h1>
      <p className="mt-3 leading-6 text-muted-foreground">
        Ask {name} for an item and follow their reply here. A request is not an
        order.
      </p>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) {
            if (value) setOpen(true);
            else closeForm();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button className="mt-6 min-h-11">Request an item</Button>
        </DialogTrigger>
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto p-6"
          showCloseButton={!mutation.isPending}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Request an item</DialogTitle>
            <DialogDescription>
              Your request goes directly to {name}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!mutation.isPending) mutation.mutate();
            }}
          >
            <fieldset disabled={mutation.isPending} className="space-y-4">
              <label className="block space-y-2">
                <span className="font-medium">Item name</span>
                <Input
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  className="min-h-11 text-base"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-2">
                  <span className="font-medium">Quantity</span>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                    min={1}
                    max={10000}
                    step={1}
                    className="min-h-11 text-base"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="font-medium">Brand (optional)</span>
                  <Input
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    maxLength={100}
                    className="min-h-11 text-base"
                  />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="font-medium">Details (optional)</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  placeholder="Size, packaging or any other preferences"
                  className="min-h-28 text-base"
                />
              </label>
              {mutation.isError && (
                <p role="alert" className="text-destructive">
                  {mutation.error.message}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={closeForm}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-11">
                  {mutation.isPending ? "Sending…" : "Send request"}
                </Button>
              </div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      {success && (
        <p role="status" className="mt-5 text-sm">
          Request sent to {name}. Their reply will appear below.
        </p>
      )}
      {query.isPending ? (
        <p role="status" className="py-10">
          Loading requests…
        </p>
      ) : query.isError ? (
        <div className="py-8">
          <p role="alert">Couldn’t load your requests.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.data.requests.length === 0 ? (
        <p className="mt-8 border-y py-8 text-muted-foreground">
          No item requests with this store yet.
        </p>
      ) : (
        <ul className="mt-8 divide-y border-y">
          {query.data.requests.map((request) => (
            <li key={request.id} className="py-6">
              <RequestDetails request={request} />
            </li>
          ))}
        </ul>
      )}
      <Pages page={page} total={query.data?.total ?? 0} setPage={setPage} />
    </section>
  );
}

function Respond({ request }: { request: Request }) {
  const [open, setOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [status, setStatus] = useState<"available" | "unavailable">(
    request.status === "unavailable" ? "unavailable" : "available",
  );
  const [response, setResponse] = useState(request.response ?? "");
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      client.storeItemRequest.respond({ id: request.id, status, response }),
    onSuccess: () => {
      setOpen(false);
      setHasDraft(false);
      void cache.invalidateQueries({ queryKey: orpc.storeItemRequest.key() });
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (mutation.isPending) return;
        if (value && !hasDraft) {
          setStatus(
            request.status === "unavailable" ? "unavailable" : "available",
          );
          setResponse(request.response ?? "");
        }
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="mt-4">
          {request.response ? "Update reply" : "Respond"}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!mutation.isPending}
        className="max-h-[85dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Reply to item request</DialogTitle>
          <DialogDescription>
            {request.itemName} · Quantity {request.quantity}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <label className="block space-y-2">
              <span>Availability</span>
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3 text-base"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setHasDraft(true);
                }}
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span>Reply to consumer</span>
              <Textarea
                value={response}
                onChange={(event) => {
                  setResponse(event.target.value);
                  setHasDraft(true);
                }}
                required
                minLength={2}
                maxLength={2000}
                className="min-h-28 text-base"
              />
            </label>
            {mutation.isError && (
              <p role="alert" className="text-destructive">
                {mutation.error.message}
              </p>
            )}
            <Button type="submit" className="min-h-11">
              {mutation.isPending ? "Saving…" : "Send reply"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StoreItemRequestInbox({
  viewerId,
  canRespond,
}: {
  viewerId: string;
  canRespond: boolean;
}) {
  const [page, setPage] = useState(1);
  const options = orpc.storeItemRequest.inbox.queryOptions({ input: { page } });
  const query = useQuery({
    ...options,
    queryKey: [...options.queryKey, viewerId],
  });
  return (
    <section className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Item Requests</h1>
      <p className="mt-3 text-muted-foreground">
        Items consumers have requested from your store. Reply with availability
        and next steps.
      </p>
      {query.isPending ? (
        <p role="status" className="py-10">
          Loading requests…
        </p>
      ) : query.isError ? (
        <div className="py-8">
          <p role="alert">Couldn’t load item requests.</p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : query.data.requests.length === 0 ? (
        <p className="mt-8 border-y py-8">No item requests yet.</p>
      ) : (
        <ul className="mt-8 divide-y border-y">
          {query.data.requests.map(({ request, customerName }) => (
            <li key={request.id} className="py-6">
              <p className="mb-3 text-sm text-muted-foreground">
                From {customerName}
              </p>
              <RequestDetails request={request} />
              {canRespond && <Respond request={request} />}
            </li>
          ))}
        </ul>
      )}
      <Pages page={page} total={query.data?.total ?? 0} setPage={setPage} />
    </section>
  );
}
