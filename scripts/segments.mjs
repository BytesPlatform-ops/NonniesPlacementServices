import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(4500);
const ids=["how-it-works","ai-matching","audiences","care-story","service-area","pricing"];
for(const id of ids){
  await p.evaluate((i)=>document.getElementById(i)?.scrollIntoView({block:"start"}), id);
  await p.waitForTimeout(1400);
  await p.screenshot({ path:`docs/audit-screenshots/final/seg-${id}.png` });
  console.log("seg", id);
}
await b.close();
