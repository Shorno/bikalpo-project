"use client";

const capabilities = [
  { icon: "person_add", title: "Unknown Customer Orders", description: "Unknown customer থেকেও অর্ডার গ্রহণ করুন" },
  { icon: "computer", title: "Direct Online Submission", description: "Online-এ সরাসরি অর্ডার সাবমিট" },
  { icon: "track_changes", title: "Automated Order Tracking", description: "অর্ডার অটোমেটিক ট্র্যাকিং" },
  { icon: "notifications_active", title: "Real-time Notifications", description: "রিয়েল-টাইম অর্ডার নোটিফিকেশন" },
  { icon: "dashboard_customize", title: "Centralized Dashboard", description: "সেন্ট্রালাইজড অর্ডার ড্যাশবোর্ড" },
];

export function B2bOrderSystem() {
  return (
    <section className="py-20 sm:py-28 bg-white" id="order-system">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00C853]/[0.06] border border-[#00C853]/[0.12] mb-6">
              <span className="material-symbols-outlined text-sm text-[#00C853]">shopping_cart</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#00C853]">Order Collection</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Collect Orders From Anyone.{" "}
              <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Fully Online.</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-10">No more missed orders. Accept orders digitally from known and unknown customers alike.</p>

            <div className="space-y-4">
              {capabilities.map((cap) => (
                <div key={cap.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#fafbfc] border border-black/[0.04] hover:shadow-md transition-shadow">
                  <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0 bg-[#003178]/[0.06] text-[#003178]">
                    <span className="material-symbols-outlined text-xl">{cap.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0f172a] mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{cap.title}</h4>
                    <p className="text-sm text-slate-500" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl p-8 bg-gradient-to-br from-[#f0f9ff] to-[#e8f5e9] border border-[#003178]/[0.06]">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C853]/10 text-[#00C853]">
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0f172a]">New Order Received!</div>
                      <div className="text-xs text-slate-400">Just now</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">Order #BT-2847 • ৳24,500</div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#00C853]/10 text-[#00C853]">New Customer</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Today&apos;s Orders</div>
                  {[
                    { id: "#2847", customer: "New Customer", amount: "৳24,500", status: "Pending" },
                    { id: "#2846", customer: "Rahim Store", amount: "৳18,200", status: "Confirmed" },
                    { id: "#2845", customer: "City Mart", amount: "৳32,100", status: "Delivered" },
                  ].map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2.5 border-b border-black/[0.04] last:border-0">
                      <div>
                        <div className="text-sm font-medium text-[#0f172a]">{order.customer}</div>
                        <div className="text-xs text-slate-400">{order.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#0f172a]">{order.amount}</div>
                        <div className="text-xs text-slate-500">{order.status}</div>
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
