"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { orpc } from "@/utils/orpc";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { defaultToLetBanner, toLetBannerSchema, type ToLetBannerSlide } from "@bikalpo-project/api/lib/tolet-banner";

export default function ToLetBannerAdmin() {
  const query = useQuery(orpc.toLetBanner.get.queryOptions());
  const [draft, setDraft] = useState<ToLetBannerSlide[] | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const save = useMutation({ ...orpc.toLetBanner.save.mutationOptions(), onSuccess: () => { query.refetch(); } });
  const slides = draft ?? (query.data?.slides.length ? query.data.slides : defaultToLetBanner);
  const busy = save.isPending || Object.values(uploading).some(Boolean);
  const update = (index: number, patch: Partial<ToLetBannerSlide>) => { save.reset(); setDraft(slides.map((slide, i) => i === index ? { ...slide, ...patch } : slide)); };
  if (query.isPending) return <p role="status">Loading To-Let banner settings…</p>;
  if (query.isError) return <div role="alert"><p>Banner settings unavailable. Check that the To-Let banner migration has been applied.</p><Button onClick={() => query.refetch()}>Retry</Button></div>;
  return <div className="max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-semibold">To-Let banner & title</h1><p className="mt-2 text-sm text-muted-foreground">Upload up to 10 slides. Images, titles and optional links appear on the To-Let landing page. Multiple slides rotate every 6 seconds.</p><Link href="/to-let" target="_blank" className="mt-2 inline-flex min-h-11 items-center text-primary">Open landing page ↗</Link></div>
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); const parsed = toLetBannerSchema.safeParse({ slides }); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check slide details"); return; } setError(""); save.mutate(parsed.data); }}>
      {slides.map((slide, index) => <fieldset key={index} disabled={busy} className="space-y-4 rounded-xl border bg-card p-5">
        <legend className="px-2 font-semibold">Slide {index + 1}</legend>
        {slide.imageUrl.startsWith("/") && <div><div className="relative aspect-video overflow-hidden rounded-lg"><Image src={slide.imageUrl} alt="Current To-Let banner" fill sizes="(max-width: 768px) 100vw, 800px" className="object-cover" /></div><p className="mt-2 text-sm text-muted-foreground">Current landing image. Upload below to replace it, or keep it and edit the title.</p></div>}
        <ImageUploader value={slide.imageUrl.startsWith("/") ? "" : slide.imageUrl} folder="tolet-banners" deleteOnRemove={false} maxSizeMB={5} onChange={imageUrl => update(index, { imageUrl })} onUploadStateChange={value => setUploading(previous => ({ ...previous, [index]: value }))} />
        <label className="block text-sm font-medium">Title<input required maxLength={150} value={slide.title} onChange={e => update(index, { title: e.target.value })} className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" /></label>
        <label className="block text-sm font-medium">Link (optional)<input maxLength={2000} placeholder="/to-let/listings or https://example.com" value={slide.link} onChange={e => update(index, { link: e.target.value })} className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" /></label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={index === 0 || busy} onClick={() => { const next = [...slides]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; save.reset(); setDraft(next); }}>Move up</Button>
          <Button type="button" variant="outline" disabled={index === slides.length - 1 || busy} onClick={() => { const next = [...slides]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; save.reset(); setDraft(next); }}>Move down</Button>
          <Button type="button" variant="outline" onClick={() => { save.reset(); setDraft(slides.filter((_, i) => i !== index)); }}>Remove slide</Button>
        </div>
      </fieldset>)}
      <Button type="button" variant="outline" disabled={slides.length >= 10 || busy} onClick={() => { save.reset(); setDraft([...slides, { title: "", imageUrl: "", link: "" }]); }}>Add slide</Button>
      {(error || save.isError) && <p role="alert" className="text-sm text-destructive">{error || save.error?.message}</p>}
      {save.isSuccess && <p role="status" className="text-sm text-primary">Banner published. Landing page updates within 60 seconds.</p>}
      <div><Button type="submit" disabled={busy || !slides.length}>{save.isPending ? "Publishing…" : "Save & publish"}</Button></div>
    </form>
  </div>;
}
