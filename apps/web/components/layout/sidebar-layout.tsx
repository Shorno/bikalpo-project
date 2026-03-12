"use client";
import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";

interface SidebarLayoutProps {
  children: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - hidden on mobile, fixed on desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-screen md:ml-64">
        {/* Navbar */}
        <Navbar />

        {/* Page content with proper spacing for fixed navbar */}
        <main className="pt-[120px] md:pt-[104px] min-h-screen">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
