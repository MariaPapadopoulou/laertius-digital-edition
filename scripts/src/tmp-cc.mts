import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import "./lib/playwright-browsers-path";
const require2 = createRequire(import.meta.url);
const AXE = readFileSync(require2.resolve("axe-core/axe.min.js"), "utf8");
const { chromium } = await import("playwright-core");
const b = await chromium.launch({ headless: true });
for (const [route, theme] of [["/verses","light"],["/timeline","light"],["/graph","light"],["/terminology/names","light"],["/section/1.prol.1","light"],["/legomena/sparql","light"],["/","dark"]] as const) {
  const ctx = await b.newContext({ viewport:{width:1280,height:900}, colorScheme: theme as any });
  await ctx.addInitScript((t:string)=>localStorage.setItem("laertius-theme",t), theme);
  const p = await ctx.newPage();
  await p.goto("http://localhost:80"+route,{waitUntil:"load"});
  await p.waitForLoadState("networkidle",{timeout:8000}).catch(()=>{});
  await p.evaluate((t:string)=>document.documentElement.classList.toggle("dark",t==="dark"), theme);
  await p.waitForTimeout(600);
  await p.evaluate(AXE);
  const out = await p.evaluate(`axe.run(document,{runOnly:{type:"rule",values:["color-contrast"]}}).then(r=>r.violations.flatMap(v=>v.nodes.slice(0,60).map(n=>n.any[0]?.message+" :: "+n.target.join(" "))))`) as string[];
  console.log("== "+route+" ["+theme+"] "+out.length);
  const seen = new Set<string>();
  for (const m of out) { const k = (m as string).split("::")[0]; if (seen.has(k)) continue; seen.add(k); console.log("  "+m); }
  await ctx.close();
}
await b.close();
