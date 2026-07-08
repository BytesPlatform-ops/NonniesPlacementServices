import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"load"});
await p.waitForTimeout(4500);
const targets = {"pricing":"pricing","marketplace":"marketplace","how":"how-it-works"};
for (const [name,id] of Object.entries(targets)){
  const y = await p.evaluate((i)=>document.getElementById(i)?.offsetTop||0, id);
  await p.evaluate((yy)=>{ if(window.lenis) window.lenis.scrollTo(yy-20,{immediate:true}); else window.scrollTo(0,yy-20); }, y);
  await p.waitForTimeout(1800);
  await p.screenshot({ path:`docs/audit-screenshots/final/L-${name}.png` });
  console.log(name, "y=", y);
}
await b.close();
