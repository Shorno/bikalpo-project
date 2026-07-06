"use client";



import { Loader2, Pencil } from "lucide-react";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { BUSINESS_NATURES } from "@/constants/seller-registration";

import type { StepBasicInfoData } from "./step-basic-info";

import type { StepBusinessData } from "./step-business-profile";

import type { StepVerificationData } from "./step-verification";

import {

  RegistrationActions,

  RegistrationChecklistItem,

  RegistrationReviewRow,

  RegistrationSection,

} from "./registration-primitives";



export interface RegistrationReviewData {

  basic: Pick<

    StepBasicInfoData,

    "phone" | "fullName" | "email" | "dateOfBirth" | "gender" | "personalLocation"

  > & { profilePhotoName: string };

  business: StepBusinessData;

  verification: StepVerificationData;

}



interface StepReviewProps {

  formData: RegistrationReviewData;

  onEdit: (step: number) => void;

  onSubmit: () => Promise<void>;

  onBack: () => void;

}



function ReviewBlock({

  title,

  step,

  onEdit,

  children,

}: {

  title: string;

  step: number;

  onEdit: (step: number) => void;

  children: React.ReactNode;

}) {

  return (

    <RegistrationSection

      title={title}

      className="last:border-b-0"

    >

      <div className="mb-3 flex justify-end">

        <Button

          type="button"

          variant="ghost"

          size="sm"

          onClick={() => onEdit(step)}

          className="h-8 gap-1 text-primary"

        >

          <Pencil className="h-3.5 w-3.5" />

          Edit

        </Button>

      </div>

      <dl>{children}</dl>

    </RegistrationSection>

  );

}



export function StepReview({

  formData,

  onEdit,

  onSubmit,

  onBack,

}: StepReviewProps) {

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmInfo, setConfirmInfo] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [agreePolicies, setAgreePolicies] = useState(false);



  const natureLabel =

    BUSINESS_NATURES.find((n) => n.id === formData.business.businessNature)

      ?.label || formData.business.businessNature;



  const locationSummary = [

    formData.business.businessLocation.district,

    formData.business.businessLocation.division,

  ]

    .filter(Boolean)

    .join(", ");



  const handleSubmit = async () => {

    setIsSubmitting(true);

    try {

      await onSubmit();

    } finally {

      setIsSubmitting(false);

    }

  };



  const canSubmit = confirmInfo && agreeTerms && agreePolicies;



  return (

    <div className="w-full">

      <ReviewBlock title="Applicant information" step={1} onEdit={onEdit}>

        <RegistrationReviewRow label="Applicant name" value={formData.basic.fullName} />

        <RegistrationReviewRow

          label="Mobile number"

          value={`0${formData.basic.phone.replace(/^0+/, "")}`}

        />

        <RegistrationReviewRow label="Email" value={formData.basic.email} />

        <RegistrationReviewRow

          label="Personal address"

          value={formData.basic.personalLocation.address}

        />

      </ReviewBlock>



      <ReviewBlock title="Business information" step={2} onEdit={onEdit}>

        <RegistrationReviewRow label="Business name" value={formData.business.shopName} />

        <RegistrationReviewRow label="Business nature" value={natureLabel} />

        <RegistrationReviewRow

          label="Business type"

          value={formData.business.productTypeName}

        />

        <RegistrationReviewRow

          label="Location"

          value={

            locationSummary ||

            formData.business.businessLocation.address ||

            "—"

          }

        />

        <RegistrationReviewRow

          label="Monthly sales volume"

          value={formData.business.monthlyRevenue || "—"}

        />

      </ReviewBlock>



      <ReviewBlock title="Verification checklist" step={3} onEdit={onEdit}>

        <div className="space-y-2 py-1">

          <RegistrationChecklistItem

            label="Trade license submitted"

            done={!!formData.verification.tradeLicenseName}

          />

          <RegistrationChecklistItem

            label="BIN submitted"

            done={!!formData.verification.binNumber}

          />

          <RegistrationChecklistItem

            label="Shop photo submitted"

            done={!!formData.verification.shopPhotoName}

          />

          <RegistrationChecklistItem

            label="Store front photo submitted"

            done={!!formData.verification.storeFrontPhotoName}

          />

          <RegistrationChecklistItem

            label="Bank information submitted"

            done={

              !!(

                formData.verification.bankName &&

                formData.verification.bankAccountNumber

              )

            }

          />

        </div>

      </ReviewBlock>



      <div className="mt-2 space-y-3 border-t border-border pt-6">

        <label className="flex cursor-pointer items-start gap-3">

          <input

            type="checkbox"

            checked={confirmInfo}

            onChange={(e) => setConfirmInfo(e.target.checked)}

            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"

          />

          <span className="text-sm text-muted-foreground">

            I confirm all information is correct

          </span>

        </label>

        <label className="flex cursor-pointer items-start gap-3">

          <input

            type="checkbox"

            checked={agreeTerms}

            onChange={(e) => setAgreeTerms(e.target.checked)}

            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"

          />

          <span className="text-sm text-muted-foreground">

            I agree to{" "}

            <a href="#" className="text-primary hover:underline">

              Seller Terms &amp; Conditions

            </a>

          </span>

        </label>

        <label className="flex cursor-pointer items-start gap-3">

          <input

            type="checkbox"

            checked={agreePolicies}

            onChange={(e) => setAgreePolicies(e.target.checked)}

            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"

          />

          <span className="text-sm text-muted-foreground">

            I agree to{" "}

            <a href="#" className="text-primary hover:underline">

              Marketplace Policies

            </a>

          </span>

        </label>

      </div>



      <RegistrationActions

        onBack={onBack}

        onPrimary={handleSubmit}

        primaryLabel={isSubmitting ? "Submitting..." : "Submit application"}

        primaryDisabled={!canSubmit || isSubmitting}

      />

      {isSubmitting && (

        <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">

          <Loader2 className="h-3.5 w-3.5 animate-spin" />

          Uploading documents and submitting...

        </p>

      )}

    </div>

  );

}

