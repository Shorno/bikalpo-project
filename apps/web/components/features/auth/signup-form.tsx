"use client";
import { useForm } from "@tanstack/react-form";
import { Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { signupSchema } from "@/schema/auth.schema";
import { AuthTabs } from "./auth-tabs";

export function SignupForm() {
  const [isPending, startTransition] = useTransition();
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      shopName: "",
      ownerName: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: signupSchema,
    },
    onSubmit: async ({ value }) => {
      if (!agreeToTerms) {
        toast.error("Please agree to Terms & Privacy Policy");
        return;
      }

      startTransition(async () => {
        const { error } = await authClient.signUp.email(
          {
            email: value.email,
            password: value.password,
            name: value.name,
            shopName: value.shopName || undefined,
            ownerName: value.ownerName || undefined,
            phoneNumber: value.phoneNumber,
          },
          {
            onSuccess: () => {
              toast.success("Account created successfully!");

              // Redirect to pending approval page
              // New users have role="guest" and need admin approval
              // Use window.location.href to force full page reload and ensure cookies are set
              window.location.href = "/pending-approval";
            },
            onError: (ctx) => {
              toast.error(ctx.error.message);
            },
          },
        );

        if (error) {
          toast.error(error.message || "Failed to create account");
        }
      });
    },
  });

  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8">
      <div className="flex w-full flex-col items-center gap-4 px-4 md:gap-6 md:px-0">
        <h1 className="text-center font-inter text-xl font-semibold leading-[130%] text-black md:text-2xl">
          Create Your B2B Account
        </h1>

        <AuthTabs />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="w-full max-w-md px-4"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-4">
                {/* Name Field */}
                <form.Field name="name">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
                        >
                          Full Name
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="Enter your full name"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="name"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Email Field */}
                <form.Field name="email">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
                        >
                          Email
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="email"
                          placeholder="Enter your email"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="email"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Phone Number Field */}
                <form.Field name="phoneNumber">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
                        >
                          Phone Number (WhatsApp)
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="tel"
                          placeholder="Enter Phone Number"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="tel"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Shop Name Field (Optional) */}
                <form.Field name="shopName">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
                        >
                          Shop Name{" "}
                          <span className="text-sm text-gray-500">
                            (Optional)
                          </span>
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="Enter Shop Name"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="organization"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Owner Name Field (Optional) */}
                <form.Field name="ownerName">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
                        >
                          Owner Name{" "}
                          <span className="text-sm text-gray-500">
                            (Optional)
                          </span>
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="Enter Owner Name"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="name"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Password Field */}
                <form.Field name="password">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-lg font-medium leading-[160%] text-black"
                        >
                          Password
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          placeholder="Enter Password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="new-password"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                {/* Confirm Password Field */}
                <form.Field name="confirmPassword">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-3">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-lg font-medium leading-[160%] text-black"
                        >
                          Confirm Password
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          placeholder="Confirm Password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          autoComplete="new-password"
                          disabled={isPending}
                          className="h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map((e: any) =>
                                typeof e === "string" ? e : e?.message || "",
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="agree-terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked: boolean) =>
                    setAgreeToTerms(checked === true)
                  }
                />
                <label
                  htmlFor="agree-terms"
                  className="font-inter text-sm font-medium leading-[160%] text-black"
                >
                  I agree to Terms & Privacy Policy
                </label>
              </div>
            </div>

            {/* Register Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-lg bg-[#1E62C3] px-6 py-2 font-inter text-sm font-semibold text-white hover:bg-[#1E62C3]/90"
            >
              {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Register Account
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-24 border-t border-gray-300" />
            <span className="font-inter text-sm font-medium text-gray-500">
              OR
            </span>
            <div className="h-px w-24 border-t border-gray-300" />
          </div>

          {/* QR Code Section */}
          <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-3">
            <div className="relative h-[120px] w-[120px]">
              <Image
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='10' fill='%23666'%3EQR Code%3C/text%3E%3C/svg%3E"
                alt="QR Code"
                fill
                className="object-contain"
              />
            </div>
            <p className="text-center font-inter text-lg font-semibold leading-[140%] text-black">
              Scan your assigned QR to open login page.
            </p>
          </div>

          {/* Login Link */}
          <p className="text-center font-inter text-xs font-medium leading-[160%] text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1E62C3] font-semibold">
              Login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
