import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
const errs=[];
p.on("pageerror", e=>errs.push("PAGEERROR: "+String(e).slice(0,200)));
p.on("console", m=>{ if(m.type()==="error") errs.push("CONSOLE: "+m.text().slice(0,200)); });
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(7000);
// Check computed opacity of the headline word + first CTA
const info = await p.evaluate(()=>{
  const w=document.querySelector("[data-word]");
  const card=document.querySelector("[data-card]");
  const g=(el)=>el?getComputedStyle(el).opacity:"none";
  return { word:g(w), card:g(card), wordText:w?.textContent, bodyReady:window.__nonnisReady };
});
console.log("reveal state:", JSON.stringify(info));
console.log("errors:", errs.length, errs.slice(0,4));
await p.screenshot({ path:"docs/audit-screenshots/final/home-hero.png" });
await b.close();
