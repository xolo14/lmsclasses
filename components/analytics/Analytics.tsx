import { GoogleAdsTag } from "@/components/analytics/GoogleAdsTag";
import {
  GoogleTagManagerHead,
  GoogleTagManagerNoscript,
} from "@/components/analytics/GoogleTagManager";
import { MetaPixelHead, MetaPixelNoscript } from "@/components/analytics/MetaPixel";

/**
 * Third-party tags — keep in <body>; Next.js hoists beforeInteractive scripts into <head>.
 * Do not add a manual <head> in root layout (breaks RSC/HTML on some hosts).
 */
export function Analytics() {
  return (
    <>
      <GoogleTagManagerHead />
      <GoogleTagManagerNoscript />
      <MetaPixelHead />
      <MetaPixelNoscript />
      <GoogleAdsTag />
    </>
  );
}
