"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  { icon: "bar_chart", label: "Daily Orders", value: 1000, suffix: "+", display: "1,000+" },
  { icon: "warehouse", label: "Active Wholesalers", value: 500, suffix: "+", display: "500+" },
  { icon: "storefront", label: "Active Retailers", value: 2000, suffix: "+", display: "2,000+" },
  { icon: "local_shipping", label: "Delivery Success", value: 95, suffix: "%", display: "95%" },
  { icon: "repeat", label: "Repeat Rate", value: 85, suffix: "%", display: "85%" },
  { icon: "star", label: "User Rating", value: 4.6, suffix: "★", display: "4.6★" },
  { icon: "account_balance_wallet", label: "Monthly Transactions", value: 0, suffix: "", display: "Growing" },
  { icon: "chat_bubble", label: "User Satisfaction", value: 0, suffix: "", display: "Excellent" },
];

const testimonials = [
  {
    quote: "Bikalpo Trade made our wholesale business fully digital. No more khata hassle!",
    name: "Mohammad Rahim",
    role: "Warehouse Owner, Barisal",
  },
  {
    quote: "Now I get orders from customers I never knew. My sales increased 40% in 3 months.",
    name: "Karim Mia",
    role: "Shop Owner, Khulna",
  },
];

function AnimatedNumber({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current * 10) / 10);
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [target, hasAnimated]);

  if (target === 0) return null;

  const formatted = target >= 1000
    ? `${Math.floor(count).toLocaleString()}`
    : Number.isInteger(target)
      ? `${Math.floor(count)}`
      : `${count.toFixed(1)}`;

  return (
    <div ref={ref} className="b2b-stat-number b2b-gradient-text">
      {formatted}
      {suffix}
    </div>
  );
}

export function B2bTrust() {
  return (
    <section
      className="b2b-section"
      id="trust"
      style={{
        background:
          "linear-gradient(180deg, #f8faff 0%, #eef2ff 50%, #f8faff 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(0,49,120,0.04)",
              border: "1px solid rgba(0,49,120,0.08)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{
                color: "#003178",
                fontVariationSettings: "'FILL' 1",
              }}
            >
              workspace_premium
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#003178" }}
            >
              Trusted Platform
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            Trusted by{" "}
            <span className="b2b-gradient-text">Growing Trade Businesses</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Real businesses. Real growth. Real impact.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="b2b-card text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: "rgba(0,49,120,0.06)",
                  color: "#003178",
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {stat.icon}
                </span>
              </div>
              {stat.value > 0 ? (
                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
              ) : (
                <div className="b2b-stat-number b2b-gradient-text text-xl">
                  {stat.display}
                </div>
              )}
              <p
                className="text-sm font-medium mt-2"
                style={{ color: "#64748b" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="b2b-card"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,49,120,0.02) 0%, rgba(0,200,83,0.02) 100%)",
                borderColor: "rgba(0,49,120,0.08)",
              }}
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className="material-symbols-outlined text-lg"
                    style={{
                      color: "#ffa726",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    star
                  </span>
                ))}
              </div>
              <p
                className="text-base mb-6 leading-relaxed"
                style={{ color: "#334155", fontStyle: "italic" }}
              >
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    background:
                      "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                  }}
                >
                  {testimonial.name[0]}
                </div>
                <div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "#0f172a" }}
                  >
                    {testimonial.name}
                  </div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-12">
          {[
            "Digitally Structured Trade Network",
            "Secure Cloud Infrastructure",
            "Bangladesh Focused Platform",
          ].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: "rgba(0,49,120,0.04)",
                border: "1px solid rgba(0,49,120,0.08)",
              }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{
                  color: "#00C853",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                verified
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "#334155" }}
              >
                {badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
