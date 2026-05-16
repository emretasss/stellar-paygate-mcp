import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PAYGATE_WEB_URL ?? "http://localhost:5174";
await mkdir("docs/screenshots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/screenshots/paygate-dashboard.png", fullPage: true });

await page.getByRole("button", { name: /run paid call/i }).click();
await page.getByText(/402 returned/i).waitFor({ timeout: 10_000 });
await page.screenshot({ path: "docs/screenshots/paygate-paid-call.png", fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 1000 }, isMobile: true });
await mobile.goto(baseUrl, { waitUntil: "networkidle" });
await mobile.screenshot({ path: "docs/screenshots/paygate-mobile.png", fullPage: true });

await browser.close();
