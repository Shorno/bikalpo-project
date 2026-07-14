export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import type React from "react";
import Providers from "@/app/providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Bikalpo",
    template: "%s | Bikalpo",
  },
  description:
    "Bikalpo connects customer shopping with organized business supply workflows.",
};

const extensionHydrationCleanup = `
(() => {
  const attributes = ["bis_skin_checked"];
  const removeAttributes = (root) => {
    if (!root || root.nodeType !== 1) return;
    for (const attribute of attributes) {
      root.removeAttribute(attribute);
      root.querySelectorAll("[" + attribute + "]").forEach((element) => {
        element.removeAttribute(attribute);
      });
    }
  };

  removeAttributes(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        removeAttributes(mutation.target);
        continue;
      }

      mutation.addedNodes.forEach(removeAttributes);
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: attributes,
    childList: true,
    subtree: true,
  });

  window.addEventListener(
    "load",
    () => window.setTimeout(() => observer.disconnect(), 1500),
    { once: true },
  );
})();
`;

export default function RootLayout({
  children,
  auth,
}: Readonly<{
  children: React.ReactNode;
  auth: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-(family-name:--font-poppins) antialiased`}
        suppressHydrationWarning
      >
        <script
          id="extension-hydration-cleanup"
          dangerouslySetInnerHTML={{ __html: extensionHydrationCleanup }}
        />
        <NuqsAdapter>
          <Providers>
            {children}
            {auth}
          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
