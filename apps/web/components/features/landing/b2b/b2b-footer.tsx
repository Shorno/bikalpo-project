"use client";

import Link from "next/link";

const footerLinks = {
  forBusiness: [
    { label: "For Warehouse", href: "#roles" },
    { label: "For Shop & Restaurant", href: "#roles" },
    { label: "Pricing", href: "#trial" },
    { label: "How It Works", href: "#how-it-works" },
  ],
  resources: [
    { label: "Blog", href: "#" },
    { label: "Help Center", href: "#faq" },
    { label: "Contact Support", href: "/contact" },
    { label: "API Documentation", href: "#" },
  ],
  company: [
    { label: "About Us", href: "#" },
    { label: "Terms & Conditions", href: "#" },
    { label: "Privacy Policy", href: "#" },
    { label: "Refund Policy", href: "#" },
  ],
};

export function B2bFooter() {
  return (
    <footer className="border-t border-border bg-card pt-16 pb-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 grid grid-cols-2 gap-12 lg:grid-cols-5">
          <div className="col-span-2">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                B
              </div>
              <span className="text-xl font-semibold tracking-tight text-foreground">
                Bikalpo Trade
              </span>
            </div>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Bangladesh&apos;s digital wholesale trade network. Connecting warehouses, shops, and restaurants in one powerful platform.
            </p>
            <div className="mb-6 space-y-1.5 text-sm text-muted-foreground">
              <p>38, Bangla Bazar, Barisal, Bangladesh</p>
              <p>Mob: +88 01XXXXXXXXX</p>
              <p>Email: support@bikalpo.com</p>
            </div>
          </div>

          <div>
            <h5 className="mb-6 text-sm font-semibold text-foreground">For Business</h5>
            <ul className="space-y-3">
              {footerLinks.forBusiness.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="mb-6 text-sm font-semibold text-foreground">Resources</h5>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="mb-6 text-sm font-semibold text-foreground">Company</h5>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">© 2026 Bikalpo. All Rights Reserved. Bangladesh.</p>
          <div className="flex gap-6">
            <span className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">Terms of Service</span>
            <span className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">Privacy Policy</span>
            <span className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">Cookie Settings</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
