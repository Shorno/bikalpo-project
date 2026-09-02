"use client";

import {
  AUTO_LOGOUT_OPTIONS,
  LOGIN_VERIFICATION_OPTIONS,
  type LoginSecurityPreferences,
  loginSecurityPreferencesAreEqual,
  normalizeLoginSecurityPreferences,
} from "@bikalpo-project/auth/login-security-policy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/utils/orpc";

const DEFAULT_PREFERENCES = normalizeLoginSecurityPreferences({});

export function LoginSecurityPreferencesPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.shopOwner.getLoginSecurityPreferences.queryOptions(),
    retry: false,
  });
  const [preferences, setPreferences] =
    useState<LoginSecurityPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (query.data) setPreferences(query.data);
  }, [query.data]);

  const mutation = useMutation({
    ...orpc.shopOwner.updateLoginSecurityPreferences.mutationOptions(),
    onSuccess: async (result) => {
      setPreferences(result.preferences);
      await queryClient.invalidateQueries({
        queryKey: orpc.shopOwner.getLoginSecurityPreferences.key(),
      });
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(
        error.message || "Login security settings could not be saved",
      );
    },
  });

  const update = <Key extends keyof LoginSecurityPreferences>(
    key: Key,
    value: LoginSecurityPreferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  if (query.isPending) {
    return (
      <div
        className="space-y-5"
        role="status"
        aria-label="Loading login preferences"
      >
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        role="alert"
      >
        Login security preferences could not be loaded. {query.error.message}
      </div>
    );
  }

  const hasChanges = !loginSecurityPreferencesAreEqual(preferences, query.data);

  return (
    <div className="space-y-1">
      <PreferenceRow
        label="Login verification"
        description="Choose the checks required when signing in."
      >
        <Select
          value={preferences.loginVerification}
          onValueChange={(value) =>
            update(
              "loginVerification",
              value as LoginSecurityPreferences["loginVerification"],
            )
          }
          disabled={mutation.isPending}
        >
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label="Login verification"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {LOGIN_VERIFICATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PreferenceRow>

      <PreferenceRow
        label="Remember trusted device"
        description="Allow trusted devices to skip repeated verification."
      >
        <Switch
          checked={preferences.rememberTrustedDevice}
          onCheckedChange={(checked) =>
            update("rememberTrustedDevice", checked)
          }
          disabled={mutation.isPending}
          aria-label="Remember trusted device"
        />
      </PreferenceRow>

      <PreferenceRow
        label="Auto logout"
        description="End new sessions after the selected duration."
      >
        <Select
          value={String(preferences.autoLogoutMinutes)}
          onValueChange={(value) =>
            update(
              "autoLogoutMinutes",
              Number(value) as LoginSecurityPreferences["autoLogoutMinutes"],
            )
          }
          disabled={mutation.isPending}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Auto logout">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {AUTO_LOGOUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PreferenceRow>

      <PreferenceRow
        label="Allow multiple login devices"
        description="Keep sessions active on more than one device."
      >
        <Switch
          checked={preferences.allowMultipleLoginDevices}
          onCheckedChange={(checked) =>
            update("allowMultipleLoginDevices", checked)
          }
          disabled={mutation.isPending}
          aria-label="Allow multiple login devices"
        />
      </PreferenceRow>

      <div className="flex justify-end border-t pt-5">
        <Button
          type="button"
          onClick={() => mutation.mutate(preferences)}
          disabled={!hasChanges || mutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
        >
          {mutation.isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {mutation.isPending ? "Saving..." : "Save login settings"}
        </Button>
      </div>
    </div>
  );
}

function PreferenceRow({
  children,
  description,
  label,
}: {
  children: React.ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
