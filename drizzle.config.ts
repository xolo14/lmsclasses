import { defineConfig } from "drizzle-kit";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
