"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Contact", href: "/contact" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/10">
      <div className="max-w-7xl mx-auto px-6 h-14 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link href="/">
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "#003178",
              }}
            >
              Bikalpo
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-[#003178] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-500 text-xl">
              language
            </span>
            <span className="text-sm font-medium text-gray-600">EN</span>
          </div>
          <Link
            href="/login"
            className="hidden sm:inline-flex px-6 py-2.5 text-sm font-semibold text-[#003178] border border-[#003178]/20 rounded-lg hover:bg-[#003178]/5 transition-all"
          >
            Sign In
          </Link>
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block text-sm font-medium text-gray-600 hover:text-[#003178] py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="block text-sm font-semibold text-[#003178] py-2 mt-3 border-t border-gray-100 pt-4"
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
        </div>
      )}
    </nav>
  );
}
