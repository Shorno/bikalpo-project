import Image from "next/image";
import Link from "next/link";

export function EnterpriseSection() {
  return (
    <section
      className="px-6 py-12 sm:py-24"
      style={{ backgroundColor: "#edeeef" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
        {/* Dashboard Preview */}
        <div className="flex-1 order-2 md:order-1 relative">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200/20 p-4">
            <Image
              alt="Bikalpo Dashboard Preview"
              className="rounded-lg w-full"
              width={800}
              height={450}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-BlmKn8khhpnolxSe4g4ESrhCqIS_GrPOqbV7eXHEon4CRHjapLx9y6PrmORPZ2-W1FFdliUStfj9p479WPahqTXGM2k30o6PaPjYeDZiMObc601ae6OPdgmDkyf_Jep0_89GGTi8FhSIPAiipA62cnqpCHxuXJm-NMubj0t_BeDTn0W6ItebUIdNfEb-fBta91177VdDdHUWDTOQcx0jw9dO_s_50kSFE6i0qd81ewxDU2BV3_oLl26X3C6ceb-OsHEhvXtUhN8"
            />
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#1b6d24] rounded-xl items-center justify-center p-6 text-white shadow-xl hidden lg:flex">
            <span className="material-symbols-outlined text-5xl">
              analytics
            </span>
          </div>
        </div>

        {/* Enterprise Text */}
        <div className="flex-1 order-1 md:order-2">
          <span className="text-[#003178] font-bold tracking-widest text-sm uppercase mb-4 block">
            Enterprise
          </span>
          <h2
            className="text-4xl font-extrabold mb-6"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Bikalpo Dashboard Preview
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Specifically designed for large-scale operations requiring real-time
            syncing across global nodes. Our enterprise solution offers
            dedicated support and custom API integrations.
          </p>
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#003178]/10 rounded-lg text-[#003178]">
                <span className="material-symbols-outlined">support_agent</span>
              </div>
              <div>
                <h4 className="font-bold text-sm">24/7 Dedicated Support</h4>
                <p className="text-sm text-gray-500">
                  Priority response for mission-critical issues.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20"
            style={{
              background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
            }}
          >
            Let&apos;s Talk
          </Link>
        </div>
      </div>
    </section>
  );
}
