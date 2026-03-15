"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ContactSection() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        message: "",
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.message) {
            toast.error("Please fill in all required fields");
            return;
        }
        setLoading(true);
        await new Promise((r) => setTimeout(r, 1000));
        toast.success("Message sent! We'll get back to you soon.");
        setForm({ name: "", email: "", phone: "", message: "" });
        setLoading(false);
    };

    return (
        <section className="pb-24 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Contact Details (5 Columns) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div
                            className="p-8 rounded-xl border border-gray-200/20"
                            style={{ backgroundColor: "#edeeef" }}
                        >
                            <h3
                                className="text-2xl font-bold mb-8"
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                }}
                            >
                                Contact Information
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[#003178] shadow-sm">
                                        <span className="material-symbols-outlined">
                                            call
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                            Call Us
                                        </p>
                                        <p className="text-lg font-semibold">
                                            +880 1234 567 890
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[#003178] shadow-sm">
                                        <span className="material-symbols-outlined">
                                            mail
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                            Email Us
                                        </p>
                                        <p className="text-lg font-semibold">
                                            hello@bikalpo.com
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[#003178] shadow-sm">
                                        <span className="material-symbols-outlined">
                                            location_on
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                            Our Office
                                        </p>
                                        <p className="text-lg font-semibold">
                                            Barishal &amp; Khulna, Bangladesh
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Social */}
                            <div className="mt-12 pt-12 border-t border-gray-300/30">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">
                                    Follow Our Progress
                                </p>
                                <div className="flex gap-4">
                                    <a
                                        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 hover:text-[#003178] transition-all shadow-sm"
                                        href="#"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            share
                                        </span>
                                    </a>
                                    <a
                                        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 hover:text-[#003178] transition-all shadow-sm"
                                        href="#"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            public
                                        </span>
                                    </a>
                                    <a
                                        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 hover:text-[#003178] transition-all shadow-sm"
                                        href="#"
                                    >
                                        <span className="material-symbols-outlined text-xl">
                                            diversity_3
                                        </span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="h-64 rounded-xl overflow-hidden relative shadow-lg group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                alt="Map showing Bikalpo office locations in Bangladesh"
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5Unt1LeiR_675eOflG4Ld3J9dnTOT_AapYEG5LYQNLYxs9n5W6ddke8yO1tM5U0Pd20FqkO8CEdBWEv4bbEyinKgj9oSjrdgIuadp7yQglf-nhKgrPZ6mISSj6NHxJ8VRZKLBPQbfeAgVtntw9HF7nfITT7YlF9UdGiXR3c5vr0ikdPMimjGH7_aKaFwsJ14-8eCrnrgMxQDJfO7OOyOxPU6miYCfg4DQPNMZUKYdy08m1OomDBK3lzvlCb8rm0IrYU3ycqdHcGY"
                            />
                            <div className="absolute inset-0 bg-[#003178]/20 mix-blend-multiply" />
                            <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-sm p-4 rounded-lg flex justify-between items-center">
                                <span className="text-sm font-bold text-[#003178]">
                                    View on Maps
                                </span>
                                <span className="material-symbols-outlined text-[#003178]">
                                    arrow_forward
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Contact Form (7 Columns) */}
                    <div className="lg:col-span-7">
                        <div className="p-8 md:p-12 bg-white rounded-xl shadow-[0px_4px_20px_rgba(25,28,29,0.04)] border border-gray-200/20">
                            <form
                                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                onSubmit={handleSubmit}
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                                        Full Name
                                    </label>
                                    <input
                                        className="w-full px-4 py-3 rounded-lg bg-[#f3f4f5] border-none focus:ring-2 focus:ring-[#003178] focus:bg-white transition-all placeholder:text-gray-400 outline-none"
                                        placeholder="John Doe"
                                        type="text"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                                        Email Address
                                    </label>
                                    <input
                                        className="w-full px-4 py-3 rounded-lg bg-[#f3f4f5] border-none focus:ring-2 focus:ring-[#003178] focus:bg-white transition-all placeholder:text-gray-400 outline-none"
                                        placeholder="john@company.com"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                email: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                                        Phone Number
                                    </label>
                                    <input
                                        className="w-full px-4 py-3 rounded-lg bg-[#f3f4f5] border-none focus:ring-2 focus:ring-[#003178] focus:bg-white transition-all placeholder:text-gray-400 outline-none"
                                        placeholder="+880 123 4567 890"
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                phone: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                                        How can we help?
                                    </label>
                                    <textarea
                                        className="w-full px-4 py-3 rounded-lg bg-[#f3f4f5] border-none focus:ring-2 focus:ring-[#003178] focus:bg-white transition-all placeholder:text-gray-400 resize-none outline-none"
                                        placeholder="Tell us about your project or inquiry..."
                                        rows={5}
                                        value={form.message}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                message: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="md:col-span-2 pt-4">
                                    <button
                                        className="w-full md:w-auto px-10 py-4 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 group disabled:opacity-60"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                                        }}
                                        type="submit"
                                        disabled={loading}
                                    >
                                        {loading
                                            ? "Sending..."
                                            : "Send Message"}
                                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                                            send
                                        </span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
