import {
  IconBrandAndroid,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandInstagram,
} from "@tabler/icons-react";
import { ArrowUpRight, Clock3, Globe2, Mail, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./landing-footer.module.css";
import { SellerLocationLinks } from "./seller-directory";

const roles = [
  "Manufacturer",
  "Importer",
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Property Owner",
];
const aboutLinks = [
  { label: "About Us", href: "/about" },
  { label: "Our Ecosystem", href: "/ecosystem" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Trust & Safety", href: "/trust-safety" },
  { label: "Help Center", href: "/help-center" },
];
const linkStyle =
  "inline-flex min-h-11 lg:min-h-8 items-center gap-2 text-sm text-[var(--footer-ink)] hover:text-[var(--footer-brand)] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--footer-brand)]";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid items-start gap-x-12 gap-y-9 md:grid-cols-2 lg:grid-cols-[1.15fr_0.9fr_1fr]">
          <div className="md:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="Bikalpo home"
              className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight text-[var(--footer-brand)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--footer-brand)]"
            >
              <Image
                src="/logos/bikalpo-logo.jpg"
                alt=""
                width={1080}
                height={1316}
                sizes="48px"
                className="size-12 rounded-md object-cover"
              />
              <span>Bikalpo</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--footer-ink)]">
              Multi-channel digital e-commerce
            </p>
            <ul
              aria-label="Platform participants"
              className="mt-5 flex max-w-xs flex-wrap gap-x-2 gap-y-1"
            >
              {roles.map((role) => (
                <li
                  key={role}
                  className="text-sm leading-6 after:ml-2 after:text-[var(--footer-muted)] after:content-['·'] last:after:content-none"
                >
                  {role}
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-sm font-semibold text-[var(--footer-brand)]">
              Follow us
            </h2>
            <div className="mt-2 flex gap-2">
              {[
                { label: "Facebook", Icon: IconBrandFacebook },
                { label: "Instagram", Icon: IconBrandInstagram },
              ].map(({ label, Icon }) => (
                <span
                  key={label}
                  role="img"
                  aria-label={`${label} — link coming soon`}
                  title={`${label} — link coming soon`}
                  className="inline-flex size-11 items-center justify-center rounded-md border border-[var(--footer-line)] bg-white/40 text-[var(--footer-brand)]"
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--footer-muted)]">
              Social links coming soon
            </p>
          </div>

          <div>
            <SellerLocationLinks />
            <h2 className="mt-6 text-sm font-semibold text-[var(--footer-brand)]">
              Apps
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Android", Icon: IconBrandAndroid },
                { label: "Apple", Icon: IconBrandApple },
              ].map(({ label, Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2.5 rounded-md border border-[var(--footer-line)] bg-white/40 px-3 py-2 text-sm"
                  title={`${label} app — coming soon`}
                >
                  <Icon className="size-6" aria-hidden="true" />
                  <span>
                    {label}
                    <span className="block text-xs text-[var(--footer-muted)]">
                      Coming soon
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <nav aria-labelledby="footer-about">
              <h2
                id="footer-about"
                className="text-sm font-semibold text-[var(--footer-brand)]"
              >
                About Bikalpo
              </h2>
              <ul className="mt-2">
                {aboutLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkStyle}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <h2 className="mt-5">
              <Link
                href="/contact"
                className={`${linkStyle} font-semibold text-[var(--footer-brand)]`}
              >
                Contact us
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </h2>
            <address className="mt-1 space-y-2 text-sm not-italic">
              <p className="flex items-center gap-3">
                <Phone
                  className="size-4 shrink-0 text-[var(--footer-brand)]"
                  aria-hidden="true"
                />
                +880 1XXX-XXXXXX
              </p>
              <p className="flex items-center gap-3">
                <Mail
                  className="size-4 shrink-0 text-[var(--footer-brand)]"
                  aria-hidden="true"
                />
                <span className="break-all">support@bikalpo.com</span>
              </p>
              <p className="flex items-center gap-3">
                <Globe2
                  className="size-4 shrink-0 text-[var(--footer-brand)]"
                  aria-hidden="true"
                />
                <span className="break-all">bikalpo.com</span>
              </p>
              <p className="flex items-start gap-3 leading-6">
                <Clock3
                  className="mt-1 size-4 shrink-0 text-[var(--footer-brand)]"
                  aria-hidden="true"
                />
                Sat–Thu | 9:00 AM – 8:00 PM
              </p>
            </address>
            <p className="mt-3 text-xs text-[var(--footer-muted)]">
              Contact details are provisional.
            </p>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-6 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Bikalpo. All Rights Reserved.</p>
          <p className="text-blue-100">
            Bangladesh&apos;s Multi-Vendor Digital Commerce Ecosystem.
          </p>
        </div>
      </div>
    </footer>
  );
}
