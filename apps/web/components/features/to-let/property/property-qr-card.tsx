"use client";

import { Download, ExternalLink, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";

function configuredQrUrl(qrToken: string) {
  const origin = process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL?.replace(/\/$/, "");
  return origin ? `${origin}/to-let/qr/${qrToken}` : `/to-let/qr/${qrToken}`;
}

export function PropertyQrCard({
  propertyCode,
  qrToken,
}: {
  propertyCode: string;
  qrToken: string;
}) {
  const reactId = useId();
  const qrId = `property-qr-${reactId.replace(/:/g, "")}`;
  const [qrUrl, setQrUrl] = useState(() => configuredQrUrl(qrToken));

  useEffect(() => {
    if (qrUrl.startsWith("/")) {
      setQrUrl(`${window.location.origin}${qrUrl}`);
    }
  }, [qrUrl]);

  const downloadQr = () => {
    const svg = document.getElementById(qrId);
    if (!(svg instanceof SVGElement)) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${propertyCode}-permanent-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
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

      <div className="mt-5 flex aspect-square max-h-52 items-center justify-center rounded-lg border border-gray-200 bg-white p-3">
        <QRCodeSVG
          id={qrId}
          value={qrUrl}
          size={184}
          level="H"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#111827"
          title={`${propertyCode} permanent To-Let QR`}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <p className="text-xs leading-5 text-gray-600">
          This permanent QR always opens the Property QR page. Active Public and
          QR Only listings appear there automatically.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={downloadQr}>
          <Download /> Download
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/to-let/qr/${qrToken}`} target="_blank">
            <ExternalLink /> Open page
          </Link>
        </Button>
      </div>
    </aside>
  );
}
