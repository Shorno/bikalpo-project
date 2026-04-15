/**
 * Auto-escalation utility for support tickets.
 *
 * Finds tickets where:
 *   - currentLevel = 'level_1'
 *   - escalationDeadline has passed
 *   - status is still 'open' or 'in_progress'
 *
 * And escalates them to level_2 (admin), clearing the assignedToId.
 */

import { db } from "@bikalpo-project/db";
import { supportTicket } from "@bikalpo-project/db/schema";
import { and, eq, lt, or, isNotNull } from "drizzle-orm";

/**
 * Process all overdue tickets and escalate them to admin.
 * Returns the number of tickets escalated.
 */
export async function processAutoEscalations(): Promise<number> {
    const now = new Date();

    // Find overdue tickets at level_1 with a deadline
    const overdueTickets = await db
        .select({ id: supportTicket.id })
        .from(supportTicket)
        .where(
            and(
                eq(supportTicket.currentLevel, "level_1"),
                isNotNull(supportTicket.escalationDeadline),
                lt(supportTicket.escalationDeadline, now),
                or(
                    eq(supportTicket.status, "open"),
                    eq(supportTicket.status, "in_progress"),
                ),
            ),
        );

    if (overdueTickets.length === 0) {
        return 0;
    }

    const ticketIds = overdueTickets.map((t) => t.id);

    // Escalate each ticket
    for (const ticketId of ticketIds) {
        await db
            .update(supportTicket)
            .set({
                currentLevel: "level_2",
                assignedToId: null,
                escalatedAt: now,
                autoEscalated: true,
                updatedAt: now,
            })
            .where(eq(supportTicket.id, ticketId));
    }

    return ticketIds.length;
}
