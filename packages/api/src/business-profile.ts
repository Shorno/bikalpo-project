type ProfileUser = {
  ownerName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  image?: string | null;
  shopName?: string | null;
  warehouseName?: string | null;
};

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasValue);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasValue);
  }
  return false;
}

/** Shared registration-completion checks for the owner and admin profiles. */
export function computeProfileCompletion(
  application: Record<string, unknown> | null | undefined,
  user: ProfileUser | null | undefined,
): number {
  const checks = [
    [user?.ownerName, application?.ownerName],
    [user?.phoneNumber, application?.phoneNumber],
    [user?.email, application?.email],
    [application?.profilePhotoUrl, user?.image],
    [
      user?.shopName,
      user?.warehouseName,
      application?.shopName,
      application?.warehouseName,
    ],
    [application?.businessNature, application?.businessCategory],
    [application?.district, application?.area],
    [application?.bankName],
    [application?.documentUrls, application?.documents],
  ];
  return Math.round((checks.filter(hasValue).length / checks.length) * 100);
}
