import Image from "next/image";
import Link from "next/link";

const catalogLinks = [
  { href: "/products", label: "All products" },
  { href: "/offers", label: "Offers" },
  { href: "/stores", label: "Stores" },
  { href: "/b2b", label: "For business" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faqs", label: "FAQs" },
  { href: "/verified-customers", label: "Verified customers" },
];

const policyLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-[oklch(0.18_0.018_260)] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
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
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
              A shared product catalog for customer shopping and business supply
              workflows.
            </p>
          </div>

          <FooterLinkGroup title="Catalog" links={catalogLinks} />
          <FooterLinkGroup title="Company" links={companyLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bikalpo. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {policyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-slate-200 hover:underline hover:underline-offset-4"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-slate-400 hover:text-slate-100 hover:underline hover:underline-offset-4"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
