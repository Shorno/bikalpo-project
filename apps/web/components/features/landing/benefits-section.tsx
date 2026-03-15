const benefits = [
    {
        icon: "dashboard",
        title: "All-in-One",
        description: "Unified system for all business functions.",
    },
    {
        icon: "bolt",
        title: "Real-Time Automation",
        description: "Immediate sync across all channels.",
    },
    {
        icon: "touch_app",
        title: "Easy UI",
        description: "Designed for efficiency and ease of use.",
    },
    {
        icon: "support_agent",
        title: "24/7 Support",
        description: "Expert assistance whenever you need it.",
    },
];

export function BenefitsSection() {
    return (
        <section className="py-24">
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {benefits.map((benefit) => (
                    <div key={benefit.title} className="text-center">
                        <div className="w-12 h-12 rounded-full bg-[#1b6d24]/10 text-[#1b6d24] flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined">
                                {benefit.icon}
                            </span>
                        </div>
                        <h4
                            className="font-bold mb-2"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            {benefit.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                            {benefit.description}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
