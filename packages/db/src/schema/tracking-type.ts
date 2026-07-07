import { pgEnum } from "drizzle-orm/pg-core";

export const trackingTypeEnum = pgEnum("tracking_type", [
  "none",
  "batch",
  "serial",
]);
