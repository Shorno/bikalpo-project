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
    <footer className="bg-gradient-to-b from-[#0a0e27] to-[#060920] pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-sm bg-gradient-to-br from-[#1565c0] to-[#42a5f5]">
                B
              </div>
              <span
                className="text-xl font-extrabold tracking-tight text-white"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Bikalpo Trade
              </span>
            </div>
            <p className="text-sm text-white/40 mb-6 max-w-xs leading-relaxed">
              Bangladesh&apos;s digital wholesale trade network. Connecting warehouses, shops, and restaurants in one powerful platform.
            </p>
            <div className="text-sm text-white/35 space-y-1.5 mb-6">
              <p>38, Bangla Bazar, Barisal, Bangladesh</p>
              <p>Mob: +88 01XXXXXXXXX</p>
              <p>Email: support@bikalpo.com</p>
            </div>
            <div className="flex gap-3">
              {["language", "alternate_email", "forum"].map((icon) => (
                <div
                  key={icon}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-[#003178]/50 hover:text-white cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                </div>
              ))}
            </div>
          </div>

          {/* For Business */}
          <div>
            <h5
              className="font-bold mb-6 text-sm text-white/90"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              For Business
            </h5>
            <ul className="space-y-3">
              {footerLinks.forBusiness.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white/80 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h5
              className="font-bold mb-6 text-sm text-white/90"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Resources
            </h5>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white/80 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5
              className="font-bold mb-6 text-sm text-white/90"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Company
            </h5>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white/80 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/30">© 2026 Bikalpo. All Rights Reserved. Bangladesh.</p>
          <div className="flex gap-6">
            <span className="text-xs text-white/30 cursor-pointer hover:text-white/60 transition-colors">Terms of Service</span>
            <span className="text-xs text-white/30 cursor-pointer hover:text-white/60 transition-colors">Privacy Policy</span>
            <span className="text-xs text-white/30 cursor-pointer hover:text-white/60 transition-colors">Cookie Settings</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
