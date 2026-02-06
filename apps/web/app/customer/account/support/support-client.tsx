"use client";

import { HelpCircle, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { ContactSection, FAQSection, TicketList } from "@/components/support";
import type { SupportTicket } from "@/db/schema/support";
import { cn } from "@/lib/utils";

interface SupportPageClientProps {
  tickets: SupportTicket[];
}

const tabs = [
  { id: "faq", label: "FAQs", icon: HelpCircle },
  { id: "tickets", label: "My Tickets", icon: MessageSquare },
  { id: "contact", label: "Contact Us", icon: Phone },
];

export function SupportPageClient({ tickets }: SupportPageClientProps) {
  const [activeTab, setActiveTab] = useState("faq");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Help & Support
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Find answers or get in touch with our support team
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-1.5 inline-flex gap-1.5 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            // biome-ignore lint/a11y/useButtonType: necessary change
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                isActive
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "tickets" && tickets.length > 0 && (
                <span
                  className={cn(
                    "ml-1 px-2 py-0.5 text-xs rounded-full font-semibold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {tickets.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === "faq" && <FAQSection />}
        {activeTab === "tickets" && <TicketList tickets={tickets} />}
        {activeTab === "contact" && <ContactSection />}
      </div>
    </div>
  );
}
