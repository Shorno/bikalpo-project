"use client";
import { useForm } from "@tanstack/react-form";
import { Building2, CheckCircle, FileText, Loader, Loader2, MapPin, Pencil, Store, Upload, XIcon } from "lucide-react";
import { CldImage } from "next-cloudinary";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getPublicIdFromUrl } from "@/utils/getPublicIdFromUrl";
import { sellerApplicationSchema } from "@/schema/auth.schema";
import { client } from "@/utils/orpc";

function getErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        return typeof message === "string" ? message : "";
    }
    return "";
}

const STEPS = [
    { id: 1, title: "Business Info", icon: Store },
    { id: 2, title: "Contact & Location", icon: MapPin },
    { id: 3, title: "Documents", icon: Upload },
    { id: 4, title: "Review", icon: CheckCircle },
] as const;

interface BusinessApplicationFormProps {
    initialData?: {
        shopName: string;
        ownerName: string;
        phoneNumber: string;
        businessType: "retail" | "restaurant";
        shopAddress: string;
        tradeLicenseNumber: string;
        documents: string[];
    };
    isEditMode?: boolean;
}

function DocumentUploadField({ field }: { field: { state: { value: string[] }; handleChange: (value: string[]) => void } }) {
    const docs = field.state.value;
    const maxFiles = 5;
    const maxSizeMB = 10;

    const [isUploading, setIsUploading] = useState(false);
    const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

    const handleUpload = useCallback(async (file: File) => {
        if (docs.length >= maxFiles) {
            toast.error(`Maximum ${maxFiles} documents allowed`);
            return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            toast.error(`File too large. Max ${maxSizeMB}MB`);
            return;
        }
        setIsUploading(true);
        try {
            const result = await client.cloudinary.upload({
                file,
                folder: "seller-documents",
            });
            if (result.success) {
                field.handleChange([...docs, result.url]);
                toast.success("Document uploaded");
            } else {
                toast.error(result.error || "Upload failed");
            }
        } catch {
            toast.error("Upload failed");
        } finally {
            setIsUploading(false);
        }
    }, [docs, field]);

    const handleRemove = useCallback(async (url: string) => {
        setDeletingUrl(url);
        const publicId = getPublicIdFromUrl(url);
        if (publicId) {
            try {
                await client.cloudinary.delete({ publicId });
            } catch { /* ignore delete errors */ }
        }
        field.handleChange(docs.filter((d) => d !== url));
        setDeletingUrl(null);
        toast.success("Document removed");
    }, [docs, field]);

    const getFilename = (url: string) => {
        const parts = url.split("/");
        const last = parts[parts.length - 1] || "document";
        return last.split(".")[0].replace(/v\d+\//, "").slice(0, 28);
    };

    return (
        <div className="space-y-2">
            <Label>
                Upload Documents{" "}
                <span className="text-sm text-gray-500">(Optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
                Trade license, NID, business registration, shop photo, etc.
            </p>

            {/* Uploaded documents list */}
            {docs.length > 0 && (
                <div className="space-y-2">
                    {docs.map((url, idx) => (
                        <div
                            key={url}
                            className="flex items-center gap-3 rounded-lg border bg-gray-50 p-2"
                        >
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white">
                                <CldImage
                                    src={url}
                                    alt={`Document ${idx + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium">
                                    Document {idx + 1}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {getFilename(url)}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
                                disabled={deletingUrl === url}
                                onClick={() => handleRemove(url)}
                            >
                                {deletingUrl === url ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <XIcon className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload button / drop zone */}
            {docs.length < maxFiles && (
                <div
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-center transition-colors hover:border-[#1E62C3] hover:bg-blue-50/50"
                    onClick={() => {
                        if (isUploading) return;
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/jpeg,image/jpg,image/png,image/webp";
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleUpload(file);
                        };
                        input.click();
                    }}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin text-[#1E62C3]" />
                            <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-500">
                                Click to upload ({docs.length}/{maxFiles})
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function BusinessApplicationForm({ initialData, isEditMode }: BusinessApplicationFormProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm({
        defaultValues: {
            shopName: initialData?.shopName || "",
            ownerName: initialData?.ownerName || "",
            phoneNumber: initialData?.phoneNumber || "",
            businessType: (initialData?.businessType || "") as "retail" | "restaurant",
            shopAddress: initialData?.shopAddress || "",
            tradeLicenseNumber: initialData?.tradeLicenseNumber || "",
            documents: initialData?.documents || [] as string[],
        },
        validators: {
            //@ts-ignore
            onSubmit: sellerApplicationSchema,
        },
        onSubmit: async ({ value }) => {
            startTransition(async () => {
                try {
                    if (isEditMode) {
                        await client.sellerApplication.update(value);
                        toast.success("Application updated successfully!");
                    } else {
                        await client.sellerApplication.submit(value);
                        toast.success("Application submitted successfully!");
                    }
                    router.push("/application-status");
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Something went wrong. Please try again.";
                    toast.error(message);
                }
            });
        },
    });

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    return (
        <div className="mx-auto w-full max-w-2xl">
            {/* Step Indicator */}
            <div className="mb-8 flex items-center justify-between">
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;

                    return (
                        <div key={step.id} className="flex items-center">
                            <div className="flex flex-col items-center gap-1.5">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${isActive
                                        ? "border-[#1E62C3] bg-[#1E62C3] text-white"
                                        : isCompleted
                                            ? "border-green-500 bg-green-500 text-white"
                                            : "border-gray-300 bg-white text-gray-400"
                                        }`}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="h-5 w-5" />
                                    ) : (
                                        <Icon className="h-5 w-5" />
                                    )}
                                </div>
                                <span
                                    className={`text-xs font-medium ${isActive ? "text-[#1E62C3]" : isCompleted ? "text-green-600" : "text-gray-400"
                                        }`}
                                >
                                    {step.title}
                                </span>
                            </div>
                            {index < STEPS.length - 1 && (
                                <div
                                    className={`mx-2 h-0.5 w-12 sm:w-20 ${isCompleted ? "bg-green-500" : "bg-gray-200"
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onKeyDown={(e) => {
                    // Prevent Enter key from triggering any form submission
                    if (e.key === "Enter") {
                        e.preventDefault();
                    }
                }}
            >
                {/* Step 1: Business Info */}
                {currentStep === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Store className="h-5 w-5 text-[#1E62C3]" />
                                Business Information
                            </CardTitle>
                            <CardDescription>
                                Tell us about your business
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Shop Name */}
                            <form.Field name="shopName">
                                {(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <div className="space-y-2">
                                            <Label htmlFor={field.name}>Shop / Business Name *</Label>
                                            <Input
                                                id={field.name}
                                                placeholder="Enter your shop or business name"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                aria-invalid={isInvalid}
                                            />
                                            {isInvalid && (
                                                <p className="text-sm text-red-500">
                                                    {field.state.meta.errors.map(getErrorMessage).filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }}
                            </form.Field>

                            {/* Owner Name */}
                            <form.Field name="ownerName">
                                {(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <div className="space-y-2">
                                            <Label htmlFor={field.name}>Owner Name *</Label>
                                            <Input
                                                id={field.name}
                                                placeholder="Enter the business owner's name"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                aria-invalid={isInvalid}
                                            />
                                            {isInvalid && (
                                                <p className="text-sm text-red-500">
                                                    {field.state.meta.errors.map(getErrorMessage).filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }}
                            </form.Field>

                            {/* Business Type */}
                            <form.Field name="businessType">
                                {(field) => (
                                    <div className="space-y-3">
                                        <Label>Business Type *</Label>
                                        <RadioGroup
                                            value={field.state.value}
                                            onValueChange={(val) => field.handleChange(val as "retail" | "restaurant")}
                                            className="grid grid-cols-2 gap-4"
                                        >
                                            <Label
                                                htmlFor="type-retail"
                                                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${field.state.value === "retail"
                                                    ? "border-[#1E62C3] bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <RadioGroupItem value="retail" id="type-retail" className="sr-only" />
                                                <Store className="h-8 w-8 text-[#1E62C3]" />
                                                <span className="text-sm font-medium">Retail Shop</span>
                                                <span className="text-center text-xs text-gray-500">
                                                    Buy wholesale & sell to consumers
                                                </span>
                                            </Label>

                                            <Label
                                                htmlFor="type-restaurant"
                                                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${field.state.value === "restaurant"
                                                    ? "border-[#1E62C3] bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <RadioGroupItem value="restaurant" id="type-restaurant" className="sr-only" />
                                                <Building2 className="h-8 w-8 text-[#1E62C3]" />
                                                <span className="text-sm font-medium">Restaurant</span>
                                                <span className="text-center text-xs text-gray-500">
                                                    Buy wholesale for your business
                                                </span>
                                            </Label>
                                        </RadioGroup>
                                    </div>
                                )}
                            </form.Field>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Contact & Location */}
                {currentStep === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-[#1E62C3]" />
                                Contact & Location
                            </CardTitle>
                            <CardDescription>
                                Where is your business located?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Phone Number */}
                            <form.Field name="phoneNumber">
                                {(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <div className="space-y-2">
                                            <Label htmlFor={field.name}>Business Phone Number *</Label>
                                            <Input
                                                id={field.name}
                                                type="tel"
                                                placeholder="Enter business phone number"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                aria-invalid={isInvalid}
                                            />
                                            {isInvalid && (
                                                <p className="text-sm text-red-500">
                                                    {field.state.meta.errors.map(getErrorMessage).filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }}
                            </form.Field>

                            {/* Shop Address */}
                            <form.Field name="shopAddress">
                                {(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <div className="space-y-2">
                                            <Label htmlFor={field.name}>Shop Address *</Label>
                                            <Textarea
                                                id={field.name}
                                                placeholder="Enter full shop address including area, road, and city"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                aria-invalid={isInvalid}
                                                rows={3}
                                            />
                                            {isInvalid && (
                                                <p className="text-sm text-red-500">
                                                    {field.state.meta.errors.map(getErrorMessage).filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }}
                            </form.Field>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Documents */}
                {currentStep === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-[#1E62C3]" />
                                Documents
                            </CardTitle>
                            <CardDescription>
                                Provide your business documents (optional but recommended)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Trade License */}
                            <form.Field name="tradeLicenseNumber">
                                {(field) => (
                                    <div className="space-y-2">
                                        <Label htmlFor={field.name}>
                                            Trade License Number{" "}
                                            <span className="text-sm text-gray-500">(Optional)</span>
                                        </Label>
                                        <Input
                                            id={field.name}
                                            placeholder="Enter trade license number"
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            {/* Document upload — list layout */}
                            <form.Field name="documents">
                                {(field) => (
                                    <DocumentUploadField field={field} />
                                )}
                            </form.Field>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4: Review */}
                {currentStep === 4 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-[#1E62C3]" />
                                Review Your Application
                            </CardTitle>
                            <CardDescription>
                                Please review your information before submitting
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form.Subscribe selector={(state) => state.values}>
                                {(values) => (
                                    <div className="space-y-3">
                                        <div className="rounded-lg bg-gray-50 p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-gray-700">Business Details</h4>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto px-2 py-1 text-xs text-[#1E62C3]"
                                                    onClick={() => setCurrentStep(1)}
                                                >
                                                    <Pencil className="mr-1 h-3 w-3" />
                                                    Edit
                                                </Button>
                                            </div>
                                            <div className="space-y-1.5 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Shop Name</span>
                                                    <span className="font-medium">{values.shopName || "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Owner</span>
                                                    <span className="font-medium">{values.ownerName || "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Type</span>
                                                    <Badge variant="outline" className="capitalize">
                                                        {values.businessType || "—"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg bg-gray-50 p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-gray-700">Contact & Location</h4>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto px-2 py-1 text-xs text-[#1E62C3]"
                                                    onClick={() => setCurrentStep(2)}
                                                >
                                                    <Pencil className="mr-1 h-3 w-3" />
                                                    Edit
                                                </Button>
                                            </div>
                                            <div className="space-y-1.5 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Phone</span>
                                                    <span className="font-medium">{values.phoneNumber || "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Address</span>
                                                    <span className="max-w-50 text-right font-medium">{values.shopAddress || "—"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {(values.tradeLicenseNumber || (values.documents && values.documents.length > 0)) && (
                                            <div className="rounded-lg bg-gray-50 p-4">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-gray-700">Documents</h4>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto px-2 py-1 text-xs text-[#1E62C3]"
                                                        onClick={() => setCurrentStep(3)}
                                                    >
                                                        <Pencil className="mr-1 h-3 w-3" />
                                                        Edit
                                                    </Button>
                                                </div>
                                                <div className="space-y-1.5 text-sm">
                                                    {values.tradeLicenseNumber && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Trade License</span>
                                                            <span className="font-medium">{values.tradeLicenseNumber}</span>
                                                        </div>
                                                    )}
                                                    {values.documents && values.documents.length > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Uploaded Files</span>
                                                            <span className="font-medium">
                                                                <FileText className="mr-1 inline h-3 w-3" />
                                                                {values.documents.length} document{values.documents.length > 1 ? "s" : ""}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </form.Subscribe>
                        </CardContent>
                    </Card>
                )}

                {/* Navigation Buttons */}
                <div className="mt-6 flex justify-between">
                    {currentStep > 1 ? (
                        <Button type="button" variant="outline" onClick={prevStep}>
                            Previous
                        </Button>
                    ) : (
                        <div />
                    )}

                    {currentStep < 4 ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            className="bg-[#1E62C3] hover:bg-[#1E62C3]/90"
                        >
                            Next
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            disabled={isPending}
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => form.handleSubmit()}
                        >
                            {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? "Update Application" : "Submit Application"}
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
