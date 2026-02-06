import Image from "next/image";

export function CustomerHero() {
  return (
    <section className="relative h-[200px] md:h-[300px] w-full rounded-2xl overflow-hidden shadow-sm mb-8">
      {/* Background Generated Image */}
      <Image
        src="/images/customer-hero-banner.png"
        alt="B2B Wholesale Marketplace"
        fill
        className="object-cover"
        priority
      />

      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
        <div className="px-6 md:px-12 max-w-2xl">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Quick Order • <br />
            Fast Delivery • <br />
            Best Rates
          </h2>
          <p className="text-white/80 text-sm md:text-base max-w-md hidden md:block">
            Your premium B2B marketplace for all your business supplies.
            Verified products, direct from manufacturers.
          </p>
        </div>
      </div>
    </section>
  );
}
