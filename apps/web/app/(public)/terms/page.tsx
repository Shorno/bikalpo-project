import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Bikalpo",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Terms & Conditions</h1>
      <div className="prose max-w-none text-gray-600">
        <p className="mb-4">
          Welcome to Bikalpo. By using our website, you agree to these terms and
          conditions.
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">
          1. General
        </h2>
        <p className="mb-4">
          These terms apply to all visitors, users, and others who access or use
          the Service.
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">
          2. Purchases
        </h2>
        <p className="mb-4">
          If you wish to purchase any product, you may be asked to supply
          certain information relevant to your purchase.
        </p>
        <p className="mt-8 text-sm text-gray-400">
          (This is a placeholder page)
        </p>
      </div>
    </div>
  );
}
