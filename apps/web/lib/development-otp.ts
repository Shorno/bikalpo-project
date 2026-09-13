type OtpResult = { code?: string | null };
type OtpRequest = (phoneNumber: string) => Promise<OtpResult>;

async function requestOtp(phoneNumber: string): Promise<OtpResult> {
  const { client } = await import("@/utils/orpc");
  return client.devOtp.get({ phoneNumber });
}

export async function getDevelopmentOtp(
  phoneNumber: string,
  request: OtpRequest = requestOtp,
) {
  if (process.env.NODE_ENV !== "development") return null;
  const result = await request(phoneNumber);
  return result.code ?? null;
}
