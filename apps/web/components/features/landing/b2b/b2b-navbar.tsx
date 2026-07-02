"use client";

import { ArrowRight, ChevronDown, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:h-[72px]">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              B
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Bikalpo
            </span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground md:flex">
            EN
            <ChevronDown className="h-3.5 w-3.5" />
          </div>

          {isPending ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/b2b/status"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Application Status
              </Link>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  title={userName}
                >
                  {initials}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive sm:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
                <Link href="/b2b/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/b2b/register" aria-label="Register your warehouse or retail business">
                  Register
                  <ArrowRight className="hidden h-4 w-4 sm:inline" />
                </Link>
              </Button>
            </>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="space-y-1 border-t border-border bg-background px-6 py-5 lg:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 space-y-3 border-t border-border pt-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/b2b/status"
                  className="block py-2 text-sm font-semibold text-primary"
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
                  className="flex items-center gap-2 py-2 text-sm font-medium text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/b2b/login" onClick={() => setMobileOpen(false)}>
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
