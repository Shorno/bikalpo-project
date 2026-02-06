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
import {
  createEmployee,
  type EmployeeRole,
} from "@/actions/admin/employee-actions";
import { Button } from "@/components/ui/button";
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

interface CreateEmployeeModalProps {
  defaultRole?: EmployeeRole;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

// Generate a random password
function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function CreateEmployeeModal({
  defaultRole,
  trigger,
  onSuccess,
}: CreateEmployeeModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error || "Failed to create employee");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      queryClient.invalidateQueries({ queryKey: ["deliverymen"] });
      toast.success("Employee created successfully");

      // Store credentials for copying
      setCreatedCredentials({
        email: form.getFieldValue("email"),
        password: form.getFieldValue("password"),
      });

      form.reset();
      router.refresh();
      onSuccess?.();
    },
    onError: () => {
      toast.error("An unexpected error occurred");
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
      // Manual validation
      if (value.name.length < 2) {
        toast.error("Name must be at least 2 characters");
        return;
      }
      if (!value.email.includes("@")) {
        toast.error("Please enter a valid email address");
        return;
      }
      if (value.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (!value.role) {
        toast.error("Please select a role");
        return;
      }
      mutation.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
        phoneNumber: value.phoneNumber || undefined,
        role: value.role,
      });
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
    form.reset();
  };

  React.useEffect(() => {
    if (!open) {
      setCreatedCredentials(null);
      setCopied(false);
      form.reset();
    }
  }, [open, form]);

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
              Add {defaultRole === "deliveryman" ? "Deliveryman" : "Salesman"}
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
            Add {defaultRole === "deliveryman" ? "Deliveryman" : "Salesman"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Create Employee
          </DialogTitle>
          <DialogDescription>
            Create a new employee account. You&apos;ll need to share the
            credentials with them manually.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-employee-form"
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
              const isInvalid =
                field.state.meta.isTouched && field.state.value.length < 2;
              return (
                <Field data-invalid={isInvalid}>
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
                  {isInvalid && (
                    <FieldError>Name must be at least 2 characters</FieldError>
                  )}
                </Field>
              );
            }}
          </form.Field>

          {/* Email */}
          <form.Field name="email">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.value.includes("@");
              return (
                <Field data-invalid={isInvalid}>
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
                  {isInvalid && (
                    <FieldError>Please enter a valid email address</FieldError>
                  )}
                </Field>
              );
            }}
          </form.Field>

          {/* Password */}
          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.value.length < 6;
              return (
                <Field data-invalid={isInvalid}>
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
                  {isInvalid && (
                    <FieldError>
                      Password must be at least 6 characters
                    </FieldError>
                  )}
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
                const isInvalid =
                  field.state.meta.isTouched && !field.state.value;
                return (
                  <Field data-invalid={isInvalid}>
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
                    {isInvalid && <FieldError>Please select a role</FieldError>}
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
            form="create-employee-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Create Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
