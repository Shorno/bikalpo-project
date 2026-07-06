"use client";



import { FileText, Upload, X } from "lucide-react";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

import { Field, FieldGroup } from "@/components/ui/field";

import { Input } from "@/components/ui/input";

import { BANKS } from "@/constants/seller-registration";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  RegistrationActions,

  RegistrationFieldLabel,

  RegistrationSection,

} from "./registration-primitives";



export interface StepVerificationData {

  tradeLicense: File | null;

  tradeLicenseName: string;

  binNumber: string;

  tinNumber: string;

  nidDocument: File | null;

  nidDocumentName: string;

  shopPhoto: File | null;

  shopPhotoName: string;

  storeFrontPhoto: File | null;

  storeFrontPhotoName: string;

  warehousePhoto: File | null;

  warehousePhotoName: string;

  bankName: string;

  bankAccountName: string;

  bankAccountNumber: string;

  referralId: string;

  referralName: string;

  referralPhone: string;

  facebookUrl: string;

  whatsappNumber: string;

  instagramUrl: string;

  websiteUrl: string;

  tiktokUrl: string;

  twitterUrl: string;

}



interface StepVerificationProps {

  data: StepVerificationData;

  onUpdate: (data: StepVerificationData) => void;

  onNext: () => void;

  onBack: () => void;

}



interface FileUploadRowProps {

  label: string;

  description?: string;

  required?: boolean;

  optional?: boolean;

  fileName: string;

  accept?: string;

  onFileSelect: (file: File) => void;

  onRemove: () => void;

}



function FileUploadRow({

  label,

  description,

  required,

  optional,

  fileName,

  accept = "image/*,.pdf",

  onFileSelect,

  onRemove,

}: FileUploadRowProps) {

  const inputRef = useRef<HTMLInputElement>(null);



  return (

    <div className="flex items-center gap-3 rounded-lg border border-border p-3">

      <input

        ref={inputRef}

        type="file"

        accept={accept}

        className="hidden"

        onChange={(e) => {

          const file = e.target.files?.[0];

          if (file) onFileSelect(file);

        }}

      />

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">

        <FileText className="h-4 w-4 text-muted-foreground" />

      </div>

      <div className="min-w-0 flex-1">

        <p className="text-sm font-medium text-foreground">

          {label}

          {required ? <span className="text-destructive"> *</span> : null}

          {optional ? (

            <span className="font-normal text-muted-foreground"> (optional)</span>

          ) : null}

        </p>

        {fileName ? (

          <p className="truncate text-xs text-muted-foreground">{fileName}</p>

        ) : (

          description && (

            <p className="text-xs text-muted-foreground">{description}</p>

          )

        )}

      </div>

      {fileName ? (

        <div className="flex shrink-0 gap-1">

          <Button

            type="button"

            variant="outline"

            size="sm"

            onClick={() => inputRef.current?.click()}

          >

            Replace

          </Button>

          <Button

            type="button"

            variant="ghost"

            size="icon-sm"

            onClick={onRemove}

            aria-label={`Remove ${label}`}

          >

            <X className="h-4 w-4" />

          </Button>

        </div>

      ) : (

        <Button

          type="button"

          variant="outline"

          size="sm"

          onClick={() => inputRef.current?.click()}

          className="shrink-0"

        >

          <Upload className="h-4 w-4" />

          Upload

        </Button>

      )}

    </div>

  );

}



export function StepVerification({

  data,

  onUpdate,

  onNext,

  onBack,

}: StepVerificationProps) {

  const canProceed =

    data.tradeLicenseName && data.shopPhotoName && data.storeFrontPhotoName;



  return (

    <div className="w-full">

      <RegistrationSection title="Documents">

        <div className="space-y-3">

          <FileUploadRow

            label="Trade license"

            description="Business trade license document"

            required

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



          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <Field>

              <RegistrationFieldLabel optional htmlFor="binNumber">

                BIN number

              </RegistrationFieldLabel>

              <Input

                id="binNumber"

                type="text"

                value={data.binNumber}

                onChange={(e) => onUpdate({ ...data, binNumber: e.target.value })}

                placeholder="Enter BIN number"

                className="h-9"

              />

            </Field>

            <Field>

              <RegistrationFieldLabel optional htmlFor="tinNumber">

                TIN number

              </RegistrationFieldLabel>

              <Input

                id="tinNumber"

                type="text"

                value={data.tinNumber}

                onChange={(e) => onUpdate({ ...data, tinNumber: e.target.value })}

                placeholder="Enter TIN number"

                className="h-9"

              />

            </Field>

          </FieldGroup>



          <FileUploadRow

            label="National ID (NID)"

            description="Front and back of NID"

            optional

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

        </div>

      </RegistrationSection>



      <RegistrationSection title="Business photos">

        <div className="space-y-3">

          <FileUploadRow

            label="Shop photo"

            description="Interior or general shop photo"

            required

            accept="image/*"

            fileName={data.shopPhotoName}

            onFileSelect={(file) =>

              onUpdate({

                ...data,

                shopPhoto: file,

                shopPhotoName: file.name,

              })

            }

            onRemove={() =>

              onUpdate({

                ...data,

                shopPhoto: null,

                shopPhotoName: "",

              })

            }

          />

          <FileUploadRow

            label="Store front photo"

            description="Exterior storefront photo"

            required

            accept="image/*"

            fileName={data.storeFrontPhotoName}

            onFileSelect={(file) =>

              onUpdate({

                ...data,

                storeFrontPhoto: file,

                storeFrontPhotoName: file.name,

              })

            }

            onRemove={() =>

              onUpdate({

                ...data,

                storeFrontPhoto: null,

                storeFrontPhotoName: "",

              })

            }

          />

          <FileUploadRow

            label="Warehouse photo"

            description="Storage or warehouse area"

            optional

            accept="image/*"

            fileName={data.warehousePhotoName}

            onFileSelect={(file) =>

              onUpdate({

                ...data,

                warehousePhoto: file,

                warehousePhotoName: file.name,

              })

            }

            onRemove={() =>

              onUpdate({

                ...data,

                warehousePhoto: null,

                warehousePhotoName: "",

              })

            }

          />

        </div>

      </RegistrationSection>



      <RegistrationSection title="Bank account">

        <FieldGroup>

          <Field>

            <RegistrationFieldLabel optional>Bank name</RegistrationFieldLabel>

            <Select

              value={data.bankName}

              onValueChange={(value) => onUpdate({ ...data, bankName: value })}

            >

              <SelectTrigger className="h-9 w-full">

                <SelectValue placeholder="Select bank" />

              </SelectTrigger>

              <SelectContent>

                {BANKS.map((bank) => (

                  <SelectItem key={bank} value={bank}>

                    {bank}

                  </SelectItem>

                ))}

              </SelectContent>

            </Select>

          </Field>

          <Field>

            <RegistrationFieldLabel optional htmlFor="bankAccountName">

              Account name

            </RegistrationFieldLabel>

            <Input

              id="bankAccountName"

              type="text"

              value={data.bankAccountName}

              onChange={(e) =>

                onUpdate({ ...data, bankAccountName: e.target.value })

              }

              placeholder="Account name"

              className="h-9"

            />

          </Field>

          <Field>

            <RegistrationFieldLabel optional htmlFor="bankAccountNumber">

              Account number

            </RegistrationFieldLabel>

            <Input

              id="bankAccountNumber"

              type="text"

              value={data.bankAccountNumber}

              onChange={(e) =>

                onUpdate({ ...data, bankAccountNumber: e.target.value })

              }

              placeholder="Account number"

              className="h-9"

            />

          </Field>

        </FieldGroup>

      </RegistrationSection>



      <RegistrationSection title="Referral">

        <FieldGroup>

          <Field>

            <RegistrationFieldLabel optional htmlFor="referralId">

              Referral ID

            </RegistrationFieldLabel>

            <Input

              id="referralId"

              type="text"

              value={data.referralId}

              onChange={(e) => onUpdate({ ...data, referralId: e.target.value })}

              placeholder="Referral ID"

              className="h-9"

            />

          </Field>

          <Field>

            <RegistrationFieldLabel optional htmlFor="referralName">

              Referral seller / agent name

            </RegistrationFieldLabel>

            <Input

              id="referralName"

              type="text"

              value={data.referralName}

              onChange={(e) =>

                onUpdate({ ...data, referralName: e.target.value })

              }

              placeholder="Referral seller / agent name"

              className="h-9"

            />

          </Field>

          <Field>

            <RegistrationFieldLabel optional htmlFor="referralPhone">

              Referral phone number

            </RegistrationFieldLabel>

            <Input

              id="referralPhone"

              type="tel"

              value={data.referralPhone}

              onChange={(e) =>

                onUpdate({

                  ...data,

                  referralPhone: e.target.value.replace(/\D/g, ""),

                })

              }

              placeholder="Referral phone number"

              className="h-9"

            />

          </Field>

        </FieldGroup>

      </RegistrationSection>



      <RegistrationSection title="Social media profiles">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {(

            [

              ["facebookUrl", "Facebook profile", "https://facebook.com/..."],

              ["whatsappNumber", "WhatsApp business", "+8801XXXXXXXXX"],

              ["instagramUrl", "Instagram", "https://instagram.com/..."],

              ["websiteUrl", "Website", "https://website.com"],

              ["tiktokUrl", "TikTok", "https://tiktok.com/..."],

              ["twitterUrl", "X (Twitter)", "https://x.com/..."],

            ] as const

          ).map(([key, label, placeholder]) => (

            <Field key={key}>

              <RegistrationFieldLabel optional htmlFor={key}>

                {label}

              </RegistrationFieldLabel>

              <Input

                id={key}

                type="text"

                value={data[key]}

                onChange={(e) => onUpdate({ ...data, [key]: e.target.value })}

                placeholder={placeholder}

                className="h-9"

              />

            </Field>

          ))}

        </div>

      </RegistrationSection>



      <RegistrationActions

        onBack={onBack}

        onPrimary={onNext}

        primaryLabel="Continue"

        primaryDisabled={!canProceed}

      />

    </div>

  );

}

