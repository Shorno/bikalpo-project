const advantages = [
    {
        icon: "inventory_2",
        title: "Advanced Inventory",
        description:
            "Real-time tracking with low-stock alerts and automated PO generation.",
        highlight: true,
    },
    {
        icon: "point_of_sale",
        title: "Sales & Distribution",
        description:
            "Optimized routes for delivery and high-speed checkout for retail.",
    },
    {
        icon: "account_balance_wallet",
        title: "Finance & Ledger",
        description:
            "Complete double-entry accounting with granular expense tracking.",
    },
    {
        icon: "groups",
        title: "HR & Payroll",
        description:
            "Attendance tracking, salary disbursement, and leave management.",
    },
    {
        icon: "sms",
        title: "SMS Marketing",
        description:
            "Reach customers directly with personalized offers and reminders.",
    },
    {
        icon: "analytics",
        title: "Custom Reports",
        description:
            "Visual dashboards tailored to your specific business metrics.",
    },
    {
        icon: "loyalty",
        title: "Promotion & Loyalty",
        description:
            "Build brand advocates with sophisticated tier-based rewards.",
    },
    {
        icon: "share_reviews",
        title: "Referral System",
        description:
            "Organic growth tools to turn customers into your sales force.",
    },
];

export function AdvantageDetail() {
    return (
        <section className="py-24 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                {/* Left: Advantage Items */}
                <div className="relative">
                    <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#003178]/5 rounded-full blur-3xl" />
                    <div className="relative space-y-4">
                        {advantages.map((item) => (
                            <div
                                key={item.title}
                                className={`flex items-start gap-6 p-6 rounded-xl transition-colors ${
                                    item.highlight
                                        ? "bg-[#f3f4f5] border-l-4 border-[#003178]"
                                        : "bg-white hover:bg-[#f3f4f5]"
                                }`}
                            >
                                <span
                                    className="material-symbols-outlined text-4xl text-[#003178] mt-1"
                                    style={
                                        item.highlight
                                            ? {
                                                  fontVariationSettings:
                                                      "'FILL' 1",
                                              }
                                            : {}
                                    }
                                >
                                    {item.icon}
                                </span>
                                <div>
                                    <h4
                                        className="text-xl font-bold mb-1"
                                        style={{
                                            fontFamily:
                                                "'Manrope', sans-serif",
                                        }}
                                    >
                                        {item.title}
                                    </h4>
                                    <p className="text-gray-500 text-sm">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Sticky Text + Testimonial */}
                <div className="lg:sticky lg:top-32 self-start">
                    <h2
                        className="text-4xl font-extrabold mb-6"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Designed for Structural Integrity.
                    </h2>
                    <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                        We didn&apos;t just build a list of tools; we engineered
                        an ecosystem. Every module in Bikalpo communicates
                        seamlessly, ensuring that a sale in Barishal instantly
                        updates your financial ledger in Khulna.
                    </p>

                    {/* Testimonial Card */}
                    <div
                        className="p-8 rounded-2xl text-white"
                        style={{
                            background:
                                "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                        }}
                    >
                        <p className="italic text-lg mb-6 leading-relaxed">
                            &ldquo;Bikalpo transformed our chaos into a
                            well-oiled machine. The inventory sync alone saved
                            us 20 hours a week.&rdquo;
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#0d47a1] overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    alt="Ahmed Kabir"
                                    className="w-full h-full object-cover"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3sAxxW86v4FX_NZBmoYREaWBNMOg0SENeLkR7QUvo-0I2UZHGlXH9y_PIb64uppsP9YUz8g83UkDwfZ1WHtO4QrFNLDYv5odfFMgW7JhA1pWV5xBwz_vb5zjOzg-9dA0uPclFL8S5io88N83PgRZgCfGbTG58SlwBVbCY7OYRc2XcPwPB-WzsaX3sgVj4triyy_CBfxZE_FMwevzTj1P9WPD9tvEBhDzjV2fHYOhb_CQeQh-UuHpHCgnAL01P-iovaAXKa2V9-1w"
                                />
                            </div>
                            <div>
                                <p className="font-bold">Ahmed Kabir</p>
                                <p className="text-sm opacity-80">
                                    CEO, Delta Retail Group
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
