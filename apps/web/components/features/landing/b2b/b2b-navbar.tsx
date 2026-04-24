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
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,49,120,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 md:h-[72px] flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-sm"
              style={{
                background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
              }}
            >
              B
            </div>
            <span
              className="text-xl font-extrabold tracking-tight"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "#003178",
              }}
            >
              Bikalpo
            </span>
          </Link>
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                style={{ color: "#475569" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#003178";
                  e.currentTarget.style.backgroundColor = "rgba(0,49,120,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#475569";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Auth + Language */}
        <div className="flex items-center gap-3">
          {/* Language toggle placeholder */}
          <div
            className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              color: "#64748b",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            EN
            <span className="material-symbols-outlined text-xs">
              expand_more
            </span>
          </div>

          {isPending ? (
            <div
              className="w-9 h-9 rounded-full animate-pulse"
              style={{ background: "#e2e8f0" }}
            />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/b2b/status"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: "#475569" }}
              >
                Application Status
              </Link>
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    background:
                      "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                  }}
                  title={userName}
                >
                  {initials}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: "#94a3b8" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#ef4444")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#94a3b8")
                  }
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/b2b/login"
                className="hidden sm:inline-flex px-5 py-2.5 text-sm font-semibold rounded-lg transition-all"
                style={{
                  color: "#003178",
                  border: "1.5px solid rgba(0,49,120,0.15)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(0,49,120,0.04)";
                  e.currentTarget.style.borderColor = "rgba(0,49,120,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "rgba(0,49,120,0.15)";
                }}
              >
                Sign In
              </Link>
              <Link
                href="/b2b/register"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                  boxShadow: "0 4px 16px rgba(0,49,120,0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 24px rgba(0,49,120,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(0,49,120,0.25)";
                }}
              >
                Apply Now
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </Link>
            </>
          )}

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg"
            style={{ color: "#475569" }}
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
        <div
          className="lg:hidden px-6 py-5 space-y-1"
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            background: "#ffffff",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block px-4 py-3 text-sm font-medium rounded-lg"
              style={{ color: "#475569" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="pt-4 mt-3 space-y-3"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
          >
            {isLoggedIn ? (
              <>
                <Link
                  href="/b2b/status"
                  className="block text-sm font-semibold py-2"
                  style={{ color: "#003178" }}
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
                  className="flex items-center gap-2 text-sm font-medium py-2"
                  style={{ color: "#ef4444" }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/b2b/login"
                  className="block text-center text-sm font-semibold py-3 rounded-lg"
                  style={{
                    color: "#003178",
                    border: "1.5px solid rgba(0,49,120,0.2)",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/b2b/register"
                  className="block text-center text-sm font-bold text-white py-3 rounded-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  Apply Now
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
