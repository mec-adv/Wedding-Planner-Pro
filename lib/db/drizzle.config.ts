import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/budget.ts",
    "./src/schema/gift_categories.ts",
    "./src/schema/orders.ts",
    "./src/schema/coordinators.ts",
    "./src/schema/gifts.ts",
    "./src/schema/guest_groups.ts",
    "./src/schema/public_invite_templates.ts",
    "./src/schema/guests.ts",
    "./src/schema/guest_companions.ts",
    "./src/schema/invitations.ts",
    "./src/schema/messages.ts",
    "./src/schema/profiles.ts",
    "./src/schema/schedule.ts",
    "./src/schema/seating.ts",
    "./src/schema/settings.ts",
    "./src/schema/tasks.ts",
    "./src/schema/users.ts",
    "./src/schema/vendors.ts",
    "./src/schema/weddings.ts",
    "./src/schema/whatsapp_connections.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
