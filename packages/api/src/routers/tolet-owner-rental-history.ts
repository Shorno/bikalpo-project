import { db } from "@bikalpo-project/db";
import { env } from "@bikalpo-project/env/server";
import { z } from "zod";
import { consumerProcedure } from "../index";
import { getOwnedUnitRentalHistory } from "../services/tolet-owner-rental-history";

export const ownerUnitRentalHistoryProcedure = consumerProcedure
	.route({ method: "GET", path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/payment-history", tags: ["To-Let Rental"], summary: "Read owner-only unit rent history across all contracts" })
	.input(z.object({
		propertyCode: z.string().regex(/^PR-20\d{2}-\d{6,10}$/),
		unitCode: z.string().regex(/^UNT-\d{6,10}$/),
		page: z.number().int().min(1).max(10000).default(1),
	}).strict())
	.handler(({ context, input }) => getOwnedUnitRentalHistory(db, context.session.user.id, input, env.BETTER_AUTH_SECRET));
