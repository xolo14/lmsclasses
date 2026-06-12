import { backfillMissingRecordCourseSlugs } from "../lib/slug";
import { loadEnvLocal } from "../lib/load-env";

loadEnvLocal();

async function main() {
  const count = await backfillMissingRecordCourseSlugs();
  console.log(`✅ Backfilled slugs for ${count} record course(s)`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
