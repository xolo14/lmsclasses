import { getAppUrl } from "@/lib/app-url";

export function buildEmbedSnippet(plainKey: string, targetId = "lms-enroll-widget"): string {
  const base = getAppUrl();
  return `<div id="${targetId}"></div>
<script
  src="${base}/widget/enroll.js"
  data-key="${plainKey}"
  data-target="${targetId}"
  async
></script>`;
}
