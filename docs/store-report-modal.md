# Store report modal

The approved feature is a consumer-facing Report issue modal in every shop footer. It automatically targets the current store using the existing support ticket API, with a subject and description, validation, pending/error states, and a successful ticket link. Keep the existing support list available. No direct chat or new complaint system is included.

Inherit the shop UI and existing accessible Radix dialog. Keep a readable, single-column form with visible labels and large controls on mobile. Preserve entered text when closing or retrying; clear after successful submission. Guests sign in before entering a report, returning to the same store/path/query with the form open. Business accounts receive an explanation rather than an incorrectly routed ticket.

Reports use the existing consumer-to-shop assignment, default medium priority and Other category. They do not constitute an admin-only complaint. No schema changes, attachments or new notification functionality are introduced.

Verification: browser form/keyboard/mobile checks without sending reports to a real seller; isolated database test creates and cleans up fixture accounts/tickets to verify assignment and creator access. Existing unrelated React type errors remain outside scope.
