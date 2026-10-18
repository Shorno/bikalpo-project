"use client";

import { normalizeBangladeshPhoneNumber } from "@bikalpo-project/auth/phone-identity";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { client } from "@/utils/orpc";

export type PropertyPhoneProof = {
    phone: string;
    proof: string;
    expiresAt: string;
};

export function PropertyPhoneVerification(props: {
    phone: string;
    verified: boolean;
    onVerified: (proof: PropertyPhoneProof) => void;
}) {
    const normalizedPhone = normalizeBangladeshPhoneNumber(props.phone);
    // Changing phone unmounts the old challenge and discards stale async results.
    return (
        <PhoneChallenge
            key={normalizedPhone ?? props.phone}
            {...props}
            normalizedPhone={normalizedPhone}
        />
    );
}

/** No SMS is sent: the owner proves they are a person by typing the number in a captcha picture. */
function PhoneChallenge({
    normalizedPhone,
    verified,
    onVerified,
}: {
    phone: string;
    normalizedPhone: string | null;
    verified: boolean;
    onVerified: (proof: PropertyPhoneProof) => void;
}) {
    const [code, setCode] = useState("");
    const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
    const [busy, setBusy] = useState<"send" | "verify" | null>(null);
    const [error, setError] = useState("");
    const mounted = useRef(true);
    const inFlight = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const loadCaptcha = async () => {
        if (!normalizedPhone || inFlight.current) return;
        inFlight.current = true;
        setBusy("send");
        setError("");
        try {
            const result = await client.toLetProperty.requestPhoneCode({
                phone: normalizedPhone,
            });
            if (!mounted.current) return;
            setCaptchaSvg(result.captchaSvg);
            setCode("");
            window.requestAnimationFrame(() => inputRef.current?.focus());
        } catch (cause) {
            if (mounted.current)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Could not load the captcha. Please try again.",
                );
        } finally {
            inFlight.current = false;
            if (mounted.current) setBusy(null);
        }
    };

    const verifyCode = async () => {
        if (!normalizedPhone || !/^\d{6}$/.test(code) || inFlight.current)
            return;
        inFlight.current = true;
        setBusy("verify");
        setError("");
        try {
            const result = await client.toLetProperty.verifyPhoneCode({
                phone: normalizedPhone,
                code,
            });
            if (!mounted.current) return;
            onVerified(result);
            toast.success("Property contact verified");
        } catch (cause) {
            if (mounted.current)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Verification failed. Load a new picture and try again.",
                );
        } finally {
            inFlight.current = false;
            if (mounted.current) setBusy(null);
        }
    };

    if (verified)
        return (
            <div
                role="status"
                className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
            >
                <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0"
                />
                <div>
                    <p className="text-sm font-semibold">Phone verified</p>
                    <p className="mt-0.5 text-sm text-emerald-800">
                        Property contact verified as {normalizedPhone}. Save
                        within 15 minutes.
                    </p>
                </div>
            </div>
        );

    return (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
                <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-emerald-600"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                        Verify property contact
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {normalizedPhone
                            ? `Confirm ${normalizedPhone} by typing the number shown in the picture. No SMS is sent.`
                            : "Enter a valid Bangladesh mobile number in Basic Information."}
                    </p>
                </div>
            </div>
            {captchaSvg ? (
                <>
                    <div className="mt-4 flex items-center gap-2">
                        {/* biome-ignore lint/performance/noImgElement: inline SVG data URL, not an optimizable asset */}
                        <img
                            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}`}
                            alt="Captcha: a six-digit number"
                            width={220}
                            height={70}
                            className="h-[70px] w-[220px] select-none rounded-md border border-border bg-white"
                            draggable={false}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => void loadCaptcha()}
                            disabled={busy !== null}
                            aria-label="Show a new picture"
                            title="Show a new picture"
                            className="size-11 shrink-0"
                        >
                            <RefreshCw
                                aria-hidden="true"
                                className={`size-4 ${busy === "send" ? "animate-spin" : ""}`}
                            />
                        </Button>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                            ref={inputRef}
                            id="property-phone-captcha"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            autoComplete="off"
                            value={code}
                            onChange={(event) =>
                                setCode(
                                    event.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6),
                                )
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void verifyCode();
                                }
                            }}
                            placeholder="Type the 6 digits"
                            aria-label="Number shown in the captcha picture"
                            aria-invalid={Boolean(error)}
                            aria-describedby={
                                error
                                    ? "property-phone-error"
                                    : "property-phone-help"
                            }
                            disabled={busy !== null}
                            className="h-11 min-w-0 bg-card font-mono text-base sm:max-w-56"
                        />
                        <Button
                            type="button"
                            onClick={() => void verifyCode()}
                            disabled={code.length !== 6 || busy !== null}
                            className="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {busy === "verify" ? (
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin"
                                />
                            ) : null}{" "}
                            Verify
                        </Button>
                    </div>
                    <p
                        id="property-phone-help"
                        className="mt-2 text-sm text-muted-foreground"
                    >
                        Can&rsquo;t read it? Tap the refresh button for a new
                        picture. Each picture works for 5 minutes.
                    </p>
                </>
            ) : null}
            {error ? (
                <p
                    id="property-phone-error"
                    role="alert"
                    className="mt-3 text-sm text-red-700"
                >
                    {error}
                </p>
            ) : null}
            {captchaSvg ? null : (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadCaptcha()}
                    disabled={!normalizedPhone || busy !== null}
                    className="mt-4 h-11"
                >
                    {busy === "send" ? (
                        <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                        />
                    ) : null}
                    Verify this number
                </Button>
            )}
        </div>
    );
}
