const blogPosts = [
    {
        category: "Strategy",
        title: "How to Scale Your Retail Business in 2024",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1Q-CRpV6EW8_v0mxFLCmL9yAUUOq5cf84ZlE1oUHhU6NQndwsK-4Va6BdSDGVp5rvAKk9IUHMYiG6jxw8VFfrvH43a1GQn-rojOEvD1v_G2cDu01iKeOwqHRb1ZfeNuo8MDRuuwEOD4nTZShYZ-NavY5Hs1rGLFfRi0MYQdIVtstZmu-zdnwyb8A429naCdY9PBCaQe3D3VZpMJmrsPNGy81GR3E7C7jMkj4sTxUpO73K57qQr1cZdfrEtDerVwV0ulBhPpeiyNk",
    },
    {
        category: "Updates",
        title: "New: Smart Inventory Predictions are Here",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBx0qTjHeCWJLWE67B584ljBDfA4ujgcJ722DR0yKfcpiSFq7CZWlZ-AqKZbA80IYEOQcfGB2x3cxJC_HUWhzx17DGWFj897TPbNfHszS_NjCyQlyvZQBlRvIqs9mpm5ypnGfJgCqxswKOIUmPIqmaMJfP-VBWniON9gII2NiOUN0DEjMnk-yyRGXkPU0W5TfdGPjQ3wvvy0uLDa9E7bBQtYjMEHHNluXAdbb2_gYWxEbTlZV24-E54hCG3HUxQ7oGh62545wdQd30",
    },
    {
        category: "Guides",
        title: "Maximizing ROI with Bikalpo SMS Automation",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuASuSCd-DAgjWey_of7uUNZ7Brznk9AvrsRr3x-G0bKLcLibO36glniKFV3Bb8LK75-LlPAi3aZP5C9fyzgwOvZo36IzT8dfQArWI_-8uU5V8rptNFzaAmZu7gnz8hX57iMNAYnSjAjRzcNvVc9QSqxM0YdzZeWVwQlDTk_NCnOdpsfvyI2LG-USOiMbsODQe7zTDYjACwzq7Yj1mdyBFTS2E8Uj10XHNXmZBYM_Isswl_sA5qsYMaX_GoKl9DNcrz6HPDhe1uJpo4",
    },
];

export function BlogSection() {
    return (
        <section className="py-12 sm:py-24" style={{ backgroundColor: "#f3f4f5" }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex justify-between items-end mb-16">
                    <div>
                        <h2
                            className="text-3xl font-bold mb-4"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                            Latest Insights
                        </h2>
                        <p className="text-gray-600">
                            Business strategies and platform updates.
                        </p>
                    </div>
                    <a
                        href="#"
                        className="text-[#003178] font-bold flex items-center gap-2 group"
                    >
                        View All Posts{" "}
                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                            arrow_forward
                        </span>
                    </a>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                    {blogPosts.map((post) => (
                        <div
                            key={post.title}
                            className="bg-white rounded-xl overflow-hidden group"
                        >
                            <div className="h-48 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    alt={post.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    src={post.image}
                                />
                            </div>
                            <div className="p-6">
                                <span className="text-xs font-bold text-[#003178] uppercase tracking-widest mb-3 block">
                                    {post.category}
                                </span>
                                <h4
                                    className="text-lg font-bold mb-4 line-clamp-2"
                                    style={{
                                        fontFamily: "'Manrope', sans-serif",
                                    }}
                                >
                                    {post.title}
                                </h4>
                                <a
                                    href="#"
                                    className="text-sm font-bold flex items-center gap-2 hover:text-[#003178] transition-colors"
                                >
                                    Read More{" "}
                                    <span className="material-symbols-outlined text-sm">
                                        chevron_right
                                    </span>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
