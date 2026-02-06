import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Bikalpo",
  description: "Get in touch with the Bikalpo team.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
      <p className="text-gray-600 max-w-2xl mx-auto mb-8">
        Have questions? We'd love to hear from you. (This is a placeholder page)
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-left">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">Email</h3>
          <p className="text-gray-600">support@bikalpo.com</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">Phone</h3>
          <p className="text-gray-600">+880 1234 567890</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">Address</h3>
          <p className="text-gray-600">Dhaka, Bangladesh</p>
        </div>
      </div>
    </div>
  );
}
