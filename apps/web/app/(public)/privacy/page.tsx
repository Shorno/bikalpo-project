import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Bikalpo",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose max-w-none text-gray-600">
        <p className="mb-4">
          Your privacy is important to us. It is Bikalpo's policy to respect
          your privacy regarding any information we may collect.
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">
          Information We Collect
        </h2>
        <p className="mb-4">
          We only ask for personal information when we truly need it to provide
          a service to you.
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-3">Security</h2>
        <p className="mb-4">
          We don't share any personally identifying information publicly or with
          third-parties, except when required to by law.
        </p>
        <p className="mt-8 text-sm text-gray-400">
          (This is a placeholder page)
        </p>
      </div>
    </div>
  );
}
