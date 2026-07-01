"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

type EmployeeRole = "salesman" | "deliveryman";
type EmployeeFormValues = {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: EmployeeRole;
};

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateWarehouseEmployeeModalProps {
  defaultRole?: EmployeeRole;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getNameError(value: string, showRequired: boolean) {
  const name = value.trim();
  if (!name) {
    return showRequired ? "Name is required" : null;
  }
  if (name.length < MIN_NAME_LENGTH) {
    return `Name must be at least ${MIN_NAME_LENGTH} characters`;
  }
  return null;
}

function getEmailError(value: string, showRequired: boolean) {
  const email = value.trim();
  if (!email) {
    return showRequired ? "Email is required" : null;
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

function getPasswordError(value: string, showRequired: boolean) {
  if (!value) {
    return showRequired ? "Password is required" : null;
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function shouldShowFieldError(isBlurred: boolean, submitAttempted: boolean) {
  return submitAttempted || isBlurred;
}

function validateEmployeeForm(value: EmployeeFormValues) {
  const nameError = getNameError(value.name, true);
  if (nameError) return { message: nameError };

  const emailError = getEmailError(value.email, true);
  if (emailError) return { message: emailError };

  const passwordError = getPasswordError(value.password, true);
  if (passwordError) return { message: passwordError };

  if (!value.role) return { message: "Please select a role" };

  return {
    payload: {
      name: value.name.trim(),
      email: value.email.trim(),
      password: value.password,
      phoneNumber: value.phoneNumber.trim() || undefined,
      role: value.role,
    },
  };
}

export function CreateWarehouseEmployeeModal({
  defaultRole,
  trigger,
  onSuccess,
}: CreateWarehouseEmployeeModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
  } | null>(null);

  const mutation = useMutation({
    ...orpc.warehouseEmployee.create.mutationOptions(),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: orpc.warehouseEmployee.key() });
      toast.success(result.message || "Employee created successfully");

      setCreatedCredentials({
        email: variables.email,
        password: variables.password,
      });

      setSubmitAttempted(false);
      form.reset();
      router.refresh();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phoneNumber: "",
      role: defaultRole || ("salesman" as EmployeeRole),
    },
    onSubmit: async ({ value }) => {
      setSubmitAttempted(true);

      const validation = validateEmployeeForm(value);
      if ("message" in validation) {
        toast.error(validation.message);
        return;
      }

      mutation.mutate(validation.payload);
    },
  });

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    form.setFieldValue("password", newPassword);
    setShowPassword(true);
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;

    const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    setCreatedCredentials(null);
    setCopied(false);
    setSubmitAttempted(false);
    form.reset();
  };

  React.useEffect(() => {
    if (!open) {
      setCreatedCredentials(null);
      setCopied(false);
      setSubmitAttempted(false);
      form.reset();
    }
  }, [open, form]);

  const roleLabel = defaultRole === "deliveryman" ? "Deliveryman" : "Salesman";

  // Credentials success screen
  if (createdCredentials) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        {trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 size-4" />
              Add {roleLabel}
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="size-5" />
              Employee Created!
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the employee to allow them to log in.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Email</p>
              <p className="font-mono text-sm">{createdCredentials.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Password
              </p>
              <p className="font-mono text-sm">{createdCredentials.password}</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyCredentials}
            >
              {copied ? (
                <Check className="mr-2 size-4 text-green-600" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {copied ? "Copied!" : "Copy Credentials"}
            </Button>
            <Button onClick={handleClose} className="flex-1">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="mr-2 size-4" />
            Add {roleLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Add {roleLabel}
          </DialogTitle>
          <DialogDescription>
            Create a new {roleLabel.toLowerCase()} account for your warehouse.
            You&apos;ll need to share the credentials with them manually.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-warehouse-employee-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Name */}
          <form.Field name="name">
            {(field) => {
              const error = shouldShowFieldError(
                field.state.meta.isBlurred,
                submitAttempted,
              )
                ? getNameError(field.state.value, submitAttempted)
                : null;
              return (
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>Name *</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter employee name"
                    autoComplete="off"
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              );
            }}
          </form.Field>

          {/* Email */}
          <form.Field name="email">
            {(field) => {
              const error = shouldShowFieldError(
                field.state.meta.isBlurred,
                submitAttempted,
              )
                ? getEmailError(field.state.value, submitAttempted)
                : null;
              return (
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>Email *</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="employee@example.com"
                    autoComplete="off"
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              );
            }}
          </form.Field>

          {/* Password */}
          <form.Field name="password">
            {(field) => {
              const error = shouldShowFieldError(
                field.state.meta.isBlurred,
                submitAttempted,
              )
                ? getPasswordError(field.state.value, submitAttempted)
                : null;
              return (
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>Password *</FieldLabel>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={field.name}
                        name={field.name}
                        type={showPassword ? "text" : "password"}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter password"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4 text-muted-foreground" />
                        ) : (
                          <Eye className="size-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGeneratePassword}
                      title="Generate password"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              );
            }}
          </form.Field>

          {/* Phone Number */}
          <form.Field name="phoneNumber">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Phone Number</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="tel"
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="+880 1XXX-XXXXXX"
                  autoComplete="off"
                />
              </Field>
            )}
          </form.Field>

          {/* Role - only show if no defaultRole provided */}
          {!defaultRole && (
            <form.Field name="role">
              {(field) => {
                const error =
                  submitAttempted && !field.state.value
                    ? "Please select a role"
                    : null;
                return (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={field.name}>Role *</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) =>
                        field.handleChange(val as EmployeeRole)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salesman">Salesman</SelectItem>
                        <SelectItem value="deliveryman">Deliveryman</SelectItem>
                      </SelectContent>
                    </Select>
                    {error && <FieldError>{error}</FieldError>}
                  </Field>
                );
              }}
            </form.Field>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-warehouse-employee-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Create {roleLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
