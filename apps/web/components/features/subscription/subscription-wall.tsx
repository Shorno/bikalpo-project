"use client";

import type { LandingPricingPlan } from "@bikalpo-project/db/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

type BillingCycle = "monthly" | "yearly";

export function SubscriptionWall({ mode = "wall" }: { mode?: "wall" | "renew" }) {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<LandingPricingPlan | null>(
    null,
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [paymentProof, setPaymentProof] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    ...orpc.subscription.getAvailablePlans.queryOptions(),
  });

  const submitPayment = useMutation({
    mutationFn: (data: {
      planId: number;
      billingCycle: BillingCycle;
      paymentProof: string;
      paymentNotes?: string;
    }) => client.subscription.submitPayment(data),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({
        queryKey: orpc.subscription.getMySubscription.queryOptions().queryKey,
      });
      setShowPaymentForm(false);
      setSelectedPlan(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit payment");
    },
  });

  const handleSelectPlan = (plan: LandingPricingPlan) => {
    setSelectedPlan(plan);
    setShowPaymentForm(true);
  };

  const handleSubmitPayment = () => {
    if (!selectedPlan || !paymentProof.trim()) {
      toast.error("Please provide payment proof (receipt URL)");
      return;
    }
    submitPayment.mutate({
      planId: selectedPlan.id,
      billingCycle,
      paymentProof: paymentProof.trim(),
      paymentNotes: paymentNotes.trim() || undefined,
    });
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${mode === "wall" ? "min-h-[60vh]" : ""}`}>
      <div className="w-full max-w-4xl space-y-8">
        {/* Header — only shown in wall mode */}
        {mode === "wall" && (
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Your Subscription Has Expired
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Choose a plan below to continue managing your shop. Your data is
              safe and will be available once you subscribe.
            </p>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              billingCycle === "monthly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              billingCycle === "yearly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">
              Save 20%
            </Badge>
          </button>
        </div>

        {/* Plans Grid */}
        {!showPaymentForm && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const price =
                billingCycle === "yearly"
                  ? (plan.priceYearly ?? plan.priceMonthly * 12)
                  : plan.priceMonthly;
              const features = (plan.features as string[]) || [];

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    plan.isPopular
                      ? "border-primary shadow-md ring-1 ring-primary/20"
                      : ""
                  }`}
                >
                  {plan.isPopular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.subtitle && (
                      <CardDescription>{plan.subtitle}</CardDescription>
                    )}
                    <div className="mt-3">
                      <span className="text-3xl font-bold">
                        ৳{price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        /{billingCycle === "yearly" ? "year" : "month"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-2">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.isPopular ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {plan.ctaText || "Choose Plan"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Payment Form */}
        {showPaymentForm && selectedPlan && (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Submit Payment
              </CardTitle>
              <CardDescription>
                Plan:{" "}
                <span className="font-semibold text-foreground">
                  {selectedPlan.name}
                </span>{" "}
                — ৳
                {(billingCycle === "yearly"
                  ? (selectedPlan.priceYearly ??
                    selectedPlan.priceMonthly * 12)
                  : selectedPlan.priceMonthly
                ).toLocaleString()}
                /{billingCycle === "yearly" ? "year" : "month"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Payment Instructions:</strong> Send the payment via
                  bKash/Nagad/bank transfer, then paste the receipt URL or
                  transaction ID below.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Payment Receipt URL / Transaction ID *
                </label>
                <Textarea
                  placeholder="Paste your bKash transaction ID or upload receipt URL..."
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Any additional info about your payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedPlan(null);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmitPayment}
                disabled={submitPayment.isPending || !paymentProof.trim()}
                className="flex-1"
              >
                {submitPayment.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Payment
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
