"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "For Warehouse", href: "#roles" },
  { label: "For Retailers", href: "#roles" },
  { label: "About", href: "#trust" },
  { label: "Support", href: "#faq" },
];

export function B2bNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  const isLoggedIn = !!session?.user;
  const userName = session?.user?.name || "";
  const initials = userName
    ? userName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-[#003178]/[0.06]">
      <div className="max-w-7xl mx-auto px-6 h-16 md:h-[72px] flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-sm bg-gradient-to-br from-[#003178] to-[#0d47a1]">
              B
            </div>
            <span
              className="text-xl font-extrabold tracking-tight text-[#003178]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Bikalpo
            </span>
          </Link>
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-[#003178] hover:bg-[#003178]/[0.04] transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Auth + Language */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 border border-black/[0.08] cursor-pointer">
            EN
            <span className="material-symbols-outlined text-xs">
              expand_more
            </span>
          </div>

          {isPending ? (
            <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/b2b/status"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#003178] transition-colors"
              >
                Application Status
              </Link>
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-[#003178] to-[#0d47a1]"
                  title={userName}
                >
                  {initials}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/b2b/login"
                className="hidden md:inline-flex px-5 py-2.5 text-sm font-semibold rounded-lg text-[#003178] border-[1.5px] border-[#003178]/15 hover:bg-[#003178]/[0.04] hover:border-[#003178]/30 transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/b2b/register"
                aria-label="Register your warehouse or retail business"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-5 text-sm font-bold text-white rounded-lg bg-gradient-to-br from-[#003178] to-[#0d47a1] shadow-[0_4px_16px_rgba(0,49,120,0.25)] hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,49,120,0.35)] transition-all"
              >
                Register
                <span className="material-symbols-outlined text-base hidden sm:inline">
                  arrow_forward
                </span>
              </Link>
            </>
          )}

          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden px-6 py-5 space-y-1 border-t border-black/[0.06] bg-white">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block px-4 py-3 text-sm font-medium rounded-lg text-slate-600 hover:text-[#003178]"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 mt-3 space-y-3 border-t border-black/[0.06]">
            {isLoggedIn ? (
              <>
                <Link
                  href="/b2b/status"
                  className="block text-sm font-semibold text-[#003178] py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  Application Status
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-red-500 py-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/b2b/login"
                className="block text-center text-sm font-semibold py-3 rounded-lg text-[#003178] border-[1.5px] border-[#003178]/20"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
