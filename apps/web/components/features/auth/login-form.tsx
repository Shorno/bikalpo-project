"use client";
import { useForm } from "@tanstack/react-form";
import { Loader } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/schema/auth.schema";
import { AuthTabs } from "./auth-tabs";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

/**
 * Returns the redirect path based on user role.
 * All roles stay within the single app — route-based separation.
 */
function getRedirectForRole(role: string): string {
  switch (role) {
    case "consumer":
      return "/";
    case "shop_owner":
      return "/dashboard";
    case "admin":
      return "/dashboard";
    case "salesman":
      return "/dashboard";
    case "deliveryman":
      return "/dashboard";
    case "warehouse":
      return "/dashboard";
    default:
      return "/";
  }
}

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const _router = useRouter();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const { error, data } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        });

        if (error) {
          toast.error(error.message || "Invalid email or password");
          return;
        }

        toast.success("Logged in successfully!");

        const user = data?.user as { role?: string } | undefined;
        const role = user?.role || "consumer";

        // Shop owners go to shop subdomain
        if (role === "shop_owner") {
          const shopDomain =
            process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL ||
            "http://shop.bikalpo.localhost:3001";
          window.location.href = shopDomain;
          return;
        }

        const redirect = getRedirectForRole(role);
        // Use window.location for full page reload to ensure cookies are set
        window.location.href = redirect;
      });
    },
  });

  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8">
      <div className="flex w-full flex-col items-center gap-4 px-4 md:gap-6 md:px-0">
        <h1 className="text-center font-inter text-xl font-semibold leading-[130%] text-black md:text-2xl">
          Login to Your Account
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
                {/* Email Field */}
                <form.Field name="email">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <div className="flex flex-col gap-1.5">
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
                          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map(getErrorMessage)
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
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={field.name}
                          className="font-inter text-sm font-medium leading-[160%] text-black"
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
                          autoComplete="current-password"
                          disabled={isPending}
                          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 font-inter text-sm font-normal text-gray-900 placeholder:text-[#8B8B8B]"
                        />
                        {isInvalid && (
                          <p className="text-sm text-red-500">
                            {field.state.meta.errors
                              .map(getErrorMessage)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="font-inter text-xs font-medium leading-[160%] text-[#1E62C3]"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-lg bg-[#1E62C3] px-6 py-2 font-inter text-sm font-semibold text-white hover:bg-[#1E62C3]/90"
            >
              {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Login
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

          {/* Alternative Login Options */}
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-6 py-2 font-inter text-sm font-medium text-black hover:bg-gray-50"
              disabled
            >
              Login with QR
            </Button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center font-inter text-xs font-medium leading-[160%] text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-[#1E62C3] font-semibold">
              Register Now
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
