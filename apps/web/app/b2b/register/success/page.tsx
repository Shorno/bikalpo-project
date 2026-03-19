import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <section className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Animation */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute w-32 h-32 bg-green-100 rounded-full animate-ping opacity-20" />
          <div className="relative w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-2 border-green-200">
            <span
              className="material-symbols-outlined text-5xl text-green-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
        </div>

        {/* Content */}
        <h1
          className="text-3xl font-extrabold text-gray-900 mb-3"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Application Submitted!
        </h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
          Thank you for applying to join Bikalpo. Our team will review your
          application and get back to you within{" "}
          <strong className="text-gray-700">24 hours</strong>.
        </p>

        {/* Status Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8 text-left">
          <h3 className="font-bold text-sm text-gray-900 mb-4">
            Application Status
          </h3>
          <div className="space-y-4">
            {/* Step 1 - Done */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-green-600 text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
                <div className="w-0.5 h-6 bg-green-200 mt-1" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  Application Submitted
                </p>
                <p className="text-xs text-gray-400">Just now</p>
              </div>
            </div>

            {/* Step 2 - In progress */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-[#003178]/10 flex items-center justify-center">
                  <span className="w-3 h-3 bg-[#003178] rounded-full animate-pulse" />
                </div>
                <div className="w-0.5 h-6 bg-gray-200 mt-1" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  Under Review
                </p>
                <p className="text-xs text-gray-400">
                  Usually within 24 hours
                </p>
              </div>
            </div>

            {/* Step 3 - Pending */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-300 text-sm">
                    storefront
                  </span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-400">
                  Account Activated
                </p>
                <p className="text-xs text-gray-300">
                  Start selling on Bikalpo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-[#003178]/5 rounded-xl p-5 mb-8 text-left">
          <h3 className="font-bold text-sm text-[#003178] mb-3 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
            While You Wait
          </h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <span
                className="material-symbols-outlined text-[#003178] text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                play_circle
              </span>
              Watch our seller setup guide
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <span
                className="material-symbols-outlined text-[#003178] text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                menu_book
              </span>
              Read the seller handbook
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <span
                className="material-symbols-outlined text-[#003178] text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                support_agent
              </span>
              Contact support if you need help
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/b2b"
            className="px-6 py-3 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            Back to Home
          </Link>
          <Link
            href="/b2b/contact"
            className="px-6 py-3 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] transition-all"
            style={{
              background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
            }}
          >
            Contact Support
          </Link>
        </div>

        {/* Notification note */}
        <p className="text-xs text-gray-400 mt-6">
          📱 You will receive an SMS notification when your application status
          changes
        </p>
      </div>
    </section>
  );
}
