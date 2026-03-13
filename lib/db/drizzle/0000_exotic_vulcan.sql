CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password_hash" text NOT NULL,
        "role" varchar(50) DEFAULT 'guest' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weddings" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" varchar(255) NOT NULL,
        "groom_name" varchar(255) NOT NULL,
        "bride_name" varchar(255) NOT NULL,
        "date" timestamp with time zone NOT NULL,
        "venue" text,
        "description" text,
        "cover_image_url" text,
        "created_by_id" integer NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "wedding_id" integer NOT NULL,
        "role" varchar(50) NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "profiles_user_wedding_unique" UNIQUE("user_id","wedding_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "invited_by_id" integer NOT NULL,
        "email" varchar(255) NOT NULL,
        "role" varchar(50) NOT NULL,
        "token" varchar(255) NOT NULL,
        "status" varchar(50) DEFAULT 'pending' NOT NULL,
        "message" text,
        "accepted_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "guests" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255),
        "phone" varchar(50),
        "group_name" varchar(100),
        "rsvp_status" varchar(20) DEFAULT 'pending' NOT NULL,
        "plus_one" boolean DEFAULT false NOT NULL,
        "plus_one_name" varchar(255),
        "dietary_restrictions" text,
        "notes" text,
        "invite_sent_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_orders" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "gift_id" integer NOT NULL,
        "guest_name" varchar(255) NOT NULL,
        "guest_email" varchar(255),
        "amount" numeric(10, 2) NOT NULL,
        "payment_method" varchar(20) NOT NULL,
        "payment_status" varchar(20) DEFAULT 'pending' NOT NULL,
        "withdrawal_status" varchar(20) DEFAULT 'pending' NOT NULL,
        "withdrawn_at" timestamp with time zone,
        "asaas_payment_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gifts" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100) NOT NULL,
        "price" numeric(10, 2) NOT NULL,
        "image_url" text,
        "humor_tag" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "priority" varchar(20) DEFAULT 'medium' NOT NULL,
        "assignee" varchar(255),
        "due_date" timestamp with time zone,
        "progress" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "category" varchar(100) NOT NULL,
        "contact_name" varchar(255),
        "phone" varchar(50),
        "email" varchar(255),
        "website" text,
        "price" numeric(10, 2),
        "notes" text,
        "status" varchar(20) DEFAULT 'contacted' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordinators" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255),
        "phone" varchar(50),
        "role" varchar(100) NOT NULL,
        "permissions" text[] DEFAULT '{}' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "start_time" varchar(10) NOT NULL,
        "end_time" varchar(10),
        "location" varchar(255),
        "responsible" varchar(255),
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "estimated_total" numeric(10, 2) DEFAULT '0' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "category_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "estimated_cost" numeric(10, 2) NOT NULL,
        "actual_cost" numeric(10, 2),
        "vendor" varchar(255),
        "notes" text,
        "is_paid" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_assignments" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "table_id" integer NOT NULL,
        "guest_id" integer NOT NULL,
        "seat_number" integer,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seating_tables" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        "capacity" integer DEFAULT 8 NOT NULL,
        "position_x" numeric(10, 2) DEFAULT '0' NOT NULL,
        "position_y" numeric(10, 2) DEFAULT '0' NOT NULL,
        "shape" varchar(20) DEFAULT 'round' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "category" varchar(50) DEFAULT 'custom' NOT NULL,
        "content" text NOT NULL,
        "variables" text[] DEFAULT '{}' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "sender_name" varchar(255) NOT NULL,
        "message_type" varchar(20) DEFAULT 'text' NOT NULL,
        "content" text,
        "media_url" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "wedding_id" integer NOT NULL,
        "evolution_api_url" text,
        "evolution_api_key" text,
        "evolution_instance" varchar(255),
        "asaas_api_key" text,
        "asaas_environment" varchar(20) DEFAULT 'sandbox' NOT NULL,
        "asaas_webhook_token" text,
        CONSTRAINT "integration_settings_wedding_id_unique" UNIQUE("wedding_id")
);
--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_orders" ADD CONSTRAINT "gift_orders_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_orders" ADD CONSTRAINT "gift_orders_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordinators" ADD CONSTRAINT "coordinators_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_table_id_seating_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."seating_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seating_tables" ADD CONSTRAINT "seating_tables_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;