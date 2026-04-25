"use client";

const trialSteps = [
  { step: "01", title: "Apply for Trial", description: "Submit your business details for verification", icon: "app_registration", color: "#003178" },
  { step: "02", title: "Admin Approval", description: "Your business is verified by the Bikalpo team", icon: "verified_user", color: "#1565c0" },
  { step: "03", title: "30 Days Full Access", description: "Use every feature completely free for 30 days", icon: "all_inclusive", color: "#2e7d32" },
  { step: "04", title: "Trial Expiry", description: "After trial, switch to read-only mode. Reports always accessible", icon: "history", color: "#ef6c00" },
  { step: "05", title: "Subscribe to Continue", description: "Choose a plan for continued new transactions", icon: "rocket_launch", color: "#7b1fa2" },
];

export function B2bTrial() {
  return (
    <section className="py-20 sm:py-28 bg-white" id="trial">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00C853]/[0.06] border border-[#00C853]/[0.12] mb-6">
            <span className="material-symbols-outlined text-sm text-[#00C853]">credit_card_off</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#00C853]">Transparent Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Transparent <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Access Model</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">No hidden fees. No surprise charges. Start free, subscribe when ready.</p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          <div className="hidden md:block absolute left-[24px] top-[40px] bottom-[40px] w-[3px] rounded-full bg-gradient-to-b from-[#003178] via-[#2e7d32] to-[#7b1fa2]" />
          <div className="space-y-6">
            {trialSteps.map((step) => (
              <div key={step.step} className="flex gap-6 items-start">
                <div className="relative z-10 shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}DD)`, boxShadow: `0 4px 16px ${step.color}30` }}>
                    {step.step}
                  </div>
                </div>
                <div className="flex-1 p-6 rounded-xl bg-[#fafbfc] border border-black/[0.04] hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-lg" style={{ color: step.color }}>{step.icon}</span>
                    <h4 className="font-bold text-base text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>{step.title}</h4>
                  </div>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
