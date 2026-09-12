"use client";

import { normalizeBangladeshPhoneNumber } from "@bikalpo-project/auth/phone-identity";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { client } from "@/utils/orpc";

export type PropertyPhoneProof = { phone: string; proof: string; expiresAt: string };

export function PropertyPhoneVerification(props: {
  phone: string;
  verified: boolean;
  onVerified: (proof: PropertyPhoneProof) => void;
}) {
  const normalizedPhone = normalizeBangladeshPhoneNumber(props.phone);
  // Changing phone unmounts the old challenge and discards stale async results.
  return <PhoneChallenge key={normalizedPhone ?? props.phone} {...props} normalizedPhone={normalizedPhone} />;
}

function PhoneChallenge({ normalizedPhone, verified, onVerified }: {
  phone: string; normalizedPhone: string | null; verified: boolean;
  onVerified: (proof: PropertyPhoneProof) => void;
}) {
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const sendCode = async () => {
    if (!normalizedPhone || inFlight.current) return;
    inFlight.current = true;
    setBusy("send"); setError("");
    try {
      const result = await client.toLetProperty.requestPhoneCode({ phone: normalizedPhone });
      if (!mounted.current) return;
      setRequested(true); setCode("");
      setDevelopmentCode(result.delivery === "development" ? result.developmentCode : null);
      setRetryAt(Date.now() + 60_000); setNow(Date.now());
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not request a code. Please try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  const verifyCode = async () => {
    if (!normalizedPhone || !/^\d{6}$/.test(code) || inFlight.current) return;
    inFlight.current = true;
    setBusy("verify"); setError("");
    try {
      const result = await client.toLetProperty.verifyPhoneCode({ phone: normalizedPhone, code });
      if (!mounted.current) return;
      onVerified(result);
      toast.success("Property contact verified");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Verification failed. Request a new code and try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  if (verified) return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div><p className="text-sm font-semibold">Phone verified</p>
        <p className="mt-0.5 text-sm text-emerald-800">Property contact verified as {normalizedPhone}. Save within 15 minutes.</p>
      </div>
    </div>
  );

  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1_000));
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Verify property contact</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {normalizedPhone ? `Verify ${normalizedPhone} without changing your account login number.` : "Enter a valid Bangladesh mobile number in Basic Information."}
          </p>
        </div>
      </div>
      {requested ? <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input ref={inputRef} id="property-phone-otp" type="text" inputMode="numeric" maxLength={6}
          autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verifyCode(); } }}
          placeholder="Enter 6-digit code" aria-label="Property contact verification code" aria-invalid={Boolean(error)}
          aria-describedby={error ? "property-phone-error" : "property-phone-help"} disabled={busy !== null}
          className="h-11 min-w-0 bg-white font-mono text-base" />
        <Button type="button" onClick={() => void verifyCode()} disabled={code.length !== 6 || busy !== null}
          className="h-11 shrink-0 bg-emerald-600 hover:bg-emerald-700">
          {busy === "verify" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null} Verify OTP
        </Button>
      </div> : null}
      {requested ? <p id="property-phone-help" className="mt-2 text-sm text-gray-600">Codes expire after 5 minutes. Only the latest code works.</p> : null}
      {developmentCode ? <p role="status" className="mt-3 text-sm text-amber-900">
        Local development only — no SMS sent. Test code: <span className="font-mono font-semibold">{developmentCode}</span>
      </p> : null}
      {error ? <p id="property-phone-error" role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <Button type="button" variant="outline" onClick={() => void sendCode()} disabled={!normalizedPhone || busy !== null || remaining > 0}
        className="mt-4 h-11">
        {busy === "send" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {remaining > 0 ? `Resend in ${remaining}s` : requested ? "Resend code" : "Request verification code"}
      </Button>
    </div>
  );
}
