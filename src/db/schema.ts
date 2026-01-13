import { sql } from "drizzle-orm";
import {
	pgTable,
	text,
	uuid,
	timestamp,
	jsonb,
	integer,
	smallint,
	real,
	boolean,
} from "drizzle-orm/pg-core";

// NOTE: the migrations use TEXT columns with CHECK constraints for some
// fields (trigger_type, generation_type). To avoid introducing enum types
// that differ from migrations, these columns are declared as `text` below.

// prospects table
export const prospects = pgTable("prospects", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	linkedin_url: text("linkedin_url").notNull(),
	fname: text("fname").notNull(),
	middle_initial: text("middle_initial"),
	lname: text("lname").notNull(),
	headline: text("headline"),
	profile_data: jsonb("profile_data").notNull().default(sql`'{}'::jsonb`),
	created_at: timestamp("created_at").notNull().default(sql`now()`),
	updated_at: timestamp("updated_at").notNull().default(sql`now()`),
});

// tov_configs table
export const tov_configs = pgTable("tov_configs", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	formality: smallint("formality").notNull(),
	warmth: smallint("warmth").notNull(),
	directness: smallint("directness").notNull(),
	instructions: text("instructions"),
	created_at: timestamp("created_at").notNull().default(sql`now()`),
});

// message_sequences table
export const message_sequences = pgTable("message_sequences", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	prospect_id: uuid("prospect_id").notNull().references(() => prospects.id),
	tov_config_id: uuid("tov_config_id").notNull().references(() => tov_configs.id),
	company_context: text("company_context").notNull(),
	prospect_analysis: jsonb("prospect_analysis").notNull().$type<unknown>().default(sql`'{}'::jsonb`),
	sequence_length: integer("sequence_length").notNull(),
	current_step: integer("current_step").notNull().default(1),
	response_received: boolean("response_received").notNull().default(false),
	created_at: timestamp("created_at").notNull().default(sql`now()`),
	last_sent_at: timestamp("last_sent_at"),
});

// messages table
export const messages = pgTable("messages", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	message_sequence_id: uuid("message_sequence_id").notNull().references(() => message_sequences.id),
	step: integer("step").notNull(),
	msg_content: text("msg_content").notNull(),
	// migrations use TEXT + CHECK for trigger_type; mirror that here with TEXT.
	trigger_type: text("trigger_type").notNull().$type<string>().default("no_response"),
	delay_days: integer("delay_days").notNull().default(2),
	confidence: smallint("confidence").notNull(),
	rationale: text("rationale"),
});

// ai_generations table
export const ai_generations = pgTable("ai_generations", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	sequence_id: uuid("sequence_id").references(() => message_sequences.id),
	provider: text("provider").notNull(),
	model: text("model").notNull(),
	prompt: jsonb("prompt").notNull().$type<unknown>(),
	response: jsonb("response").notNull().$type<unknown>(),
	// migrations use TEXT + CHECK for generation_type; mirror with TEXT here.
	generation_type: text("generation_type").notNull(),
	token_usage: jsonb("token_usage").$type<unknown>(),
	cost_usd: real("cost_usd"),
	created_at: timestamp("created_at").notNull().default(sql`now()`),
});

export const allTables = {
	prospects,
	tov_configs,
	message_sequences,
	messages,
	ai_generations,
};


