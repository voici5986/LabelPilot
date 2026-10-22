import { defineConfig, devices } from "@playwright/test";

const chromiumChannel = process.env.CI ? "chromium" : "chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: chromiumChannel,
      },
      testIgnore: /mobile-flow/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], browserName: "webkit" },
      testMatch: /browser-smoke\.spec\.ts/,
    },
    {
      name: "mobile-pixel-7",
      use: {
        ...devices["Pixel 7"],
        channel: chromiumChannel,
      },
      testMatch: /mobile-flow/,
    },
    {
      name: "mobile-iphone-14",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        channel: chromiumChannel,
      },
      testMatch: /mobile-flow/,
    },
    {
      name: "mobile-375",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
        channel: chromiumChannel,
      },
      testMatch: /mobile-flow/,
    },
    {
      name: "mobile-360",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        channel: chromiumChannel,
      },
      testMatch: /mobile-flow/,
    },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
