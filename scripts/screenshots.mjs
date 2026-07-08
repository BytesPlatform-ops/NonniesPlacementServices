import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "docs/audit-screenshots/final";
const pages = [
  ["/", "home-desktop.png"],
  ["/families", "families-desktop.png"],
  ["/providers", "providers-desktop.png"],
  ["/pricing", "pricing-desktop.png"],
  ["/about", "about-desktop.png"],
  ["/contact", "contact-desktop.png"],
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

// Desktop full-page (motion on so WebGL/carousel render).
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (const [route, file] of pages) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 650) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 55)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
  try {
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true, animations: "disabled", timeout: 60000 });
    console.log("saved", file);
  } catch (e) {
    console.log("retry viewport-only", file, e.message);
    await page.screenshot({ path: `${OUT}/${file}`, animations: "disabled", timeout: 60000 });
  }
}

// Hero viewport (WebGL), marketplace, ai dashboard focus shots.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/home-hero.png` });
console.log("saved home-hero.png");

// Loader
await page.goto(BASE + "/?loader=1", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/loader.png` });
console.log("saved loader.png");

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
console.log("saved home-mobile.png");

await browser.close();
