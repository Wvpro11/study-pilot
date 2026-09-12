import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assignments = sqliteTable(
  "assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    course: text("course").notNull(),
    dueDate: text("due_date").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(30),
    status: text("status", { enum: ["open", "complete"] }).notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_assignments_user_status_due").on(table.userId, table.status, table.dueDate),
  ],
);

export const plannerSettings = sqliteTable("planner_settings", {
  userId: text("user_id").primaryKey(),
  availableMinutes: integer("available_minutes").notNull().default(120),
  sessionMinutes: integer("session_minutes").notNull().default(35),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
