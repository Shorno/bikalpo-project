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
  propertyName,
  location,
}: {
  propertyCode: string;
  qrToken: string;
  propertyName: string;
  location?: string | null;
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

    const escapeXml = (value: string) =>
      value.replace(
        /[<>&'"]/g,
        (character) =>
          ({
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            "'": "&apos;",
            '"': "&quot;",
          })[character] ?? character,
      );

    const splitLine = (value: string, maximumLength = 42) => {
      const words = value.trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];

      for (const word of words) {
        const current = lines.at(-1);
        if (!current || `${current} ${word}`.length > maximumLength) {
          lines.push(word);
        } else {
          lines[lines.length - 1] = `${current} ${word}`;
        }
      }

      return (lines.length ? lines : [""]).slice(0, 2);
    };

    const qrSvg = svg.cloneNode(true) as SVGElement;
    qrSvg.setAttribute("x", "280");
    qrSvg.setAttribute("y", "570");
    qrSvg.setAttribute("width", "640");
    qrSvg.setAttribute("height", "640");
    const qrSource = new XMLSerializer().serializeToString(qrSvg);
    const propertyLines = splitLine(propertyName, 36);
    const locationLines = splitLine(
      location || "Location available on property page",
    );
    const propertyText = propertyLines
      .map(
        (line, index) =>
          `<text x="600" y="${330 + index * 60}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
      )
      .join("");
    const locationStartY = propertyLines.length > 1 ? 470 : 420;
    const locationText = locationLines
      .map(
        (line, index) =>
          `<text x="600" y="${locationStartY + index * 40}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#d1fae5">${escapeXml(line)}</text>`,
      )
      .join("");
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-label="${escapeXml(propertyName)} To-Let QR poster">
  <rect width="1200" height="1600" rx="40" fill="#ffffff"/>
  <rect x="24" y="24" width="1152" height="1552" rx="32" fill="none" stroke="#059669" stroke-width="8"/>
  <path d="M56 24h1088a32 32 0 0 1 32 32v440H24V56a32 32 0 0 1 32-32Z" fill="#059669"/>
  <text x="600" y="175" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="800" letter-spacing="8" fill="#ffffff">TO-LET</text>
  <rect x="460" y="218" width="280" height="6" rx="3" fill="#6ee7b7"/>
  ${propertyText}
  ${locationText}
  <text x="600" y="550" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="3" fill="#111827">SCAN TO VIEW</text>
  <rect x="245" y="535" width="710" height="710" rx="36" fill="#ffffff" stroke="#e5e7eb" stroke-width="5"/>
  ${qrSource}
  <text x="600" y="1325" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#6b7280">PROPERTY ID</text>
  <text x="600" y="1380" text-anchor="middle" font-family="Courier New, monospace" font-size="46" font-weight="700" fill="#111827">${escapeXml(propertyCode)}</text>
  <line x1="180" y1="1450" x2="1020" y2="1450" stroke="#e5e7eb" stroke-width="3"/>
  <text x="600" y="1515" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#6b7280">Powered by <tspan font-weight="700" fill="#059669">Bikalpo.com</tspan></text>
</svg>`;
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${propertyCode}-to-let-qr-poster.svg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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

      <div className="mt-5 overflow-hidden rounded-xl border-2 border-emerald-600 bg-white shadow-sm">
        <div className="bg-emerald-600 px-4 py-4 text-center text-white">
          <p className="text-2xl font-extrabold tracking-[0.2em]">TO-LET</p>
          <div className="mx-auto mt-2 h-0.5 w-14 bg-emerald-300" />
          <p className="mt-3 line-clamp-2 font-semibold">{propertyName}</p>
          {location ? (
            <p className="mt-1 line-clamp-2 text-xs text-emerald-100">
              {location}
            </p>
          ) : null}
        </div>

        <div className="px-4 py-5 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-gray-800">
            SCAN TO VIEW
          </p>
          <div className="mx-auto flex aspect-square max-w-44 items-center justify-center rounded-xl border border-gray-200 bg-white p-2">
            <QRCodeSVG
              id={qrId}
              value={qrUrl}
              size={168}
              level="H"
              marginSize={1}
              bgColor="#ffffff"
              fgColor="#111827"
              title={`${propertyCode} permanent To-Let QR`}
            />
          </div>
          <p className="mt-4 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Property ID
          </p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-gray-900">
            {propertyCode}
          </p>
          <div className="mx-auto mt-4 h-px w-4/5 bg-gray-200" />
          <p className="mt-3 text-xs text-gray-500">
            Powered by{" "}
            <span className="font-semibold text-emerald-600">Bikalpo.com</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <p className="text-xs leading-5 text-gray-600">
          This permanent QR opens the property's available To-Let units. Only
          active listings appear and they stay hidden from public browse and
          search.
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
