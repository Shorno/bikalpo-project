"use client";

import { useState } from "react";

const faqs = [
  {
    question: "Trial কত দিনের?",
    questionEn: "How long is the trial?",
    answer:
      "Bikalpo Trade এর ট্রায়াল ৩০ দিনের। এই সময়ের মধ্যে আপনি সব ফিচার সম্পূর্ণ বিনামূল্যে ব্যবহার করতে পারবেন।",
    answerEn:
      "The trial lasts 30 days. During this time, you can use all features completely free of charge.",
  },
  {
    question: "Approval কত সময় লাগে?",
    questionEn: "How long does approval take?",
    answer:
      "সাধারণত ব্যবসা যাচাই করতে ২৪-৪৮ ঘণ্টা সময় লাগে। জরুরি ক্ষেত্রে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
    answerEn:
      "Business verification usually takes 24-48 hours. For urgent cases, contact our support team.",
  },
  {
    question: "Trial শেষে কি হবে?",
    questionEn: "What happens after the trial ends?",
    answer:
      "ট্রায়াল শেষ হলে আপনার অ্যাকাউন্ট Read Only মোডে চলে যাবে। আগের সব রিপোর্ট ও ডেটা দেখতে পারবেন। নতুন ট্রানজেকশনের জন্য সাবস্ক্রিপশন প্রয়োজন।",
    answerEn:
      "After the trial, your account switches to Read Only mode. You can still view all previous reports and data. A subscription is needed for new transactions.",
  },
  {
    question: "Subscription কিভাবে কাজ করে?",
    questionEn: "How does the subscription work?",
    answer:
      "ট্রায়াল শেষে আপনি মাসিক বা বার্ষিক সাবস্ক্রিপশন প্ল্যান বেছে নিতে পারবেন। প্ল্যান অনুযায়ী ফিচার ও সাপোর্ট পাবেন।",
    answerEn:
      "After the trial, choose monthly or annual subscription plans. Features and support vary by plan.",
  },
  {
    question: "Data কি নিরাপদ?",
    questionEn: "Is my data safe?",
    answer:
      "হ্যাঁ, আপনার সকল ডেটা এনক্রিপ্টেড ক্লাউড সার্ভারে সংরক্ষিত। আমরা industry-standard সিকিউরিটি প্রোটোকল ব্যবহার করি।",
    answerEn:
      "Yes, all data is stored on encrypted cloud servers. We use industry-standard security protocols.",
  },
];

export function B2bFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="b2b-section b2b-section-white" id="faq">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: Header */}
          <div className="lg:sticky lg:top-32">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: "rgba(0,49,120,0.04)",
                border: "1px solid rgba(0,49,120,0.08)",
              }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: "#003178" }}
              >
                help
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#003178" }}
              >
                FAQ
              </span>
            </div>
            <h2
              className="b2b-heading text-3xl sm:text-4xl mb-4"
              style={{ color: "#0f172a" }}
            >
              Frequently Asked{" "}
              <span className="b2b-gradient-text">Questions</span>
            </h2>
            <p className="b2b-subheading text-lg mb-8">
              Got questions? We&apos;ve got answers. If you can&apos;t find what
              you&apos;re looking for, contact our support team.
            </p>
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{
                background: "#fafbfc",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: "#003178" }}
              >
                support_agent
              </span>
              <div>
                <div
                  className="text-sm font-bold"
                  style={{ color: "#0f172a" }}
                >
                  Need more help?
                </div>
                <div className="text-xs" style={{ color: "#64748b" }}>
                  support@bikalpo.com • +88 01XXXXXXXXX
                </div>
              </div>
            </div>
          </div>

          {/* Right: Accordion */}
          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={faq.questionEn}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{
                    background: isOpen ? "#fafbfc" : "#ffffff",
                    border: `1px solid ${isOpen ? "rgba(0,49,120,0.1)" : "rgba(0,0,0,0.04)"}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenIndex(isOpen ? null : index)
                    }
                    className="w-full flex items-start gap-4 p-5 text-left"
                  >
                    <span
                      className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5 transition-transform"
                      style={{
                        color: isOpen ? "#003178" : "#94a3b8",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      expand_more
                    </span>
                    <div>
                      <div
                        className="b2b-bn font-bold text-sm mb-0.5"
                        style={{
                          color: isOpen ? "#003178" : "#0f172a",
                        }}
                      >
                        {faq.question}
                      </div>
                      <div className="text-xs" style={{ color: "#94a3b8" }}>
                        {faq.questionEn}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pl-14">
                      <div
                        className="b2b-bn text-sm mb-2 leading-relaxed"
                        style={{ color: "#475569" }}
                      >
                        {faq.answer}
                      </div>
                      <div
                        className="text-xs leading-relaxed"
                        style={{ color: "#94a3b8" }}
                      >
                        {faq.answerEn}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
