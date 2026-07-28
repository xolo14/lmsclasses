import { GoogleAdsTag } from "@/components/analytics/GoogleAdsTag";
import {
  GoogleTagManagerHead,
  GoogleTagManagerNoscript,
} from "@/components/analytics/GoogleTagManager";

/**
 * Third-party tags — keep in <body>; Next.js hoists beforeInteractive scripts into <head>.
 * Do not add a manual <head> in root layout (breaks RSC/HTML on some hosts).
 * Meta Pixel removed — Capig/fbevents was causing console 422 noise and is unused for core LMS flows.
 */
export function Analytics() {
  return (
    <>
      <GoogleTagManagerHead />
      <GoogleTagManagerNoscript />
      <GoogleAdsTag />
    </>
  );
}
