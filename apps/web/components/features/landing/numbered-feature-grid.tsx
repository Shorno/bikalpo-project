const features = [
    {
        number: "01",
        title: "Cloud Point of Sale",
        description:
            "Execute transactions from anywhere with real-time sync across all your physical and digital outlets.",
    },
    {
        number: "02",
        title: "Multi-Warehouse Sync",
        description:
            "Centralize inventory management across multiple locations with automated stock transfer tracking.",
    },
    {
        number: "03",
        title: "AI-Driven Insights",
        description:
            "Predict future demand and identify sales trends before they happen with our integrated neural engine.",
    },
    {
        number: "04",
        title: "Employee Governance",
        description:
            "Role-based access controls and detailed performance logs ensure your team stays focused and secure.",
    },
    {
        number: "05",
        title: "Omnichannel CRM",
        description:
            "Maintain a 360-degree view of your customer interactions across SMS, Email, and in-person visits.",
    },
    {
        number: "06",
        title: "Tax Compliance Engine",
        description:
            "Automate complex VAT and local tax calculations with regional compliance templates built-in.",
    },
    {
        number: "07",
        title: "Dynamic Loyalty Labs",
        description:
            "Create sophisticated reward tiers and point systems that keep your customers coming back for more.",
    },
    {
        number: "08",
        title: "Secure API Gateway",
        description:
            "Connect your favorite third-party tools seamlessly with our robust, enterprise-grade developer API.",
    },
    {
        number: "09",
        title: "Instant Financial Audits",
        description:
            "Generate profit & loss statements and balance sheets with a single click, ready for your accountant.",
    },
];

export function NumberedFeatureGrid() {
    return (
        <section
            className="py-16 px-6"
            style={{ backgroundColor: "#edeeef" }}
        >
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <div
                            key={feature.number}
                            className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all group"
                        >
                            <span className="text-4xl font-bold text-gray-200 group-hover:text-[#003178]/20 transition-colors">
                                {feature.number}
                            </span>
                            <h3
                                className="text-xl font-bold mt-4 mb-3"
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                }}
                            >
                                {feature.title}
                            </h3>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
