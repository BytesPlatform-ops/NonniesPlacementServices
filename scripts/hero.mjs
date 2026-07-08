import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/", { waitUntil:"networkidle" });
await p.waitForTimeout(5000);
await p.screenshot({ path:"docs/audit-screenshots/new-site/home-hero-webgl.png" });
console.log("hero shot done");
await b.close();
