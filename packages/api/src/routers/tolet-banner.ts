import { db } from "@bikalpo-project/db";
import { toletBanner } from "@bikalpo-project/db/schema";
import { eq } from "drizzle-orm";
import { adminProcedure, publicProcedure } from "../index";
import { toLetBannerSchema } from "../lib/tolet-banner";

async function readBanner() {
  const [row] = await db.select().from(toletBanner).where(eq(toletBanner.id, "landing"));
  return { slides: row?.slides ?? [] };
}
export const toLetBannerRouter = {
  getPublic: publicProcedure.route({ method: "GET", path: "/to-let/banner", tags: ["To-Let"] }).handler(readBanner),
  get: adminProcedure.handler(readBanner),
  save: adminProcedure.input(toLetBannerSchema).handler(async ({ input }) => {
    await db.insert(toletBanner).values({ id: "landing", slides: input.slides }).onConflictDoUpdate({ target: toletBanner.id, set: { slides: input.slides, updatedAt: new Date() } });
    return { success: true };
  }),
};
