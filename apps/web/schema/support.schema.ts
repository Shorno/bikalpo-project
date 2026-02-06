import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject must be less than 200 characters"),
  message: z
    .string()
    .min(20, "Message must be at least 20 characters")
    .max(2000, "Message must be less than 2000 characters"),
  priority: z.enum(["low", "medium", "high"]),
});

export const addReplySchema = z.object({
  ticketId: z.number().min(1, "Ticket ID is required"),
  message: z
    .string()
    .min(10, "Reply must be at least 10 characters")
    .max(1000, "Reply must be less than 1000 characters"),
});

export type CreateTicketFormValues = z.infer<typeof createTicketSchema>;
export type AddReplyFormValues = z.infer<typeof addReplySchema>;
