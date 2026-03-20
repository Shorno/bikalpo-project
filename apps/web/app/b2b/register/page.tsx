"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProgressStepper } from "@/components/features/onboarding/progress-stepper";
import { StepAccount } from "@/components/features/onboarding/step-account";
import { StepBusinessProfile } from "@/components/features/onboarding/step-business-profile";
import { StepShopSetup } from "@/components/features/onboarding/step-shop-setup";
import { StepDocuments } from "@/components/features/onboarding/step-documents";
import { StepPlanSelection } from "@/components/features/onboarding/step-plan-selection";
import { StepReview } from "@/components/features/onboarding/step-review";
import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { fileToDataUrl } from "@/lib/cloudinary";

interface FormData {
  account: {
    phone: string;
    fullName: string;
    email: string;
    password: string;
    otpVerified: boolean;
  };
  business: {
    businessType: string;
    shopName: string;
    businessCategory: string;
    yearsInBusiness: string;
    monthlyRevenue: string;
  };
  location: {
    address: string;
    addressBn: string;
    division: string;
    district: string;
    area: string;
    postCode: string;
    latitude: number;
    longitude: number;
    shopContactNumber: string;
  };
  documents: {
    tradeLicense: File | null;
    tradeLicenseName: string;
    nidDocument: File | null;
    nidDocumentName: string;
    tinCertificate: File | null;
    tinCertificateName: string;
  };
  plan: {
    selectedPlan: string;
  };
}

const INITIAL_FORM_DATA: FormData = {
  account: {
    phone: "",
    fullName: "",
    email: "",
    password: "",
    otpVerified: false,
  },
  business: {
    businessType: "",
    shopName: "",
    businessCategory: "",
    yearsInBusiness: "",
    monthlyRevenue: "",
  },
  location: {
    address: "",
    addressBn: "",
    division: "",
    district: "",
    area: "",
    postCode: "",
    latitude: 0,
    longitude: 0,
    shopContactNumber: "",
  },
  documents: {
    tradeLicense: null,
    tradeLicenseName: "",
    nidDocument: null,
    nidDocumentName: "",
    tinCertificate: null,
    tinCertificateName: "",
  },
  plan: {
    selectedPlan: "free_trial",
  },
};

const TOTAL_STEPS = 5;

/** Upload a File to Cloudinary, return the URL or null */
async function uploadDocument(file: File | null, folder: string): Promise<string | null> {
  if (!file) return null;
  try {
    const dataUrl = await fileToDataUrl(file);
    const result = await client.cloudinary.upload({ file: dataUrl, folder });
    return result.success ? result.url : null;
  } catch {
    return null;
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [showReview, setShowReview] = useState(false);

  const markStepCompleted = (step: number) => {
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev : [...prev, step]
    );
  };

  const goToStep = (step: number) => {
    setShowReview(false);
    setCurrentStep(step);
  };

  const handleNext = () => {
    markStepCompleted(currentStep);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowReview(true);
    }
  };

  const handleBack = () => {
    if (showReview) {
      setShowReview(false);
      setCurrentStep(TOTAL_STEPS);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // 1. Update user profile (name, password) — user was created by phone verify
      if (formData.account.fullName) {
        await authClient.updateUser({ name: formData.account.fullName });
      }
      if (formData.account.password && formData.account.password.length >= 6) {
        await authClient.changePassword({
          newPassword: formData.account.password,
          currentPassword: undefined as any, // phone-created user has no password yet
          revokeOtherSessions: false,
        });
      }

      // 2. Upload documents to Cloudinary
      const docFolder = formData.business.businessType === "warehouse"
        ? "warehouse-documents"
        : "seller-documents";

      const uploadedDocs: string[] = [];
      const nidUrl = await uploadDocument(formData.documents.nidDocument, docFolder);
      if (nidUrl) uploadedDocs.push(nidUrl);
      const tlUrl = await uploadDocument(formData.documents.tradeLicense, docFolder);
      if (tlUrl) uploadedDocs.push(tlUrl);
      const tinUrl = await uploadDocument(formData.documents.tinCertificate, docFolder);
      if (tinUrl) uploadedDocs.push(tinUrl);

      // 3. Shared fields for both application types
      const sharedFields = {
        ownerName: formData.account.fullName,
        phoneNumber: `+880${formData.account.phone.replace(/^0+/, "")}`,
        tradeLicenseNumber: formData.documents.tradeLicenseName || undefined,
        documents: uploadedDocs,
        businessCategory: formData.business.businessCategory || undefined,
        yearsInBusiness: formData.business.yearsInBusiness || undefined,
        monthlyRevenue: formData.business.monthlyRevenue || undefined,
        latitude: formData.location.latitude ? String(formData.location.latitude) : undefined,
        longitude: formData.location.longitude ? String(formData.location.longitude) : undefined,
        area: formData.location.area || undefined,
        district: formData.location.district || undefined,
        division: formData.location.division || undefined,
        postCode: formData.location.postCode || undefined,
        selectedPlan: formData.plan.selectedPlan || undefined,
      };

      // 4. Route to correct API based on business type
      if (formData.business.businessType === "warehouse") {
        await client.warehouseApplication.submit({
          warehouseName: formData.business.shopName,
          warehouseAddress: formData.location.address,
          ...sharedFields,
        });
      } else {
        await client.sellerApplication.submit({
          shopName: formData.business.shopName,
          businessType: formData.business.businessType as "retail" | "restaurant",
          shopAddress: formData.location.address,
          ...sharedFields,
        });
      }

      toast.success("Application submitted successfully!");
      router.push("/b2b/register/success");
    } catch (error: any) {
      const message = error?.message || "Something went wrong. Please try again.";
      toast.error(message);
      throw error; // Let StepReview handle the loading state
    }
  };

  const renderStep = () => {
    if (showReview) {
      return (
        <StepReview
          formData={formData}
          onEdit={goToStep}
          onSubmit={handleSubmit}
          onBack={handleBack}
        />
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <StepAccount
            data={formData.account}
            onUpdate={(data) =>
              setFormData((prev) => ({ ...prev, account: data }))
            }
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <StepBusinessProfile
            data={formData.business}
            onUpdate={(data) =>
              setFormData((prev) => ({ ...prev, business: data }))
            }
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <StepShopSetup
            data={formData.location}
            onUpdate={(data) =>
              setFormData((prev) => ({ ...prev, location: data }))
            }
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <StepDocuments
            data={formData.documents}
            onUpdate={(data) =>
              setFormData((prev) => ({ ...prev, documents: data }))
            }
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <StepPlanSelection
            data={formData.plan}
            onUpdate={(data) =>
              setFormData((prev) => ({ ...prev, plan: data }))
            }
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="min-h-screen py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Top branding */}
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-[#003178]/60 uppercase tracking-widest">
            Bikalpo for Business
          </p>
        </div>

        {/* Progress Stepper */}
        <ProgressStepper
          currentStep={showReview ? TOTAL_STEPS : currentStep}
          totalSteps={TOTAL_STEPS}
          onStepClick={goToStep}
          completedSteps={completedSteps}
        />

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
          {renderStep()}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Takes less than 5 minutes • Already have an account?{" "}
          <a href="/sign-in" className="text-[#003178] font-medium hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </section>
  );
}
