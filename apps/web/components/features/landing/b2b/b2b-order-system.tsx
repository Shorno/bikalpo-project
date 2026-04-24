const capabilities = [
  {
    icon: "person_add",
    title: "Unknown Customer Orders",
    description: "Unknown customer থেকেও অর্ডার গ্রহণ করুন",
    en: "Accept orders from any customer, even new ones",
  },
  {
    icon: "computer",
    title: "Direct Online Submission",
    description: "Online-এ সরাসরি অর্ডার সাবমিট",
    en: "Customers submit orders directly online",
  },
  {
    icon: "track_changes",
    title: "Automated Order Tracking",
    description: "অর্ডার অটোমেটিক ট্র্যাকিং",
    en: "Every order is automatically tracked end-to-end",
  },
  {
    icon: "notifications_active",
    title: "Real-time Notifications",
    description: "রিয়েল-টাইম অর্ডার নোটিফিকেশন",
    en: "Instant alerts when new orders arrive",
  },
  {
    icon: "dashboard_customize",
    title: "Centralized Dashboard",
    description: "সেন্ট্রালাইজড অর্ডার ড্যাশবোর্ড",
    en: "One dashboard to manage all your orders",
  },
];

export function B2bOrderSystem() {
  return (
    <section className="b2b-section b2b-section-white" id="order-system">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: "rgba(0,200,83,0.06)",
                border: "1px solid rgba(0,200,83,0.12)",
              }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: "#00C853" }}
              >
                shopping_cart
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#00C853" }}
              >
                Order Collection
              </span>
            </div>
            <h2
              className="b2b-heading text-3xl sm:text-4xl mb-4"
              style={{ color: "#0f172a" }}
            >
              Collect Orders From Anyone.{" "}
              <span className="b2b-gradient-text">Fully Online.</span>
            </h2>
            <p className="b2b-subheading text-lg mb-10">
              No more missed orders. Accept orders digitally from known and
              unknown customers alike.
            </p>

            <div className="space-y-4">
              {capabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="flex items-start gap-4 p-4 rounded-xl transition-all hover:shadow-md"
                  style={{
                    background: "#fafbfc",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="b2b-icon-box flex-shrink-0"
                    style={{
                      background: "rgba(0,49,120,0.06)",
                      color: "#003178",
                    }}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {cap.icon}
                    </span>
                  </div>
                  <div>
                    <h4
                      className="font-bold text-sm mb-1"
                      style={{
                        fontFamily: "'Manrope', sans-serif",
                        color: "#0f172a",
                      }}
                    >
                      {cap.title}
                    </h4>
                    <p
                      className="b2b-bn text-sm"
                      style={{ color: "#64748b" }}
                    >
                      {cap.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative">
            <div
              className="rounded-2xl p-8"
              style={{
                background:
                  "linear-gradient(135deg, #f0f9ff 0%, #e8f5e9 100%)",
                border: "1px solid rgba(0,49,120,0.06)",
              }}
            >
              {/* Mock order flow */}
              <div className="space-y-4">
                {/* Order notification */}
                <div
                  className="p-4 rounded-xl b2b-animate-float-slow"
                  style={{
                    background: "white",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(0,200,83,0.1)",
                        color: "#00C853",
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-lg"
                        style={{
                          fontVariationSettings: "'FILL' 1",
                        }}
                      >
                        notifications
                      </span>
                    </div>
                    <div>
                      <div
                        className="text-sm font-bold"
                        style={{ color: "#0f172a" }}
                      >
                        New Order Received!
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "#94a3b8" }}
                      >
                        Just now
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Order #BT-2847 • ৳24,500
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{
                        background: "rgba(0,200,83,0.1)",
                        color: "#00C853",
                      }}
                    >
                      New Customer
                    </span>
                  </div>
                </div>

                {/* Order list */}
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: "white",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="text-xs font-bold uppercase tracking-wider mb-3"
                    style={{ color: "#94a3b8" }}
                  >
                    Today&apos;s Orders
                  </div>
                  {[
                    { id: "#2847", customer: "New Customer", amount: "৳24,500", status: "Pending" },
                    { id: "#2846", customer: "Rahim Store", amount: "৳18,200", status: "Confirmed" },
                    { id: "#2845", customer: "City Mart", amount: "৳32,100", status: "Delivered" },
                  ].map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between py-2.5"
                      style={{
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                      }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: "#0f172a" }}>
                          {order.customer}
                        </div>
                        <div className="text-xs" style={{ color: "#94a3b8" }}>
                          {order.id}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#0f172a" }}>
                          {order.amount}
                        </div>
                        <div className="text-xs" style={{ color: "#64748b" }}>
                          {order.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
