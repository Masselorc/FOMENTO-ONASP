const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.PORT || 8790;
const baseURL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npm start",
    url: `${baseURL}/index.html`,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
