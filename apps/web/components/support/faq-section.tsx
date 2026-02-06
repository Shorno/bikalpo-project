"use client";

import {
  ChevronDown,
  RotateCcw,
  Shield,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { faqData } from "@/constants/faq-data";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  ShoppingCart,
  Truck,
  RotateCcw,
  Shield,
};

export function FAQSection() {
  const [openCategory, setOpenCategory] = useState<string | null>(
    faqData[0]?.category || null,
  );
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {faqData.map((category) => {
        const Icon = iconMap[category.icon] || ShoppingCart;
        const isCategoryOpen = openCategory === category.category;

        return (
          <div
            key={category.category}
            className="rounded-lg border border-gray-200 overflow-hidden transition-all hover:shadow-md"
          >
            {/* Category Header */}
            <Button
              onClick={() =>
                setOpenCategory(isCategoryOpen ? null : category.category)
              }
              variant="ghost"
              className={cn(
                "w-full flex items-center justify-between p-4 text-left transition-colors",
                isCategoryOpen
                  ? "bg-emerald-50 hover:bg-emerald-100"
                  : "bg-white hover:bg-gray-50",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isCategoryOpen ? "bg-emerald-100" : "bg-emerald-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isCategoryOpen ? "text-emerald-600" : "text-emerald-500",
                    )}
                  />
                </div>
                <span className="font-semibold text-gray-900">
                  {category.category}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform",
                  isCategoryOpen && "rotate-180 text-emerald-600",
                )}
              />
            </Button>

            {/* Questions */}
            {isCategoryOpen && (
              <div className="border-t border-gray-100 bg-gray-50/30">
                {category.faqs.map((faq, index) => {
                  const isOpen =
                    openQuestion === `${category.category}-${index}`;
                  return (
                    <div
                      key={index}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <Button
                        onClick={() =>
                          setOpenQuestion(
                            isOpen ? null : `${category.category}-${index}`,
                          )
                        }
                        variant="ghost"
                        className="w-full flex items-center justify-between p-4 pl-14 text-left hover:bg-white transition-colors"
                      >
                        <span
                          className={cn(
                            "pr-4 font-medium",
                            isOpen ? "text-gray-900" : "text-gray-700",
                          )}
                        >
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-transform shrink-0",
                            isOpen && "rotate-180 text-emerald-600",
                          )}
                        />
                      </Button>
                      {isOpen && (
                        <div className="px-14 pb-4 text-gray-600 text-sm leading-relaxed bg-white">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
