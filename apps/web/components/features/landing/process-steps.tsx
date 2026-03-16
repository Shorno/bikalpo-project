export function ProcessSteps() {
    const steps = [
        {
            number: 1,
            title: "Create Account",
            description: "Quick registration to get you started immediately.",
        },
        {
            number: 2,
            title: "Select Plan",
            description:
                "Choose the perfect scale for your current needs.",
        },
        {
            number: 3,
            title: "Setup Store",
            description:
                "Configure your business details and go live.",
        },
    ];

    return (
        <section className="py-12 sm:py-24">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <h2
                    className="text-3xl font-bold mb-16"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                    Three Steps to Success
                </h2>
                <div className="grid md:grid-cols-3 gap-12 relative">
                    {/* Connector line */}
                    <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-[2px] bg-gray-200/20 -z-10" />

                    {steps.map((step) => (
                        <div
                            key={step.number}
                            className="flex flex-col items-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-[#003178] text-white flex items-center justify-center text-xl font-bold mb-6">
                                {step.number}
                            </div>
                            <h4
                                className="text-xl font-bold mb-2"
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                }}
                            >
                                {step.title}
                            </h4>
                            <p className="text-gray-600 text-sm px-8">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
