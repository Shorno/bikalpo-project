"use client";

import { useRef } from "react";

interface StepDocumentsProps {
  data: {
    tradeLicense: File | null;
    tradeLicenseName: string;
    nidDocument: File | null;
    nidDocumentName: string;
    tinCertificate: File | null;
    tinCertificateName: string;
  };
  onUpdate: (data: StepDocumentsProps["data"]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface DocumentUploadCardProps {
  title: string;
  description: string;
  icon: string;
  required: boolean;
  fileName: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

function DocumentUploadCard({
  title,
  description,
  icon,
  required,
  fileName,
  onFileSelect,
  onRemove,
}: DocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-xl p-5 transition-all duration-200
        ${
          fileName
            ? "border-[#003178]/30 bg-[#003178]/5"
            : "border-gray-200 hover:border-gray-300 bg-white"
        }
      `}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />

      {fileName ? (
        // File selected state
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#003178]/10 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[#003178] text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              description
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {fileName}
            </p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span
                className="material-symbols-outlined text-xs"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              Uploaded
            </p>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      ) : (
        // Empty state
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full text-center"
        >
          <span
            className="material-symbols-outlined text-3xl text-gray-300 mb-2 block"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            {icon}
          </span>
          <p className="text-sm font-semibold text-gray-700 mb-0.5">
            {title}{" "}
            {required ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs text-gray-400 font-normal">
                (Optional)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">{description}</p>
          <p className="text-xs text-[#003178] font-medium mt-2">
            Click to upload or drag & drop
          </p>
        </button>
      )}
    </div>
  );
}

export function StepDocuments({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepDocumentsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            folder_open
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Upload Documents
        </h2>
        <p className="text-gray-500">
          Help us verify your business. You can skip optional docs for now.
        </p>
      </div>

      {/* Trust Badge */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 rounded-lg border border-green-100 mb-6">
        <span
          className="material-symbols-outlined text-green-600 text-lg"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          shield
        </span>
        <span className="text-xs text-green-700 font-medium">
          Your documents are encrypted and securely stored
        </span>
      </div>

      {/* Document Upload Cards */}
      <div className="space-y-4">
        <DocumentUploadCard
          title="National ID (NID)"
          description="Front & back of your NID card (Image or PDF)"
          icon="badge"
          required={true}
          fileName={data.nidDocumentName}
          onFileSelect={(file) =>
            onUpdate({
              ...data,
              nidDocument: file,
              nidDocumentName: file.name,
            })
          }
          onRemove={() =>
            onUpdate({
              ...data,
              nidDocument: null,
              nidDocumentName: "",
            })
          }
        />

        <DocumentUploadCard
          title="Trade License"
          description="Your business trade license (Image or PDF)"
          icon="receipt_long"
          required={false}
          fileName={data.tradeLicenseName}
          onFileSelect={(file) =>
            onUpdate({
              ...data,
              tradeLicense: file,
              tradeLicenseName: file.name,
            })
          }
          onRemove={() =>
            onUpdate({
              ...data,
              tradeLicense: null,
              tradeLicenseName: "",
            })
          }
        />

        <DocumentUploadCard
          title="TIN Certificate"
          description="Tax Identification Number certificate"
          icon="apartment"
          required={false}
          fileName={data.tinCertificateName}
          onFileSelect={(file) =>
            onUpdate({
              ...data,
              tinCertificate: file,
              tinCertificateName: file.name,
            })
          }
          onRemove={() =>
            onUpdate({
              ...data,
              tinCertificate: null,
              tinCertificateName: "",
            })
          }
        />
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3.5 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
          }}
        >
          {data.nidDocumentName ? "Continue" : "Skip for Now"}
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
