import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(4000);
const info = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll("section").forEach((s)=>{
    const r=s.getBoundingClientRect();
    const id=s.id||s.getAttribute("aria-label")||"(none)";
    out.push({id, top: Math.round(s.offsetTop), h: Math.round(r.height)});
  });
  const hiw=document.getElementById("how-it-works");
  const heading=hiw?.querySelector("h2");
  const op = heading? getComputedStyle(heading.closest("div")||heading).opacity : "n/a";
  return { sections: out, hiwHeight: hiw?Math.round(hiw.getBoundingClientRect().height):0, headingOpacity: op };
});
console.log(JSON.stringify(info,null,1));
await b.close();
