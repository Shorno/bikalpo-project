import { LandingNavbar } from "@/components/features/landing/landing-navbar";
import { LandingFooter } from "@/components/features/landing/landing-footer";

export default function LandingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Google Material Symbols + Fonts */}
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link
                href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap"
                rel="stylesheet"
            />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link
                href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
                rel="stylesheet"
            />
            <div
                style={{
                    fontFamily: "'Inter', sans-serif",
                    backgroundColor: "#f8f9fa",
                    color: "#191c1d",
                }}
            >
                <LandingNavbar />
                <main>{children}</main>
                <LandingFooter />
            </div>
        </>
    );
}
