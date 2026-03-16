import Link from "next/link";

const footerLinks = {
    general: [
        { label: "Features", href: "/features" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Contact", href: "/contact" },
        { label: "FAQs", href: "#" },
        { label: "Blog", href: "#" },
    ],
    company: [
        { label: "About Us", href: "#" },
        { label: "Terms & Conditions", href: "#" },
        { label: "Privacy Policy", href: "#" },
        { label: "Refund & Return Policy", href: "#" },
    ],
    program: [
        { label: "Join & Earn", href: "#" },
        { label: "Become an Affiliator", href: "#" },
    ],
};

export function LandingFooter() {
    return (
        <footer
            className="pt-20 pb-10"
            style={{ backgroundColor: "#e1e3e4" }}
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
                    {/* Brand */}
                    <div className="col-span-2">
                        <span
                            className="text-2xl font-extrabold tracking-tight mb-6 block"
                            style={{
                                fontFamily: "'Manrope', sans-serif",
                                color: "#003178",
                            }}
                        >
                            Bikalpo
                        </span>
                        <p className="text-gray-600 max-w-xs mb-4 text-sm leading-relaxed">
                            Empowering businesses with modern management tools
                            that bridge the gap between complexity and clarity.
                        </p>
                        <div className="text-sm text-gray-500 space-y-1 mb-6">
                            <p>38, Bangla Bazar, Barisal, Bangladesh</p>
                            <p>
                                Mob: +88 01XXXXXXXXX | Email:
                                info@bikalpo.com.bd
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 hover:bg-[#003178] hover:text-white transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-sm">
                                    public
                                </span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 hover:bg-[#003178] hover:text-white transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-sm">
                                    alternate_email
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* General */}
                    <div>
                        <h5
                            className="font-bold mb-6"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            General
                        </h5>
                        <ul className="space-y-4 text-sm text-gray-600">
                            {footerLinks.general.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-[#003178] transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h5
                            className="font-bold mb-6"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            Company
                        </h5>
                        <ul className="space-y-4 text-sm text-gray-600">
                            {footerLinks.company.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-[#003178] transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Program */}
                    <div>
                        <h5
                            className="font-bold mb-6"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            Become an Affiliator
                        </h5>
                        <ul className="space-y-4 text-sm text-gray-600">
                            {footerLinks.program.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-[#003178] transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="pt-10 border-t border-gray-400/30 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs text-gray-500 font-medium">
                        © 2026 Bikalpo. All Rights Reserved. Barishal & Khulna,
                        Bangladesh.
                    </p>
                    <div className="flex gap-8">
                        <span className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            Terms of Service
                        </span>
                        <span className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            Cookie Settings
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
