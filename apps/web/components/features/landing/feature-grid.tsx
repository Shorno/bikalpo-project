const features = [
    {
        icon: "storefront",
        title: "E-commerce Builder",
        description: "Build beautiful online stores with no code required.",
    },
    {
        icon: "groups",
        title: "SR System",
        description:
            "Manage your sales representatives effectively in the field.",
    },
    {
        icon: "point_of_sale",
        title: "Smart POS",
        description: "Next-gen point of sale for retail excellence.",
    },
    {
        icon: "inventory_2",
        title: "Purchase & Supplier",
        description:
            "Track inventory levels and supplier relationships seamlessly.",
    },
    {
        icon: "account_balance",
        title: "Accounting",
        description: "Automated financial tracking and reporting.",
    },
    {
        icon: "badge",
        title: "HRM & Payroll",
        description:
            "Streamline employee management and salary disbursements.",
    },
    {
        icon: "sms",
        title: "SMS Automation",
        description: "Automated notifications for orders and reminders.",
    },
    {
        icon: "monitoring",
        title: "Insights & Reports",
        description: "Deep data analysis to guide your business decisions.",
    },
    {
        icon: "volunteer_activism",
        title: "Refer & Earn",
        description: "Join our affiliate program and grow with us.",
        accent: true,
    },
];

export function FeatureGrid() {
    return (
        <section className="py-24" style={{ backgroundColor: "#f3f4f5" }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="mb-16">
                    <h2
                        className="text-3xl font-bold mb-4"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Powerful Features
                    </h2>
                    <p className="text-gray-600 max-w-2xl">
                        Everything you need to manage and grow your business in
                        one cohesive ecosystem.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="p-8 rounded-xl bg-white border border-gray-200/10 hover:shadow-xl transition-shadow group"
                        >
                            <div
                                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${
                                    feature.accent
                                        ? "bg-[#5b2500]/5 text-[#5b2500]"
                                        : "bg-[#003178]/5 text-[#003178]"
                                }`}
                            >
                                <span className="material-symbols-outlined">
                                    {feature.icon}
                                </span>
                            </div>
                            <h3
                                className="text-lg font-bold mb-3"
                                style={{ fontFamily: "'Manrope', sans-serif" }}
                            >
                                {feature.title}
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
