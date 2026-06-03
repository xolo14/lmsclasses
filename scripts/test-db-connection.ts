import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);
  const rows = await sql`SELECT count(*)::int AS c FROM users`;
  console.log("OK - users count:", rows[0].c);
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
