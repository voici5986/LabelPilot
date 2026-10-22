import type { Page } from "@playwright/test";

import { TOUR_SEEN_KEY } from "../src/utils/guidedTour";

/** 每个用例前重置本地存储并固定为中文，保证用例相互独立 */
export async function resetForE2e(
  page: Page,
  { skipTour = true }: { skipTour?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ skipTour, seenKey }) => {
      const initializedKey = "label_pilot_e2e_initialized";
      if (sessionStorage.getItem(initializedKey) !== "true") {
        localStorage.clear();
        sessionStorage.setItem(initializedKey, "true");
      }
      localStorage.setItem("label_printer_lang", "zh");
      // Most workflows start after onboarding; the tour suite uses a fresh visit.
      if (skipTour) localStorage.setItem(seenKey, "1");
    },
    { skipTour, seenKey: TOUR_SEEN_KEY },
  );
}
