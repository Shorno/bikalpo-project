import Link from "next/link";

export function TrialCta() {
    return (
        <section className="px-6 md:px-12 pb-24">
            <div className="max-w-7xl mx-auto relative rounded-3xl overflow-hidden bg-[#003178] p-12 md:p-24 text-center">
                {/* Background Decoration */}
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="w-full h-full object-cover grayscale brightness-50"
                        alt="Dashboard background"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDy3Egyu8bX5ErVmkez1DTraQxdIolGWkEOahYpWvYLuMc-YBbwuJFXJsJKll4X18r1rxax79n-2q7DePuMZgvHBN0oTPrzU5E3KtEd7OmktCrokulx5zXsUhDZbit7vbkrzQ-QDT2_8rCxiIE7_KnxpDMNN6OKi8D4U_B9R_YCSoITbukYEDPbaW6t59PU81ScK4jDxDzhBqQUsbwa_CxseNXTcXI0bXmopDQDHL53yYmzJYAVS9bFlmTpMW1SJf7OZitu-Fjy61E"
                    />
                </div>
                <div className="relative z-10 max-w-2xl mx-auto">
                    <h2
                        className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Start Your 14-Days Free Trial Today
                    </h2>
                    <p className="text-blue-200 mb-10 text-lg">
                        No credit card required. Cancel anytime. Join over
                        2,000+ businesses scaling with Bikalpo.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/sign-up"
                            className="w-full sm:w-auto px-8 py-4 bg-white text-[#003178] font-bold rounded-lg shadow-xl hover:bg-gray-50 transition-colors"
                        >
                            Start Free Trial
                        </Link>
                        <Link
                            href="/contact"
                            className="w-full sm:w-auto px-8 py-4 bg-transparent text-white border border-white/30 font-bold rounded-lg hover:bg-white/10 transition-colors"
                        >
                            Book a Meeting
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
