export function FeaturesHero() {
    return (
        <section className="pt-24 pb-16 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col items-start max-w-3xl">
                    <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6"
                        style={{
                            backgroundColor: "rgba(160, 243, 153, 0.3)",
                            color: "#005312",
                        }}
                    >
                        Advantage
                    </span>
                    <h1
                        className="text-5xl md:text-7xl font-extrabold mb-8 leading-tight"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Features That Actually Make Business Easier
                    </h1>
                    <p className="text-xl text-gray-500 leading-relaxed opacity-80">
                        Stop juggling multiple platforms. Bikalpo unifies your
                        entire operation—from local inventory to global
                        marketing—into one architectural masterpiece of
                        efficiency.
                    </p>
                </div>
            </div>
        </section>
    );
}
