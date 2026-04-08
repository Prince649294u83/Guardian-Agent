import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const detectionReportsTable = pgTable("detection_reports", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  url: text("url").notNull(),
  trustScore: integer("trust_score").notNull().default(50),
  falseUrgencyDetected: boolean("false_urgency_detected").notNull().default(false),
  falseScarcityDetected: boolean("false_scarcity_detected").notNull().default(false),
  confirmShamingDetected: boolean("confirm_shaming_detected").notNull().default(false),
  hiddenFeesDetected: boolean("hidden_fees_detected").notNull().default(false),
  preCheckedAddOnsDetected: boolean("pre_checked_add_ons_detected").notNull().default(false),
  misdirectionDetected: boolean("misdirection_detected").notNull().default(false),
  totalPatternsDetected: integer("total_patterns_detected").notNull().default(0),
  hiddenFeesTotal: doublePrecision("hidden_fees_total"),
  summary: text("summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDetectionReportSchema = createInsertSchema(detectionReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDetectionReport = z.infer<typeof insertDetectionReportSchema>;
export type DetectionReport = typeof detectionReportsTable.$inferSelect;
