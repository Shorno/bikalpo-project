"use client";



import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {

  RegistrationPageHeader,

  RegistrationStepNav,

  REGISTRATION_STEPS,

} from "@/components/features/onboarding/registration-primitives";

import {

  StepBasicInfo,

  type StepBasicInfoData,

} from "@/components/features/onboarding/step-basic-info";

import {

  StepBusinessProfile,

  type StepBusinessData,

} from "@/components/features/onboarding/step-business-profile";

import {

  StepVerification,

  type StepVerificationData,

} from "@/components/features/onboarding/step-verification";

import { StepReview } from "@/components/features/onboarding/step-review";

import {

  EMPTY_LOCATION,

  isWarehouseNature,

  type DocumentUrls,

} from "@/constants/seller-registration";

import { client } from "@/utils/orpc";

import { authClient } from "@/lib/auth-client";

import { fileToDataUrl } from "@/lib/cloudinary";

import Link from "next/link";



interface FormData {

  basic: StepBasicInfoData;

  business: StepBusinessData;

  verification: StepVerificationData;

}



const INITIAL_VERIFICATION: StepVerificationData = {

  tradeLicense: null,

  tradeLicenseName: "",

  binNumber: "",

  tinNumber: "",

  nidDocument: null,

  nidDocumentName: "",

  shopPhoto: null,

  shopPhotoName: "",

  storeFrontPhoto: null,

  storeFrontPhotoName: "",

  warehousePhoto: null,

  warehousePhotoName: "",

  bankName: "",

  bankAccountName: "",

  bankAccountNumber: "",

  referralId: "",

  referralName: "",

  referralPhone: "",

  facebookUrl: "",

  whatsappNumber: "",

  instagramUrl: "",

  websiteUrl: "",

  tiktokUrl: "",

  twitterUrl: "",

};



const INITIAL_FORM_DATA: FormData = {

  basic: {

    phone: "",

    fullName: "",

    email: "",

    password: "",

    otpVerified: false,

    profilePhoto: null,

    profilePhotoPreview: "",

    dateOfBirth: "",

    gender: "",

    personalLocation: { ...EMPTY_LOCATION },

  },

  business: {

    shopName: "",

    businessNature: "",

    productTypeId: null,

    productTypeName: "",

    businessLocation: { ...EMPTY_LOCATION },

    yearsInBusiness: "",

    monthlyRevenue: "",

  },

  verification: { ...INITIAL_VERIFICATION },

};



const TOTAL_STEPS = 4;



async function uploadDocument(

  file: File | null,

  folder: string,

): Promise<string | null> {

  if (!file) return null;

  try {

    const dataUrl = await fileToDataUrl(file);

    const result = await client.cloudinary.upload({ file: dataUrl, folder });

    return result.success ? result.url : null;

  } catch {

    return null;

  }

}



const STEP_TITLES: Record<number, { title: string; description: string }> = {

  1: {

    title: "Basic information",

    description: "Verify your phone and tell us about yourself",

  },

  2: {

    title: "Business details",

    description: "Tell us about your business",

  },

  3: {

    title: "Verification",

    description: "Upload documents and provide verification details",

  },

  4: {

    title: "Review",

    description: "Confirm your details before submitting",

  },

};



export default function RegisterPage() {

  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);

  const stepTopRef = useRef<HTMLDivElement>(null);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const isInitialStep = useRef(true);

  useEffect(() => {
    if (isInitialStep.current) {
      isInitialStep.current = false;
      return;
    }
    stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      stepTitleRef.current?.focus({ preventScroll: true });
    });
  }, [currentStep]);



  const markStepCompleted = (step: number) => {

    setCompletedSteps((prev) =>

      prev.includes(step) ? prev : [...prev, step],

    );

  };



  const goToStep = (step: number) => {

    setCurrentStep(step);

  };



  const handleNext = () => {

    markStepCompleted(currentStep);

    if (currentStep < TOTAL_STEPS) {

      setCurrentStep(currentStep + 1);

    }

  };



  const handleBack = () => {

    if (currentStep > 1) {

      setCurrentStep(currentStep - 1);

    }

  };



  const handleSubmit = async () => {

    const { basic, business, verification } = formData;

    const isWarehouse = isWarehouseNature(business.businessNature);

    const docFolder = isWarehouse ? "warehouse-documents" : "seller-documents";



    try {

      if (basic.fullName) {

        await authClient.updateUser({ name: basic.fullName });

      }

      if (basic.password && basic.password.length >= 6) {

        await authClient.changePassword({

          newPassword: basic.password,

          currentPassword: undefined as never,

          revokeOtherSessions: false,

        });

      }



      const [

        profilePhotoUrl,

        tradeLicenseUrl,

        nidUrl,

        shopPhotoUrl,

        storeFrontUrl,

        warehousePhotoUrl,

      ] = await Promise.all([

        uploadDocument(basic.profilePhoto, docFolder),

        uploadDocument(verification.tradeLicense, docFolder),

        uploadDocument(verification.nidDocument, docFolder),

        uploadDocument(verification.shopPhoto, docFolder),

        uploadDocument(verification.storeFrontPhoto, docFolder),

        uploadDocument(verification.warehousePhoto, docFolder),

      ]);



      const documentUrls: DocumentUrls = {};

      const documents: string[] = [];

      if (tradeLicenseUrl) {

        documentUrls.tradeLicense = tradeLicenseUrl;

        documents.push(tradeLicenseUrl);

      }

      if (nidUrl) {

        documentUrls.nid = nidUrl;

        documents.push(nidUrl);

      }

      if (shopPhotoUrl) {

        documentUrls.shopPhoto = shopPhotoUrl;

        documents.push(shopPhotoUrl);

      }

      if (storeFrontUrl) {

        documentUrls.storeFront = storeFrontUrl;

        documents.push(storeFrontUrl);

      }

      if (warehousePhotoUrl) {

        documentUrls.warehouse = warehousePhotoUrl;

        documents.push(warehousePhotoUrl);

      }



      const sharedFields = {

        ownerName: basic.fullName,

        phoneNumber: `+880${basic.phone.replace(/^0+/, "")}`,

        tradeLicenseNumber: verification.tradeLicenseName || undefined,

        documents,

        documentUrls,

        profilePhotoUrl: profilePhotoUrl || undefined,

        email: basic.email || undefined,

        dateOfBirth: basic.dateOfBirth || undefined,

        gender: (basic.gender as "male" | "female" | "other") || undefined,

        personalAddress: basic.personalLocation.address || undefined,

        personalLatitude: basic.personalLocation.latitude

          ? String(basic.personalLocation.latitude)

          : undefined,

        personalLongitude: basic.personalLocation.longitude

          ? String(basic.personalLocation.longitude)

          : undefined,

        personalArea: basic.personalLocation.area || undefined,

        personalDistrict: basic.personalLocation.district || undefined,

        personalDivision: basic.personalLocation.division || undefined,

        personalPostCode: basic.personalLocation.postCode || undefined,

        businessNature: business.businessNature as

          | "retail_shop"

          | "wholesaler"

          | "distributor"

          | "manufacturer"

          | "importer",

        productTypeId: business.productTypeId!,

        yearsInBusiness: business.yearsInBusiness || undefined,

        monthlyRevenue: business.monthlyRevenue || undefined,

        latitude: business.businessLocation.latitude

          ? String(business.businessLocation.latitude)

          : undefined,

        longitude: business.businessLocation.longitude

          ? String(business.businessLocation.longitude)

          : undefined,

        area: business.businessLocation.area || undefined,

        district: business.businessLocation.district || undefined,

        division: business.businessLocation.division || undefined,

        postCode: business.businessLocation.postCode || undefined,

        selectedPlan: "free_trial",

        binNumber: verification.binNumber || undefined,

        tinNumber: verification.tinNumber || undefined,

        bankName: verification.bankName || undefined,

        bankAccountName: verification.bankAccountName || undefined,

        bankAccountNumber: verification.bankAccountNumber || undefined,

        referralId: verification.referralId || undefined,

        referralName: verification.referralName || undefined,

        referralPhone: verification.referralPhone || undefined,

        facebookUrl: verification.facebookUrl || undefined,

        whatsappNumber: verification.whatsappNumber || undefined,

        instagramUrl: verification.instagramUrl || undefined,

        websiteUrl: verification.websiteUrl || undefined,

        tiktokUrl: verification.tiktokUrl || undefined,

        twitterUrl: verification.twitterUrl || undefined,

      };



      let applicationNumber: string | null | undefined;



      if (isWarehouse) {

        const result = await client.warehouseApplication.submit({

          warehouseName: business.shopName,

          warehouseAddress: business.businessLocation.address,

          ...sharedFields,

        });

        applicationNumber = result.applicationNumber;

      } else {

        const result = await client.sellerApplication.submit({

          shopName: business.shopName,

          businessType: "retail",

          shopAddress: business.businessLocation.address,

          ...sharedFields,

        });

        applicationNumber = result.applicationNumber;

      }



      if (applicationNumber) {

        sessionStorage.setItem("b2b_application_number", applicationNumber);

      }



      toast.success("Application submitted successfully!");

      router.push("/b2b/register/success");

    } catch (error: unknown) {

      const message =

        error instanceof Error

          ? error.message

          : "Something went wrong. Please try again.";

      toast.error(message);

      throw error;

    }

  };



  const renderStep = () => {

    switch (currentStep) {

      case 1:

        return (

          <StepBasicInfo

            data={formData.basic}

            onUpdate={(basic) => setFormData((prev) => ({ ...prev, basic }))}

            onNext={handleNext}

          />

        );

      case 2:

        return (

          <StepBusinessProfile

            data={formData.business}

            onUpdate={(business) =>

              setFormData((prev) => ({ ...prev, business }))

            }

            onNext={handleNext}

            onBack={handleBack}

          />

        );

      case 3:

        return (

          <StepVerification

            data={formData.verification}

            onUpdate={(verification) =>

              setFormData((prev) => ({ ...prev, verification }))

            }

            onNext={handleNext}

            onBack={handleBack}

          />

        );

      case 4:

        return (

          <StepReview

            formData={{

              basic: {

                phone: formData.basic.phone,

                fullName: formData.basic.fullName,

                email: formData.basic.email,

                dateOfBirth: formData.basic.dateOfBirth,

                gender: formData.basic.gender,

                personalLocation: formData.basic.personalLocation,

                profilePhotoName: formData.basic.profilePhoto?.name || "",

              },

              business: formData.business,

              verification: formData.verification,

            }}

            onEdit={goToStep}

            onSubmit={handleSubmit}

            onBack={handleBack}

          />

        );

      default:

        return null;

    }

  };



  const stepMeta = STEP_TITLES[currentStep];



  return (

    <section className="px-4 py-8 sm:py-12">

      <div className="mx-auto max-w-5xl">

        <div className="mb-8 lg:hidden">

          <RegistrationPageHeader

            title="Create business seller account"

            description="Complete all steps to apply as a seller on Bikalpo."

          />

        </div>



        <div className="mb-6 lg:hidden">

          <RegistrationStepNav

            currentStep={currentStep}

            completedSteps={completedSteps}

            onStepClick={goToStep}

            orientation="horizontal"

          />

        </div>



        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">

          <aside className="hidden lg:block">

            <RegistrationPageHeader

              title="Create business seller account"

              description="Complete all steps to apply as a seller on Bikalpo."

              className="mb-8"

            />

            <RegistrationStepNav

              currentStep={currentStep}

              completedSteps={completedSteps}

              onStepClick={goToStep}

              orientation="vertical"

            />

          </aside>



          <div className="rounded-lg border border-border bg-card p-6 sm:p-8">

            <div
              ref={stepTopRef}
              className="mb-6 border-b border-border pb-6 scroll-mt-20 md:scroll-mt-[88px]"
            >

              <p className="text-xs font-medium text-muted-foreground">

                Step {currentStep} of {REGISTRATION_STEPS.length}

              </p>

              <h2
                ref={stepTitleRef}
                tabIndex={-1}
                className="mt-1 text-lg font-semibold text-foreground outline-none"
              >

                {stepMeta.title}

              </h2>

              <p className="mt-1 text-sm text-muted-foreground">

                {stepMeta.description}

              </p>

            </div>

            {renderStep()}

          </div>

        </div>



        <p className="mt-6 text-center text-xs text-muted-foreground">

          Already have an account?{" "}

          <Link href="/b2b/login" className="font-medium text-primary hover:underline">

            Sign in

          </Link>

        </p>

      </div>

    </section>

  );

}

