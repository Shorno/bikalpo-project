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
    qrSvg.setAttribute("x", "420");
    qrSvg.setAttribute("y", "590");
    qrSvg.setAttribute("width", "360");
    qrSvg.setAttribute("height", "360");
    const qrSource = new XMLSerializer().serializeToString(qrSvg);
    const propertyLines = splitLine(propertyName, 36);
    const locationLines = splitLine(
      location || "Location available on property page",
    );
    const propertyText = propertyLines
      .map(
        (line, index) =>
          `<text x="600" y="${430 + index * 48}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" fill="#101010">${escapeXml(line)}</text>`,
      )
      .join("");
    const locationStartY = propertyLines.length > 1 ? 535 : 490;
    const locationText = locationLines
      .map(
        (line, index) =>
          `<text x="600" y="${locationStartY + index * 32}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#111827">${escapeXml(line)}</text>`,
      )
      .join("");
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(propertyName)} To-Let QR poster">
  <rect width="1200" height="1200" fill="#ffffff"/>
  <rect x="14" y="14" width="1172" height="1172" fill="none" stroke="#123f92" stroke-width="14"/>
  <text x="600" y="125" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="800" fill="#123f92">B</text>
  <circle cx="520" cy="107" r="13" fill="#123f92"/>
  <line x1="535" y1="107" x2="665" y2="107" stroke="#f97316" stroke-width="11" stroke-linecap="round"/>
  <rect x="580" y="98" width="48" height="18" rx="9" fill="#f97316"/>
  <circle cx="680" cy="107" r="13" fill="#f97316"/>
  <text x="600" y="190" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" letter-spacing="14" fill="#123f92">BIKALPO</text>
  <line x1="140" y1="310" x2="245" y2="310" stroke="#f97316" stroke-width="8"/>
  <line x1="955" y1="310" x2="1060" y2="310" stroke="#f97316" stroke-width="8"/>
  <text x="600" y="350" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="128" font-weight="900" letter-spacing="4" fill="#123f92">TO-LET</text>
  <line x1="370" y1="375" x2="570" y2="375" stroke="#f97316" stroke-width="5"/>
  <circle cx="600" cy="375" r="9" fill="#f97316"/>
  <line x1="630" y1="375" x2="830" y2="375" stroke="#f97316" stroke-width="5"/>
  ${propertyText}
  ${locationText}
  <rect x="400" y="568" width="400" height="400" rx="22" fill="#ffffff" stroke="#f97316" stroke-width="5"/>
  <rect x="485" y="548" width="230" height="48" rx="10" fill="#123f92"/>
  <text x="600" y="581" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" fill="#ffffff">Scan To View</text>
  ${qrSource}
  <rect x="355" y="985" width="490" height="66" rx="14" fill="#123f92"/>
  <text x="600" y="1030" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Property ID : <tspan fill="#f97316">${escapeXml(propertyCode)}</tspan></text>
  <text x="600" y="1100" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#123f92">Powered by <tspan fill="#f97316">Bikalpo.com</tspan></text>
  <line x1="130" y1="1135" x2="570" y2="1135" stroke="#f97316" stroke-width="3"/>
  <circle cx="600" cy="1135" r="7" fill="#f97316"/>
  <line x1="630" y1="1135" x2="1070" y2="1135" stroke="#f97316" stroke-width="3"/>
  <text x="600" y="1170" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#123f92">আপনার সম্পত্তি ভাড়ার জন্য <tspan fill="#f97316">Bikalpo</tspan>-তে তালিকাভুক্ত করুন</text>
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

      <div
        data-property-qr-poster
        className="mt-5 border-[5px] border-[#123f92] bg-white px-4 py-5 text-center sm:px-5"
      >
        <div className="mx-auto w-28 text-[#123f92]">
          <svg viewBox="0 0 180 112" role="img" aria-label="Bikalpo">
            <text
              x="90"
              y="82"
              textAnchor="middle"
              fontSize="92"
              fontWeight="800"
              fill="currentColor"
            >
              B
            </text>
            <circle cx="26" cy="65" r="9" fill="currentColor" />
            <path
              d="M38 65h104"
              stroke="#f97316"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <rect x="76" y="58" width="34" height="14" rx="7" fill="#f97316" />
            <circle cx="154" cy="65" r="9" fill="#f97316" />
          </svg>
        </div>
        <p className="-mt-2 text-sm font-extrabold tracking-[0.38em] text-[#123f92]">
          BIKALPO
        </p>

        <div className="mt-5 flex items-center gap-2 text-[#f97316]">
          <span className="h-1 flex-1 bg-current" />
          <p className="whitespace-nowrap text-3xl font-black tracking-tight text-[#123f92] sm:text-4xl">
            TO-LET
          </p>
          <span className="h-1 flex-1 bg-current" />
        </div>
        <div className="mx-auto mt-1 flex max-w-52 items-center gap-2 text-[#f97316]">
          <span className="h-0.5 flex-1 bg-current" />
          <span className="size-2 rounded-full bg-current" />
          <span className="h-0.5 flex-1 bg-current" />
        </div>

        <p className="mt-5 line-clamp-2 text-xl font-extrabold text-gray-950">
          {propertyName}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-800">
          {location || "Location available on property page"}
        </p>

        <div className="relative mx-auto mt-7 w-fit rounded-xl border-2 border-[#f97316] bg-white p-3 pt-5">
          <p className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#123f92] px-5 py-1.5 text-sm font-bold text-white">
            Scan To View
          </p>
          <div className="flex aspect-square w-44 items-center justify-center bg-white">
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
        </div>

        <p className="mx-auto mt-4 w-full whitespace-nowrap rounded-lg bg-[#123f92] px-2 py-2 text-[10px] font-bold text-white sm:text-xs">
          Property ID :{" "}
          <span className="font-mono tabular-nums text-[#fb7a1c]">
            {propertyCode}
          </span>
        </p>
        <p className="mt-4 text-sm font-bold text-[#123f92]">
          Powered by <span className="text-[#f97316]">Bikalpo.com</span>
        </p>
        <div className="mx-auto mt-3 flex max-w-64 items-center gap-2 text-[#f97316]">
          <span className="h-px flex-1 bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="h-px flex-1 bg-current" />
        </div>
        <p className="mx-auto mt-2 max-w-72 text-xs font-semibold leading-5 text-[#123f92]">
          আপনার সম্পত্তি ভাড়ার জন্য <span className="text-[#f97316]">Bikalpo</span>-তে
          তালিকাভুক্ত করুন
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <p className="text-xs leading-5 text-gray-600">
          This permanent QR opens the property's available To-Let units. Public
          Listings can appear in browse and search; QR Only Listings remain
          accessible through this poster.
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
