import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trustRatingsTable = pgTable("trust_ratings", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  score: integer("score").notNull().default(50),
  tier: text("tier").notNull().default("neutral"),
  totalScans: integer("total_scans").notNull().default(0),
  patternsDetectedCount: integer("patterns_detected_count").notNull().default(0),
  hiddenFeesCount: integer("hidden_fees_count").notNull().default(0),
  lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTrustRatingSchema = createInsertSchema(trustRatingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrustRating = z.infer<typeof insertTrustRatingSchema>;
export type TrustRating = typeof trustRatingsTable.$inferSelect;
