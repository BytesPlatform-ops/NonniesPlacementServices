import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(4500);
const H = await p.evaluate(()=>document.body.scrollHeight);
let i=0;
for(let y=0; y<H; y+=860){
  await p.evaluate((yy)=>window.scrollTo(0,yy), y);
  await p.waitForTimeout(700);
  await p.screenshot({ path:`docs/audit-screenshots/final/sweep-${String(i).padStart(2,"0")}.png` });
  i++;
}
console.log("sweep frames:", i, "pageHeight:", H);
await b.close();
