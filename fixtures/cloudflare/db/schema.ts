import { sqliteTable, integer, text } from 'void/schema-d1';
export const notes = sqliteTable('rc_notes', { id: integer('id').primaryKey({ autoIncrement: true }), value: text('value').notNull(), transport: text('transport').notNull(), detail: text('detail').notNull().default('') });
