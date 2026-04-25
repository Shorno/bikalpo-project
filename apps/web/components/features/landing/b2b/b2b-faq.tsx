"use client";

import { useState } from "react";

const faqs = [
  { question: "Trial কত দিনের?", questionEn: "How long is the trial?", answer: "Bikalpo Trade এর ট্রায়াল ৩০ দিনের। এই সময়ের মধ্যে আপনি সব ফিচার সম্পূর্ণ বিনামূল্যে ব্যবহার করতে পারবেন।", answerEn: "The trial lasts 30 days. During this time, you can use all features completely free of charge." },
  { question: "Approval কত সময় লাগে?", questionEn: "How long does approval take?", answer: "সাধারণত ব্যবসা যাচাই করতে ২৪-৪৮ ঘণ্টা সময় লাগে। জরুরি ক্ষেত্রে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।", answerEn: "Business verification usually takes 24-48 hours. For urgent cases, contact our support team." },
  { question: "Trial শেষে কি হবে?", questionEn: "What happens after the trial ends?", answer: "ট্রায়াল শেষ হলে আপনার অ্যাকাউন্ট Read Only মোডে চলে যাবে। আগের সব রিপোর্ট ও ডেটা দেখতে পারবেন। নতুন ট্রানজেকশনের জন্য সাবস্ক্রিপশন প্রয়োজন।", answerEn: "After the trial, your account switches to Read Only mode. You can still view all previous reports and data. A subscription is needed for new transactions." },
  { question: "Subscription কিভাবে কাজ করে?", questionEn: "How does the subscription work?", answer: "ট্রায়াল শেষে আপনি মাসিক বা বার্ষিক সাবস্ক্রিপশন প্ল্যান বেছে নিতে পারবেন। প্ল্যান অনুযায়ী ফিচার ও সাপোর্ট পাবেন।", answerEn: "After the trial, choose monthly or annual subscription plans. Features and support vary by plan." },
  { question: "Data কি নিরাপদ?", questionEn: "Is my data safe?", answer: "হ্যাঁ, আপনার সকল ডেটা এনক্রিপ্টেড ক্লাউড সার্ভারে সংরক্ষিত। আমরা industry-standard সিকিউরিটি প্রোটোকল ব্যবহার করি।", answerEn: "Yes, all data is stored on encrypted cloud servers. We use industry-standard security protocols." },
];

export function B2bFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 sm:py-28 bg-white" id="faq">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="lg:sticky lg:top-32">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
              <span className="material-symbols-outlined text-sm text-[#003178]">help</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Frequently Asked <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Questions</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-8">Got questions? We&apos;ve got answers. If you can&apos;t find what you&apos;re looking for, contact our support team.</p>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#fafbfc] border border-black/[0.04]">
              <span className="material-symbols-outlined text-xl text-[#003178]">support_agent</span>
              <div>
                <div className="text-sm font-bold text-[#0f172a]">Need more help?</div>
                <div className="text-xs text-slate-500">support@bikalpo.com • +88 01XXXXXXXXX</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.questionEn} className={`rounded-xl overflow-hidden border transition-all ${isOpen ? "bg-[#fafbfc] border-[#003178]/10" : "bg-white border-black/[0.04]"}`}>
                  <button type="button" onClick={() => setOpenIndex(isOpen ? null : index)} className="w-full flex items-start gap-4 p-5 text-left">
                    <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 transition-transform duration-300 ${isOpen ? "text-[#003178] rotate-180" : "text-slate-400"}`}>expand_more</span>
                    <div>
                      <div className={`font-bold text-sm mb-0.5 ${isOpen ? "text-[#003178]" : "text-[#0f172a]"}`} style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>{faq.question}</div>
                      <div className="text-xs text-slate-400">{faq.questionEn}</div>
                    </div>
                  </button>
                  <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 pl-14">
                        <div className="text-sm text-slate-600 mb-2 leading-relaxed" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>{faq.answer}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">{faq.answerEn}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
