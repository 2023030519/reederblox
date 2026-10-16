import { defineConfig } from "@playwright/test";

// BASE_URL=https://readerblox.vercel.app npx playwright test   -> run everything against the deployed site
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  expect: { timeout: 15000 }, // the dev server compiles routes on first visit, which can take over 5 s
  projects: [
    { name: "dev", testIgnore: /offline/, use: { baseURL: remote ?? "http://localhost:3001" } },
    // The service worker only registers in a production build: run `npm run build` first.
    { name: "prod", testMatch: /offline/, use: { baseURL: remote ?? "http://localhost:3002" } },
  ],
  webServer: remote ? undefined : [
    { command: "npm run dev -- -p 3001", url: "http://localhost:3001", reuseExistingServer: true },
    { command: "npm run start -- -p 3002", url: "http://localhost:3002", reuseExistingServer: true },
  ],
});
