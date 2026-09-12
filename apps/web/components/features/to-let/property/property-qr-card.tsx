"use client";

import { Download, ExternalLink, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PropertyQrPoster } from "./property-qr-poster";

export function PropertyQrCard(props: {
  propertyCode: string;
  qrToken: string;
  propertyName: string;
  location?: string | null;
}) {
  const { propertyCode, qrToken } = props;
  const posterRef = useRef<SVGSVGElement>(null);
  const [origin, setOrigin] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL;
    setOrigin((configured || window.location.origin).replace(/\/$/, ""));
  }, []);
  const qrPath = `/to-let/qr/${encodeURIComponent(qrToken)}`;
  const qrUrl = origin ? `${origin}${qrPath}` : "";

  const downloadQr = async () => {
    if (!posterRef.current || !qrUrl || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const { createPropertyQrPdf } = await import("@/lib/property-qr-pdf");
      const pdf = await createPropertyQrPdf(posterRef.current, propertyCode);
      const objectUrl = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${propertyCode.replace(/[^a-zA-Z0-9-]/g, "_")}-to-let-qr-poster.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setError("Could not download the poster. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <aside className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <QrCode className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Permanent QR identity</h2>
          <p className="font-mono text-xs text-gray-500">{propertyCode}</p>
        </div>
      </div>
      <div data-property-qr-poster className="mt-5">
        <PropertyQrPoster {...props} qrUrl={qrUrl} ref={posterRef} />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <p className="text-xs leading-5 text-gray-600">
          This permanent QR opens the property's available To-Let units. Public
          Listings can appear in browse and search; QR Only Listings remain
          accessible through this poster.
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadQr}
          disabled={!qrUrl || downloading}
        >
          <Download />
          {downloading ? "Preparing…" : "Download PDF"}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={qrPath} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Open page
          </Link>
        </Button>
      </div>
    </aside>
  );
}
