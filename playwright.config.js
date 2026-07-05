import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    // Clear sessionStorage between tests so stale liveMap doesn't bleed through
    storageState: undefined,
  },
  reporter: [["list"]],
});
