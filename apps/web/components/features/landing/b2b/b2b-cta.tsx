"use client";

import Link from "next/link";

export function B2bCta() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#1a237e] px-6 py-16 sm:px-16 sm:py-24">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/[0.06] translate-x-[30%] -translate-y-[30%] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#00C853]/[0.08] -translate-x-[30%] translate-y-[30%] pointer-events-none" />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 mb-8">
              <span className="material-symbols-outlined text-sm text-[#69F0AE]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Limited Trial Access Available</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Ready to Digitize Your Trade Business?
            </h2>
            <p className="text-lg text-white/60 leading-relaxed mb-10">Limited trial access available for verified businesses. Apply now and start your digital trade journey today.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/b2b/register" className="inline-flex items-center gap-2 px-10 py-4 bg-white text-[#003178] font-bold rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all">
                Apply Now
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 px-10 py-4 text-white font-bold rounded-xl border-2 border-white/30 hover:bg-white/10 hover:border-white/60 hover:-translate-y-0.5 transition-all">
                Contact Our Team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
