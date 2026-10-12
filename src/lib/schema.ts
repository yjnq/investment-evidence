import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import type {Material, Event, Task, Notice} from './domain';
export const materialsTable=pgTable('materials',{id:text('id').primaryKey(),payload:jsonb('payload').$type<Material>().notNull()});
export const eventsTable=pgTable('events',{id:text('id').primaryKey(),payload:jsonb('payload').$type<Event>().notNull()});
export const tasksTable=pgTable('tasks',{id:text('id').primaryKey(),payload:jsonb('payload').$type<Task>().notNull()});
export const noticesTable=pgTable('notices',{id:text('id').primaryKey(),payload:jsonb('payload').$type<Notice>().notNull()});
