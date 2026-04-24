const trialSteps = [
  {
    step: "01",
    title: "Apply for Trial",
    description: "Submit your business details for verification",
    icon: "app_registration",
    color: "#003178",
  },
  {
    step: "02",
    title: "Admin Approval",
    description: "Your business is verified by the Bikalpo team",
    icon: "verified_user",
    color: "#1565c0",
  },
  {
    step: "03",
    title: "30 Days Full Access",
    description: "Use every feature completely free for 30 days",
    icon: "all_inclusive",
    color: "#2e7d32",
  },
  {
    step: "04",
    title: "Trial Expiry",
    description: "After trial, switch to read-only mode. Reports always accessible",
    icon: "history",
    color: "#ef6c00",
  },
  {
    step: "05",
    title: "Subscribe to Continue",
    description: "Choose a plan for continued new transactions",
    icon: "rocket_launch",
    color: "#7b1fa2",
  },
];

export function B2bTrial() {
  return (
    <section className="b2b-section b2b-section-white" id="trial">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(0,200,83,0.06)",
              border: "1px solid rgba(0,200,83,0.12)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#00C853" }}
            >
              credit_card_off
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#00C853" }}
            >
              Transparent Pricing
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            Transparent{" "}
            <span className="b2b-gradient-text">Access Model</span>
          </h2>
          <p className="b2b-subheading text-lg">
            No hidden fees. No surprise charges. Start free, subscribe when
            ready.
          </p>
        </div>

        {/* Timeline */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Vertical connector line (desktop) */}
            <div
              className="hidden md:block absolute left-[24px] top-[40px] bottom-[40px] w-[3px] rounded-full"
              style={{
                background:
                  "linear-gradient(180deg, #003178 0%, #2e7d32 50%, #7b1fa2 100%)",
              }}
            />

            <div className="space-y-6">
              {trialSteps.map((step, index) => (
                <div
                  key={step.step}
                  className="flex gap-6 items-start"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Step number circle */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${step.color} 0%, ${step.color}DD 100%)`,
                        boxShadow: `0 4px 16px ${step.color}30`,
                      }}
                    >
                      {step.step}
                    </div>
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 p-6 rounded-xl transition-all hover:shadow-md"
                    style={{
                      background: "#fafbfc",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="material-symbols-outlined text-lg"
                        style={{ color: step.color }}
                      >
                        {step.icon}
                      </span>
                      <h4
                        className="font-bold text-base"
                        style={{
                          fontFamily: "'Manrope', sans-serif",
                          color: "#0f172a",
                        }}
                      >
                        {step.title}
                      </h4>
                    </div>
                    <p className="text-sm" style={{ color: "#64748b" }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
