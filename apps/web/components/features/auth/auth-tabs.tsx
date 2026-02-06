"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AuthTabs() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isSignup = pathname === "/sign-up";

  return (
    <div className="inline-flex h-auto w-full max-w-[468px] items-center justify-center gap-2 rounded-xl border border-[#8B8B8B] bg-white p-2 md:h-[72px] md:gap-4">
      <Link
        href="/login"
        className={cn(
          "flex h-12 flex-1 items-center justify-center rounded-lg px-4 py-3 text-center font-inter text-sm font-semibold leading-[160%] transition-colors md:h-[56px] md:w-[218px] md:flex-none md:px-8 md:py-[15px] md:text-base",
          isLogin
            ? "bg-[#1E62C3] text-white"
            : "bg-transparent text-black hover:bg-gray-50",
        )}
      >
        Login
      </Link>
      <Link
        href="/sign-up"
        className={cn(
          "flex h-12 flex-1 items-center justify-center rounded-lg px-4 py-3 text-center font-inter text-sm font-semibold leading-[160%] transition-colors md:h-[56px] md:w-[218px] md:flex-none md:px-8 md:py-[15px] md:text-base",
          isSignup
            ? "bg-[#1E62C3] text-white"
            : "bg-transparent text-black hover:bg-gray-50",
        )}
      >
        Register
      </Link>
    </div>
  );
}
