export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    code: "free",
    name: "Free",
    description: "Your free business subscription. No expiry.",
    durationMonths: null,
    amountMinor: 0,
    sortOrder: 0,
  },
  {
    code: "monthly",
    name: "Monthly",
    description: "One month of business access.",
    durationMonths: 1,
    amountMinor: 100000,
    sortOrder: 1,
  },
  {
    code: "six_monthly",
    name: "Six-monthly",
    description: "Six months at a lower monthly cost.",
    durationMonths: 6,
    amountMinor: 480000,
    sortOrder: 2,
  },
  {
    code: "yearly",
    name: "Yearly",
    description: "Our lowest monthly cost, paid yearly.",
    durationMonths: 12,
    amountMinor: 720000,
    sortOrder: 3,
  },
] as const;

type PlanTerms = {
  durationMonths: number | null;
  amountMinor: number;
  active: boolean;
};
export function validateSubscriptionCatalog(plans: PlanTerms[]) {
  const active = plans
    .filter((p) => p.active && p.durationMonths !== null)
    .sort((a, b) => a.durationMonths! - b.durationMonths!);
  for (let i = 1; i < active.length; i++) {
    const shorter = active[i - 1]!;
    const longer = active[i]!;
    if (shorter.durationMonths === longer.durationMonths)
      throw new Error(
        "Only one active plan per duration is allowed. Deactivate the existing offer first.",
      );
    if (
      shorter.amountMinor * longer.durationMonths! <=
      longer.amountMinor * shorter.durationMonths!
    ) {
      throw new Error(
        "Longer plans must have a lower effective monthly price.",
      );
    }
  }
}

export type SubscriptionTerm = {
  durationMonths: number | null;
  startsAt: Date;
  expiresAt: Date | null;
};
export function subscriptionStatus(term: SubscriptionTerm, now = new Date()) {
  return term.expiresAt && now >= term.expiresAt ? "Expired" : "Active";
}

export function subscriptionNextBillingAt(
  term: SubscriptionTerm,
  now = new Date(),
) {
  if (
    term.durationMonths === null ||
    !term.expiresAt ||
    subscriptionStatus(term, now) === "Expired"
  )
    return null;

  return term.expiresAt;
}

export function subscriptionAction(
  current: SubscriptionTerm | null,
  duration: number | null,
  now = new Date(),
) {
  if (!current || duration === null) return null;
  if (subscriptionStatus(current, now) === "Expired") return "Renew" as const;
  if (current.durationMonths === null || duration > current.durationMonths)
    return "Upgrade" as const;
  return null;
}

/** Calendar months in Asia/Dhaka (UTC+06:00), clamped once to the target month. */
export function subscriptionExpiry(start: Date, months: number) {
  if (![1, 6, 12].includes(months) || !Number.isFinite(start.getTime()))
    throw new Error("Invalid subscription term");
  const offset = 6 * 60 * 60 * 1000;
  const local = new Date(start.getTime() + offset);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0),
  ).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - offset);
}

export function isEligibleSubscriptionAccount(
  owner: {
    role: string | null;
    businessType: string | null;
    sellerStatus: string | null;
    banned: boolean | null;
    banExpires: Date | null;
  },
  now = new Date(),
) {
  return (
    owner.role === "shop_owner" &&
    owner.businessType === "retail" &&
    owner.sellerStatus === "approved" &&
    !(owner.banned && (!owner.banExpires || owner.banExpires > now))
  );
}
