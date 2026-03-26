"use client";

import { useEffect } from "react";
import { PhoneAuthFlow } from "./phone-auth-flow";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as an inline card (no backdrop/overlay) for page embedding */
  embedded?: boolean;
}

export function AuthModal({ isOpen, onClose, embedded = false }: AuthModalProps) {
  // Lock body scroll when modal is open (only for overlay mode)
  useEffect(() => {
    if (!embedded && isOpen) {
      document.body.style.overflow = "hidden";
    } else if (!embedded) {
      document.body.style.overflow = "";
    }
    return () => {
      if (!embedded) document.body.style.overflow = "";
    };
  }, [isOpen, embedded]);

  const handleComplete = () => {
    onClose();
    if (!embedded) window.location.reload();
  };

  if (!isOpen) return null;

  // ── Embedded mode: plain card, no overlay ──
  if (embedded) {
    return (
      <div className="relative flex w-full max-w-[860px] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <PromoBanner />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col justify-center px-8 py-10 md:px-12">
            <PhoneAuthFlow onComplete={handleComplete} />
          </div>
        </div>
      </div>
    );
  }

  // ── Overlay mode: full modal with backdrop ──
  return (
    <div className="fixed inset-0 z-[100]" style={{ animation: "authFadeIn 0.2s ease-out" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative flex w-full max-w-[860px] bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: "authSlideUp 0.3s ease-out", maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <PromoBanner />

          <div className="flex-1 flex flex-col min-w-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            </button>

            <div className="flex-1 flex flex-col justify-center px-8 py-10 md:px-12">
              <PhoneAuthFlow onComplete={handleComplete} />
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes authFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes authScaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}

/* ── Left Promo Panel ── */
function PromoBanner() {
  return (
    <div className="hidden md:flex flex-col justify-between w-[380px] flex-shrink-0 bg-[#0d1b3e] p-8 text-white relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#1565c0]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-[#1565c0]/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <h2 className="text-3xl font-extrabold tracking-tight leading-tight mb-3">Bikalpo</h2>
        <p className="text-blue-200/80 text-sm leading-relaxed">
          Your one-stop shop for everything you need. Fresh groceries, daily essentials, delivered to your door.
        </p>
      </div>

      <div className="relative z-10 space-y-5">
        <div className="space-y-3">
          <FeatureItem icon={<BoltIcon />} text="Fast delivery in your area" />
          <FeatureItem icon={<HeartIcon />} text="Best prices guaranteed" />
          <FeatureItem icon={<ShieldIcon />} text="Safe & secure payments" />
        </div>

        {/* Trust badge */}
        <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 text-sm">★★★★★</span>
            <span className="text-white/60 text-xs">4.8 rating</span>
          </div>
          <p className="text-xs text-blue-200/60">Trusted by thousands of happy customers</p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm text-blue-100">{text}</span>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
