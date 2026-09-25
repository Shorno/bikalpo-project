import { isPhoneAuthEmail } from "@bikalpo-project/auth/phone-identity";

/** Shared by the profile and its editor so displayed and saved values agree. */
export function profileContacts(
  user: {
    name: string;
    ownerName?: string | null;
    phoneNumber?: string | null;
    email: string;
  },
  application: Record<string, unknown> | null,
) {
  const email = (application ? application.email : user.email) as
    | string
    | null
    | undefined;
  return {
    ownerName:
      (application?.ownerName as string) || user.ownerName || user.name,
    phoneNumber: (application?.phoneNumber as string) || user.phoneNumber || "",
    email: email && !isPhoneAuthEmail(email) ? email : null,
  };
}
