import { db } from "@bikalpo-project/db";

/** Read the accounts shown in owner Settings without seeding or changing them. */
export async function getUserFinancialAccounts(
  userId: string,
  role: string | null,
) {
  if (role !== "shop_owner" && role !== "warehouse") return [];
  const ownerType = role === "shop_owner" ? "shop" : "warehouse";
  const accounts = await db.query.financePaymentAccount.findMany({
    where: (table, { and, eq, inArray }) =>
      and(
        eq(table.ownerId, userId),
        eq(table.ownerType, ownerType),
        inArray(table.type, ["bank", "mobile_banking"]),
      ),
    columns: {
      id: true,
      type: true,
      name: true,
      providerName: true,
      accountNumber: true,
      isActive: true,
    },
    orderBy: (table, { asc }) => [
      asc(table.type),
      asc(table.providerName),
      asc(table.name),
      asc(table.id),
    ],
  });
  return accounts.map((account) => ({
    id: String(account.id),
    type: account.type as "bank" | "mobile_banking",
    accountName: account.name,
    providerName: account.providerName || account.name,
    accountNumber: account.accountNumber,
    isActive: account.isActive,
  }));
}
