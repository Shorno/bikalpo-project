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
    <footer
      style={{
        background: "linear-gradient(180deg, #0a0e27 0%, #060920 100%)",
        paddingTop: "80px",
        paddingBottom: "40px",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-sm"
                style={{
                  background:
                    "linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)",
                }}
              >
                B
              </div>
              <span
                className="text-xl font-extrabold tracking-tight"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  color: "#ffffff",
                }}
              >
                Bikalpo Trade
              </span>
            </div>
            <p
              className="text-sm mb-6 max-w-xs leading-relaxed"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Bangladesh&apos;s digital wholesale trade network. Connecting
              warehouses, shops, and restaurants in one powerful platform.
            </p>
            <div
              className="text-sm space-y-1.5 mb-6"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              <p>38, Bangla Bazar, Barisal, Bangladesh</p>
              <p>Mob: +88 01XXXXXXXXX</p>
              <p>Email: support@bikalpo.com</p>
            </div>
            {/* Social icons */}
            <div className="flex gap-3">
              {["language", "alternate_email", "forum"].map((icon) => (
                <div
                  key={icon}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.background = "rgba(0,49,120,0.5)";
                    target.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.background = "rgba(255,255,255,0.06)";
                    target.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  <span className="material-symbols-outlined text-sm">
                    {icon}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* For Business */}
          <div>
            <h5
              className="font-bold mb-6 text-sm"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              For Business
            </h5>
            <ul className="space-y-3">
              {footerLinks.forBusiness.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.4)";
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h5
              className="font-bold mb-6 text-sm"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Resources
            </h5>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.4)";
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5
              className="font-bold mb-6 text-sm"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Company
            </h5>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.8)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(255,255,255,0.4)";
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div
          className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            © 2026 Bikalpo. All Rights Reserved. Bangladesh.
          </p>
          <div className="flex gap-6">
            <span
              className="text-xs cursor-pointer transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Terms of Service
            </span>
            <span
              className="text-xs cursor-pointer transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Privacy Policy
            </span>
            <span
              className="text-xs cursor-pointer transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Cookie Settings
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
