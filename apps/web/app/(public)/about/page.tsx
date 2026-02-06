import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Bikalpo",
  description: "Learn more about Bikalpo and our mission.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">About Us</h1>
      <p className="text-gray-600 max-w-2xl mx-auto">
        Welcome to Bikalpo. We are dedicated to providing the best products and
        services to our customers. (This is a placeholder page)
      </p>
    </div>
  );
}
