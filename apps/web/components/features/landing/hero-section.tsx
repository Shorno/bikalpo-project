import Link from "next/link";

export function HeroSection() {
    return (
        <section className="relative pt-24 pb-20 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                <div className="relative z-10">
                    {/* Trust badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#003178]/5 border border-[#003178]/10 text-[#003178] mb-6">
                        <span
                            className="material-symbols-outlined text-sm"
                            style={{
                                fontVariationSettings: "'FILL' 1",
                            }}
                        >
                            verified
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Trusted by 2000+ businesses
                        </span>
                    </div>

                    {/* Heading */}
                    <h1
                        className="text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Unlock Efficiency <br />
                        with{" "}
                        <span className="text-[#003178]">Bikalpo</span>
                    </h1>

                    {/* Description */}
                    <p className="text-xl text-gray-600 mb-8 max-w-xl leading-relaxed">
                        Your Ultimate Business Management Platform. Streamline
                        operations, boost sales, and scale your brand with
                        architectural precision.
                    </p>

                    {/* Bullet points */}
                    <ul className="space-y-4 mb-10">
                        <li className="flex items-center gap-3">
                            <span
                                className="material-symbols-outlined text-[#1b6d24]"
                                style={{
                                    fontVariationSettings: "'FILL' 1",
                                }}
                            >
                                check_circle
                            </span>
                            <span className="font-medium">
                                Intuitive E-commerce builder for modern brands
                            </span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span
                                className="material-symbols-outlined text-[#1b6d24]"
                                style={{
                                    fontVariationSettings: "'FILL' 1",
                                }}
                            >
                                check_circle
                            </span>
                            <span className="font-medium">
                                Advanced SR Sales management system
                            </span>
                        </li>
                    </ul>

                    {/* CTAs */}
                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/sign-up"
                            className="px-8 py-4 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.02] transition-transform"
                            style={{
                                background:
                                    "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                            }}
                        >
                            Start Free Trial
                        </Link>
                        <Link
                            href="/home/contact"
                            className="px-8 py-4 rounded-lg bg-white text-[#003178] font-bold border border-gray-200/30 hover:bg-gray-50 transition-colors"
                        >
                            Book a Meeting
                        </Link>
                    </div>
                </div>

                {/* Hero Image */}
                <div className="relative">
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#003178]/5 rounded-full blur-3xl" />
                    <div className="relative bg-gray-200 rounded-2xl p-4 shadow-2xl border border-gray-200/20 rotate-1 hover:rotate-0 transition-transform duration-500">
                        <div className="rounded-xl w-full h-80 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                                <span className="material-symbols-outlined text-6xl mb-2 block">
                                    dashboard
                                </span>
                                <p className="font-medium">
                                    Dashboard Preview
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
