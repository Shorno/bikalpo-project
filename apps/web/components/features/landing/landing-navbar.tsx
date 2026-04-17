"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Contact", href: "/contact" },
];

export function LandingNavbar() {
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
          {isPending ? (
            <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/b2b/status"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#003178] transition-colors"
              >
                Application Status
              </Link>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)" }}
                  title={userName}
                >
                  {initials}
                </div>
                <button
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/b2b/login"
                className="hidden sm:inline-flex px-6 py-2.5 text-sm font-semibold text-[#003178] border border-[#003178]/20 rounded-lg hover:bg-[#003178]/5 transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/b2b/register"
                className="hidden sm:inline-flex px-6 py-2.5 text-sm font-bold text-white rounded-lg hover:scale-[1.02] transition-all"
                style={{
                  background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                }}
              >
                Register
              </Link>
            </>
          )}
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
          {isLoggedIn ? (
            <>
              <Link
                href="/b2b/status"
                className="block text-sm font-semibold text-[#003178] py-2 mt-3 border-t border-gray-100 pt-4"
                onClick={() => setMobileOpen(false)}
              >
                Application Status
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-2 text-sm font-medium text-red-600 py-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/b2b/login"
                className="block text-sm font-semibold text-[#003178] py-2 mt-3 border-t border-gray-100 pt-4"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/b2b/register"
                className="block text-sm font-bold text-white py-2.5 px-4 rounded-lg text-center"
                style={{
                  background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                }}
                onClick={() => setMobileOpen(false)}
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
