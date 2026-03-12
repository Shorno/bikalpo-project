"use client";
import { ReactNode, useState } from "react";
import { Navbar } from "./navbar";

interface HomeLayoutWithSidebarProps {
  children: ReactNode;
  bannerContent?: ReactNode;
}

export function HomeLayoutWithSidebar({
  children,
  bannerContent,
}: HomeLayoutWithSidebarProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="relative">
        {/* Main Home Content */}
        <div className="w-full">{children}</div>

        {/* Banner positioned on the right side when category menu is active */}
        {bannerContent && (
          <div className="hidden lg:block fixed top-[120px] right-8 w-80 z-40">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {bannerContent}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
