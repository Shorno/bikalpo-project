"use client";

import {
  Clock3,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LandingFooter } from "@/components/features/landing/landing-footer";

const coverage = [
  ["Dhaka", "320+"],
  ["Chattogram", "185+"],
  ["Gazipur", "110+"],
  ["Narayanganj", "95+"],
  ["Cumilla", "75+"],
  ["Khulna", "60+"],
  ["Rajshahi", "55+"],
  ["Sylhet", "42+"],
  ["Rangpur", "38+"],
  ["Barishal", "30+"],
] as const;

const toLetAboutLinks = [
  { href: "/about", label: "About Us" },
  { href: "/about", label: "Our Ecosystem" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/terms#seller-policy", label: "Seller Policy" },
  { href: "/terms#buyer-policy", label: "Buyer Policy" },
  { href: "/verified-customers", label: "Trust & Safety" },
  { href: "/faqs", label: "Help Center" },
] as const;

export function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith("/to-let")) {
    return <ToLetFooter />;
  }

  return <LandingFooter />;
}

function ToLetFooter() {
  return (
    <footer className="border-t border-slate-800 bg-[oklch(0.18_0.018_260)] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-[1.45fr_0.8fr_0.8fr_0.95fr]">
          <div>
            <FooterLogo />
            <h2 className="mt-5 text-sm font-semibold text-slate-100">
              Verified Multi-Vendor Ecosystem
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              Manufacturer · Importer · Distributor · Wholesaler · Retailer ·
              Property Owner · Service Provider · Agency · Developer — একসাথে
              একটি Verified Digital Commerce Platform-এ।
            </p>
            <p className="mt-6 text-xs font-semibold tracking-[0.12em] text-slate-200 uppercase">
              Follow us
            </p>
            <div
              role="group"
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Social media"
            >
              {[
                ["Facebook", Facebook],
                ["Instagram", Instagram],
                ["LinkedIn", Linkedin],
                ["YouTube", Youtube],
              ].map(([label, Icon]) => (
                <span
                  key={label as string}
                  title={`${label} link will be added after the official profile is confirmed`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-300"
                >
                  <Icon className="size-4" /> {label as string}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Seller Coverage
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-1">
              {coverage.map(([area, count]) => (
                <li
                  key={area}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-slate-400">{area}</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <FooterLinkGroup title="About Bikalpo" links={toLetAboutLinks} />

          <div>
            <h2 className="text-sm font-semibold text-slate-100">Contact Us</h2>
            <address className="mt-4 space-y-4 text-sm not-italic text-slate-400">
              <a
                href="tel:+8801234567890"
                className="flex min-h-11 items-center gap-3 hover:text-slate-100"
              >
                <Phone className="size-4 shrink-0 text-blue-300" />
                +880 1234-567890
              </a>
              <a
                href="mailto:support@bikalpo.com"
                className="flex min-h-11 items-center gap-3 hover:text-slate-100"
              >
                <Mail className="size-4 shrink-0 text-blue-300" />
                support@bikalpo.com
              </a>
              <a
                href="https://www.bikalpo.com"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-3 hover:text-slate-100"
              >
                <Globe2 className="size-4 shrink-0 text-blue-300" />
                www.bikalpo.com
              </a>
              <p className="flex items-start gap-3 leading-6">
                <Clock3 className="mt-1 size-4 shrink-0 text-blue-300" />
                Sat–Thu
                <br />
                9:00 AM – 8:00 PM
              </p>
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p>© {new Date().getFullYear()} Bikalpo. All Rights Reserved.</p>
            <p className="mt-1">
              Bangladesh&apos;s Verified Multi-Vendor Digital Commerce
              Ecosystem.
            </p>
          </div>
          <p className="text-slate-400">Powered by Bikalpo Technology</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <Link
      href="/"
      aria-label="Bikalpo home"
      className="inline-flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      <Image
        src="/logos/site-logo-white.svg"
        alt="Bikalpo"
        width={120}
        height={44}
        className="object-contain"
      />
    </Link>
  );
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center text-slate-400 hover:text-slate-100 hover:underline hover:underline-offset-4"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
