import type { Page } from "@playwright/test";

/** 每个用例前重置本地存储并固定为中文，保证用例相互独立 */
export async function resetForE2e(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const initializedKey = "label_pilot_e2e_initialized";
    if (sessionStorage.getItem(initializedKey) !== "true") {
      localStorage.clear();
      sessionStorage.setItem(initializedKey, "true");
    }
    localStorage.setItem("label_printer_lang", "zh");
  });
}
