import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQs | Bikalpo",
  description: "Frequently Asked Questions",
};

export default function FAQsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Frequently Asked Questions
      </h1>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">How do I place an order?</h3>
          <p className="text-gray-600">
            Browse products, add to cart, and proceed to checkout.
          </p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">
            What payment methods do you accept?
          </h3>
          <p className="text-gray-600">
            We accept Cash on Delivery, bKash, and Nagad.
          </p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">Do you offer delivery?</h3>
          <p className="text-gray-600">Yes, we deliver nationwide.</p>
        </div>
        <div className="text-center text-sm text-gray-400 mt-8">
          (This is a placeholder page)
        </div>
      </div>
    </div>
  );
}
