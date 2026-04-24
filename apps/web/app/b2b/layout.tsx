import { B2bNavbar } from "@/components/features/landing/b2b/b2b-navbar";
import { B2bFooter } from "@/components/features/landing/b2b/b2b-footer";
import "@/components/features/landing/b2b/b2b-landing.css";

export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Google Fonts: Manrope, Inter, Hind Siliguri (Bengali), Material Symbols */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <div
        className="b2b-landing"
        style={{
          fontFamily: "'Inter', 'Hind Siliguri', sans-serif",
          backgroundColor: "#f8f9fc",
          color: "#191c1d",
        }}
      >
        <B2bNavbar />
        <main>{children}</main>
        <B2bFooter />
      </div>
    </>
  );
}
