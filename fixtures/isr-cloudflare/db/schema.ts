import { sqliteTable, integer, text } from 'void/schema-d1';
export const cases = sqliteTable('isr_cases', {
  path: text('path').primaryKey(), version: integer('version').notNull().default(1),
  fail: integer('fail', { mode: 'boolean' }).notNull().default(false),
  privacy: text('privacy').notNull().default('public'), delayMs: integer('delay_ms').notNull().default(0),
});
export const renders = sqliteTable('isr_renders', {
  id: integer('id').primaryKey({ autoIncrement: true }), path: text('path').notNull(),
  version: integer('version').notNull(), viewer: text('viewer').notNull(),
  revision: text('revision').notNull(), failed: integer('failed', { mode: 'boolean' }).notNull(),
});
