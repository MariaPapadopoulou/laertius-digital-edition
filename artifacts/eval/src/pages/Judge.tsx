import { useState, useEffect } from "react";
import { useRoute } from "wouter";

// This is just a minimal wrapper to serve the raw static HTML file.
// The task requires us to use the provided judge HTML file directly 
// without sharing the App layout navigation. We'll fetch it as text 
// and inject it, or just use an iframe for total isolation.
// Since we want exactly the behavior of the provided HTML, an iframe is safest 
// to avoid CSS collision with Tailwind and keep the DOM isolated.

export default function Judge() {
  const [, params] = useRoute("/judge");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // In a real app we'd fetch the HTML file from public/ or an API,
    // but since we don't have a way to put it in public easily here,
    // we'll fetch it from the assets server if available, or just render 
    // a placeholder instructing to use the standalone file.
    
    // To ensure it works independently, we'll embed the HTML content directly.
    // The exact HTML content from attached_assets/laertius_judge_1785903423767.html
    const judgeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laertius — Expert Judgment</title>
<style>
  :root{
    --ground:#E4E6E0;
    --paper:#FBFAF7;
    --ink:#14181A;
    --muted:#5F6560;
    --rule:#C9CDC3;
    --accent:#2F4858;
    --accent-soft:#DDE3E6;
    --flag:#A8501E;
    --g3:#2F4858;
    --g2:#4E7A6E;
    --g1:#8A8F62;
    --g0:#9A9A93;
    --grc:"New Athena Unicode","Cardo","GFS Didot","Palatino Linotype","Times New Roman",serif;
    --ui:"Inter","Helvetica Neue",Arial,system-ui,sans-serif;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    background:var(--ground);color:var(--ink);font-family:var(--ui);
    font-size:15px;line-height:1.5;
    display:flex;flex-direction:column;
  }
  button{font-family:inherit;font-size:inherit;cursor:pointer}
  input,textarea,select{font-family:inherit;font-size:inherit}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  /* ---------- chrome ---------- */
  header{
    display:flex;align-items:baseline;gap:16px;
    padding:10px 20px;border-bottom:1px solid var(--rule);
    background:var(--paper);flex:0 0 auto;flex-wrap:wrap;
  }
  .wordmark{font-family:var(--grc);font-size:19px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--accent);font-weight:600}
  .wordmark small{display:block;font-family:var(--ui);font-size:10px;
    letter-spacing:.18em;color:var(--muted);font-weight:500;margin-top:1px}
  .meta{margin-left:auto;display:flex;gap:18px;align-items:baseline;
    font-family:var(--mono);font-size:12px;color:var(--muted)}
  .meta b{color:var(--ink);font-weight:600}

  main{flex:1 1 auto;overflow-y:auto;padding:20px;display:flex;justify-content:center}
  .wrap{width:100%;max-width:1180px}

  /* ---------- setup ---------- */
  .setup{background:var(--paper);border:1px solid var(--rule);padding:26px;max-width:760px;margin:0 auto}
  .setup h1{font-family:var(--grc);font-size:26px;margin:0 0 4px;font-weight:600}
  .setup p.lede{color:var(--muted);margin:0 0 22px;max-width:62ch}
  .field{margin-bottom:16px}
  .field label{display:block;font-size:12px;letter-spacing:.08em;
    text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  .field input[type=text]{width:100%;padding:9px 11px;border:1px solid var(--rule);
    background:#fff;border-radius:0}
  .batchlist{display:flex;flex-direction:column;gap:8px}
  .batchcard{display:flex;align-items:center;gap:12px;text-align:left;width:100%;
    border:1px solid var(--rule);background:#fff;padding:10px 14px}
  .batchcard:hover{border-color:var(--accent);background:var(--accent-soft)}
  .batchcard .bc-main{flex:1 1 auto;min-width:0}
  .batchcard .bc-title{font-size:14px;color:var(--ink)}
  .batchcard .bc-sub{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:2px}
  .batchcard .bc-tag{flex:0 0 auto;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
    background:var(--accent-soft);color:var(--accent);padding:2px 8px}
  .batchcard .bc-tag.progress{background:#fff;color:var(--muted);border:1px solid var(--rule)}
  .batchcard.next{border-color:var(--accent);border-width:2px;background:var(--accent-soft)}
  .batchcard .bc-go{flex:0 0 auto;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    background:var(--accent);color:#fff;padding:4px 12px}
  .batchmsg{color:var(--muted)}
  .submitbox{background:#fff;border:1px solid var(--rule);padding:12px 14px;margin-top:14px}
  .submitbox.ok{border-left:3px solid var(--g2)}
  .submitbox.err{border-left:3px solid var(--flag)}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px}
  .btn{background:var(--accent);color:#fff;border:1px solid var(--accent);
    padding:9px 18px;letter-spacing:.02em}
  .btn[disabled]{opacity:.4;cursor:not-allowed}
  .btn.ghost{background:transparent;color:var(--accent)}
  .btn.quiet{background:transparent;color:var(--muted);border-color:var(--rule)}
  details.schema{margin-top:24px;border-top:1px solid var(--rule);padding-top:14px}
  details.schema summary{cursor:pointer;font-size:13px;color:var(--accent)}
  pre{font-family:var(--mono);font-size:12px;background:#fff;border:1px solid var(--rule);
    padding:12px;overflow-x:auto;line-height:1.45}

  /* ---------- item ---------- */
  .item{display:grid;grid-template-columns:minmax(280px,1fr) minmax(340px,1.35fr);gap:18px}
  .panel{background:var(--paper);border:1px solid var(--rule);padding:18px 20px}
  .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--muted);margin:0 0 8px;display:flex;justify-content:space-between;gap:10px}
  .eyebrow .id{font-family:var(--mono);letter-spacing:0;text-transform:none}
  .question{font-size:19px;line-height:1.45;margin:0 0 14px}
  .question[lang=grc],.grc{font-family:var(--grc)}
  .qlang{display:flex;align-items:center;gap:10px;margin:0 0 10px}
  .qlang-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .qlang-seg{display:inline-flex;border:1px solid var(--rule)}
  .qlang-opt{font-family:var(--mono);font-size:11px;letter-spacing:.06em;
    padding:2px 10px;background:#fff;color:var(--muted);border:none;border-left:1px solid var(--rule);cursor:pointer}
  .qlang-opt:first-child{border-left:none}
  .qlang-opt.on{background:var(--accent);color:#fff}
  .qlang-note{font-size:11px;color:var(--muted);margin:-8px 0 14px}
  .grc{font-size:19px;line-height:1.75}
  .en{margin-top:14px;padding-top:14px;border-top:1px solid var(--rule);
    color:var(--muted);font-size:14px;line-height:1.6}
  .claim{border-left:3px solid var(--accent);padding:8px 0 8px 12px;margin:12px 0;font-size:15px}
  .answer{background:#fff;border:1px solid var(--rule);padding:12px;margin-top:10px;font-size:14.5px}
  .kv{font-family:var(--mono);font-size:12px;color:var(--muted);margin-top:12px}
  .calib{display:inline-block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    background:var(--accent-soft);color:var(--accent);padding:2px 7px}

  /* ---------- grading ---------- */
  footer{flex:0 0 auto;background:var(--paper);border-top:1px solid var(--rule);padding:12px 20px}
  .grades{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:stretch}
  .grade{
    flex:1 1 130px;max-width:230px;background:#fff;border:1px solid var(--rule);
    padding:9px 12px;text-align:left;display:flex;gap:10px;align-items:flex-start;
    transition:background .12s,border-color .12s;
  }
  .grade:hover{border-color:var(--accent)}
  .grade kbd{font-family:var(--mono);font-size:12px;background:var(--ground);
    border:1px solid var(--rule);padding:1px 6px;flex:0 0 auto}
  .grade .lbl{font-size:13px;line-height:1.3}
  .grade .lbl b{display:block;font-size:13.5px}
  .grade .lbl span{color:var(--muted);font-size:11.5px}
  .grade[data-g="3"]:hover,.grade[data-g="3"].on{border-color:var(--g3);background:var(--accent-soft)}
  .grade[data-g="2"]:hover,.grade[data-g="2"].on{border-color:var(--g2)}
  .grade[data-g="1"]:hover,.grade[data-g="1"].on{border-color:var(--g1)}
  .grade[data-g="0"]:hover,.grade[data-g="0"].on{border-color:var(--g0)}
  .subscale{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:8px}
  .subscale .grp{display:flex;align-items:center;gap:6px;font-size:12.5px}
  .subscale .grp>span{color:var(--muted);min-width:96px;text-align:right}
  .subscale button{background:#fff;border:1px solid var(--rule);padding:4px 10px;font-size:12.5px}
  .subscale button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
  .controls{display:flex;gap:10px;align-items:center;justify-content:center;
    margin-top:10px;flex-wrap:wrap}
  .note{flex:1 1 320px;max-width:520px;padding:6px 10px;border:1px solid var(--rule);background:#fff}
  .flagbtn{border:1px solid var(--rule);background:#fff;padding:6px 12px;color:var(--flag)}
  .flagbtn.on{background:var(--flag);color:#fff;border-color:var(--flag)}

  /* ---------- signature: the judgment rail ---------- */
  .rail{display:flex;gap:1px;height:16px;margin:12px 0 0;align-items:flex-end;overflow:hidden}
  .rail i{flex:1 1 auto;min-width:1px;background:var(--rule);height:5px;transition:height .15s}
  .rail i[data-g="3"]{background:var(--g3);height:16px}
  .rail i[data-g="2"]{background:var(--g2);height:12px}
  .rail i[data-g="1"]{background:var(--g1);height:9px}
  .rail i[data-g="0"]{background:var(--g0);height:6px}
  .rail i.done{background:var(--g2)}
  .rail i.cur{background:var(--flag);height:16px}
  .raillbl{font-family:var(--mono);font-size:10.5px;color:var(--muted);
    display:flex;justify-content:space-between;margin-top:4px}
  .keyhint{font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:6px}

  /* ---------- done ---------- */
  .done{background:var(--paper);border:1px solid var(--rule);padding:26px;max-width:760px;margin:0 auto}
  table{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:10px}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rule)}
  th{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  td.num{font-family:var(--mono);text-align:right}
  .warn{background:#fff;border-left:3px solid var(--flag);padding:10px 14px;
    margin-top:16px;font-size:13.5px}
  .hide{display:none!important}
  @media (max-width:820px){ .item{grid-template-columns:1fr} }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>

<header>
  <div class="wordmark"><a href="/" style="text-decoration:none;color:inherit;">Laertius</a><small>Expert Judgment</small></div>
  <div class="meta" id="meta"></div>
</header>

<main><div class="wrap">

  <!-- ============ SETUP ============ -->
  <section class="setup" id="setup">
    <h1>Load batch</h1>
    <p class="lede">Each judge works in their own randomized order. Neither which system returned the passage nor how another judge rated it is shown. Open your personal link, or paste your personal access key, to see the batches assigned to you.</p>

    <div class="field">
      <label for="annot">Personal access key</label>
      <input type="text" id="annot" placeholder="paste the access key from your personal link" autocomplete="off">
    </div>

    <div class="field" id="batches-field">
      <label>Your batches</label>
      <div id="batches" class="kv">Paste your personal access key above to load your assigned batches.</div>
    </div>

    <div class="row">
      <button class="btn quiet hide" id="resume" type="button">Resume from saved</button>
    </div>
  </section>

  <!-- ============ ITEM ============ -->
  <section class="item hide" id="item">
    <div class="panel" id="left"></div>
    <div class="panel" id="right"></div>
  </section>

  <!-- ============ DONE ============ -->
  <section class="done hide" id="done"></section>

</div></main>

<footer id="footer" class="hide">
  <div id="scale"></div>
  <div class="controls">
    <button class="btn quiet" id="prev">← Previous</button>
    <input type="text" class="note" id="note" placeholder="Note (optional)">
    <button class="flagbtn" id="flag">⚑ Flag (F)</button>
    <button class="btn quiet" id="next">Next →</button>
    <button class="btn ghost" id="upload" style="margin-left:10px">Submit to server</button>
  </div>
  <div class="rail" id="rail"></div>
  <div class="raillbl"><span id="railA"></span><span id="railB"></span></div>
  <div class="keyhint">Keys: 3/2/1/0 grade · ←/→ navigate · F flag</div>
</footer>

<script>
"use strict";

/* ------------------------------------------------------------------ state */
const S = {
  annotator:"", token:"", batchId:"", poolId:"", items:[], order:[], i:0,
  judgments:{},           // item_id -> record
  nextBatchId:null,       // the single unsubmitted batch, if any (Enter opens it)
  shownAt:0, storageOK:true
};

const RELEVANCE = [
  {g:"3", key:"3", t:"Primary testimony", d:"answers fully and directly"},
  {g:"2", key:"2", t:"Partial / parallel", d:"part of the answer or a parallel passage"},
  {g:"1", key:"1", t:"Related", d:"same topic, does not answer"},
  {g:"0", key:"0", t:"Irrelevant", d:"contributes nothing"}
];
const CERTAINTY = [
  {g:"asserted",    key:"a", t:"Asserted",    d:"in Laertius's own voice, without reservation"},
  {g:"reported",    key:"r", t:"Reported",    d:"φησί / λέγεται / named source"},
  {g:"disputed",    key:"d", t:"Disputed",    d:"οἱ μὲν … οἱ δέ, conflicting versions"},
  {g:"conjectured", key:"c", t:"Conjectured", d:"δοκεῖ / ἔοικε / inference"}
];
const ANSWER_ROWS = [
  {id:"supported", label:"Supported", keys:["q","w","e"],
   opts:[["2","fully"],["1","partially"],["0","no"]]},
  {id:"correct", label:"Correct", keys:["a","s","d"],
   opts:[["2","yes"],["1","partly"],["0","no"]]},
  {id:"citation", label:"Citation", keys:["z","x","c"],
   opts:[["2","correct"],["1","incomplete"],["0","wrong"]]}
];

/* ------------------------------------------------------------- utilities */
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]));

function hash(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function shuffled(n, seed){ const r=mulberry(seed), a=[...Array(n).keys()];
  for(let i=n-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function store(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ S.storageOK=false; } }
function load(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ S.storageOK=false; return null; } }
const KEY = () => "laertius_judge:"+S.batchId+":"+S.annotator;
const LAST_TOKEN_KEY = "laertius_judge:last_key";
const QLANG_KEY = "laertius_judge:qlang";
// Question display language: "el" (original Greek) or "en". Conservative
// default is the original text so judges see exactly what was authored.
function qlang(){
  const v = load(QLANG_KEY);
  return v === "en" ? "en" : "el";
}
function setQlang(v){ store(QLANG_KEY, v === "en" ? "en" : "el"); }
// Resolve the question text/lang for an item given the current toggle.
// EN shows question_en when present; if absent it falls back to the Greek
// text and flags "(no English version)". EL always shows the original.
function questionView(it){
  if(qlang() === "en"){
    if(it.question_en){ return { text: it.question_en, lang: "en", note: false }; }
    return { text: it.question, lang: (it.question_lang==='grc'?'grc':(it.question_lang||'en')), note: true };
  }
  return { text: it.question, lang: (it.question_lang==='grc'?'grc':(it.question_lang||'en')), note: false };
}
// Saved progress for a specific batch+judge code without touching global S.
function savedProgress(batchId, code){
  const raw = load("laertius_judge:"+batchId+":"+code);
  if(!raw || !raw.judgments) return null;
  const done = Object.keys(raw.judgments).length;
  return done > 0 ? done : null;
}

/* ----------------------------------------------------------- batch input */
function parseBatch(text){
  const t = text.trim();
  let arr;
  if(t.startsWith("[")){ arr = JSON.parse(t); }
  else { arr = t.split("\\n").filter(l=>l.trim() && !l.trim().startsWith("#")).map(l=>JSON.parse(l)); }
  return arr.filter(o=>o && o.item_id).map(o=>({
    item_id:String(o.item_id),
    task:(o.task||"relevance").toLowerCase(),
    question:o.question||"", question_lang:o.question_lang||"en",
    question_en:o.question_en||"",
    claim:o.claim||"", candidate_answer:o.candidate_answer||"",
    evidence:Array.isArray(o.evidence)?o.evidence:null,
    passage_id:o.passage_id||"", cts_urn:o.cts_urn||"",
    text_grc:o.text_grc||"", text_en:o.text_en||"",
    calibration:!!o.calibration,
    reference_grade:(o.reference_grade===undefined?null:o.reference_grade)
  }));
}

/* Load a server batch into state and begin the session immediately.
   Batches are always server-driven: judges never upload or download. */
function loadServerBatch(batch, id){
  let items;
  try{ items = parseBatch(JSON.stringify(batch.items)); }
  catch(e){ setBatchMsg("Could not read the batch from the server: " + e.message); return; }
  if(!items.length){ setBatchMsg("This batch has no records."); return; }
  S.items = items;
  S.poolId = batch.poolId || "";
  S.batchId = id;
  // The judge identity is the server's word, resolved from the access
  // key — never something typed by the judge.
  S.annotator = String(batch.annotator || "");
  begin(!!load(KEY()));
}

function setBatchMsg(msg){
  const box = $("batches");
  if(box) box.innerHTML = '<div class="batchmsg">' + esc(msg) + '</div>';
}

/* Ask the server which batches belong to the presented access key. The
   server resolves the key to the judge code itself, so a judge can never
   list (or open) anyone else's assignments. */
function refreshBatches(){
  const key = $("annot").value.trim();
  const box = $("batches");
  $("resume").classList.toggle("hide", true);
  if(!key){ S.nextBatchId = null; setBatchMsg("Paste your personal access key above to load your assigned batches."); return; }
  setBatchMsg("Loading your batches…");
  fetch('/api/eval/judge/batches', { headers: { 'X-Judge-Token': key } })
    .then(res => {
      if(res.status === 401) throw new Error("This access key is not recognized. Ask the coordinator for your personal link.");
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(data => {
      if(key !== $("annot").value.trim()) return; // stale response
      S.token = key;
      S.annotator = String(data.annotator || "");
      const code = S.annotator;
      const mine = (data.batches || []);
      if(!mine.length){
        S.nextBatchId = null;
        setBatchMsg("No batch is assigned to you yet. Ask the coordinator.");
        return;
      }
      // Remember this key so returning judges are prefilled next visit.
      store(LAST_TOKEN_KEY, key);
      mine.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      // If exactly one batch is unsubmitted, mark it as the obvious next action.
      const unsubmitted = mine.filter(b => !b.submitted);
      const nextId = unsubmitted.length === 1 ? unsubmitted[0].id : null;
      S.nextBatchId = nextId;
      box.innerHTML = '<div class="batchlist">' + mine.map(b => {
        const label = b.poolLabel ? b.poolLabel : ("pool " + b.poolId);
        const when = b.createdAt ? new Date(b.createdAt).toLocaleString() : "";
        let tag = '';
        if(b.submitted){
          tag = '<span class="bc-tag">submitted</span>';
        } else {
          const done = savedProgress(b.id, code);
          if(done !== null) tag = '<span class="bc-tag progress">in progress — ' + done + ' of ' + b.itemCount + ' judged</span>';
        }
        const isNext = b.id === nextId;
        if(isNext){
          const done = savedProgress(b.id, code);
          tag += '<span class="bc-go">' + (done !== null ? 'Continue' : 'Start') + '</span>';
        }
        return '<button class="batchcard' + (isNext ? ' next' : '') + '" type="button" data-batch="' + esc(b.id) + '">' +
          '<span class="bc-main">' +
            '<span class="bc-title">' + esc(label) + '</span>' +
            '<span class="bc-sub">' + esc(b.id) + ' · ' + b.itemCount + ' records · ' + esc(when) + '</span>' +
          '</span>' + tag +
        '</button>';
      }).join("") + '</div>';
      box.querySelectorAll(".batchcard").forEach(btn =>
        btn.addEventListener("click", () => loadBatchById(btn.dataset.batch)));
    })
    .catch(err => { setBatchMsg("Could not load batches: " + err.message); });
}

/* Deep-link / click loader shared by ?batch= and the batch list. The
   access key rides along; the server refuses batches issued to others. */
function loadBatchById(id){
  const key = S.token || $("annot").value.trim();
  if(!key){ setBatchMsg("Paste your personal access key first."); return; }
  S.token = key;
  setBatchMsg("Loading batch " + id + "…");
  fetch('/api/eval/batches/' + encodeURIComponent(id), { headers: { 'X-Judge-Token': key } })
    .then(res => {
      if(res.status === 401) throw new Error("This access key is not recognized.");
      if(res.status === 403) throw new Error("This batch was issued to another judge.");
      if(!res.ok) throw new Error("Batch not found: " + id);
      return res.json();
    })
    .then(batch => { loadServerBatch(batch, id); })
    .catch(err => { setBatchMsg("Error fetching batch: " + err.message); });
}

/* --------------------------------------------------------------- session */
function begin(resume){
  const saved = resume ? load(KEY()) : null;
  S.judgments = saved && saved.judgments ? saved.judgments : {};
  S.order = shuffled(S.items.length, hash(S.batchId + "|" + S.annotator));
  S.i = 0;
  if(saved && typeof saved.i === "number") S.i = Math.min(saved.i, S.items.length-1);
  $("setup").classList.add("hide");
  $("item").classList.remove("hide");
  $("footer").classList.remove("hide");
  buildRail();
  render();
}

function cur(){ return S.items[S.order[S.i]]; }
function rec(){ return S.judgments[cur().item_id] || null; }

function save(){
  store(KEY(), {i:S.i, judgments:S.judgments, annotator:S.annotator, batchId:S.batchId, poolId:S.poolId});
}

/* ---------------------------------------------------------------- render */
function render(){
  const it = cur();
  S.shownAt = performance.now();
  const j = rec();

  const head = (label, extra="") =>
    \`<p class="eyebrow"><span>\${label}\${it.calibration?' <span class="calib">calibration</span>':''}</span>\`+
    \`<span class="id">\${esc(it.item_id)}\${extra}</span></p>\`;

  // Question block with an EL / EN language toggle. Greek keeps the Greek
  // font via lang="grc"; English uses the normal font.
  const qlangToggle = () => {
    const cur = qlang();
    return \`<div class="qlang"><span class="qlang-lbl">Question language</span>\`+
      \`<span class="qlang-seg">\`+
        \`<button type="button" class="qlang-opt\${cur==='el'?' on':''}" data-qlang="el">ΕΛ</button>\`+
        \`<button type="button" class="qlang-opt\${cur==='en'?' on':''}" data-qlang="en">EN</button>\`+
      \`</span></div>\`;
  };
  const questionBlock = () => {
    const q = questionView(it);
    return qlangToggle() +
      \`<p class="question" lang="\${q.lang}">\${esc(q.text)}</p>\` +
      (q.note ? '<p class="qlang-note">(no English version)</p>' : '');
  };

  /* left panel — the task */
  let left = "";
  if(it.task === "relevance"){
    left = head("Question") +
      questionBlock() +
      \`<p class="kv">Judge whether <em>this passage</em> supports the answer — not whether the question is a good one.</p>\`;
  } else if(it.task === "certainty"){
    left = head("Claim") +
      \`<div class="claim">\${esc(it.claim)}</div>\` +
      \`<p class="kv">Rate how Laertius presents it, not the historical truth.</p>\`;
  } else {
    left = head("Question and answer") +
      questionBlock() +
      \`<div class="answer">\${esc(it.candidate_answer)}</div>\` +
      \`<p class="kv">Supported = grounded in the passages on the right. Correctness = it is correct. Judged separately.</p>\`;
  }
  $("left").innerHTML = left;
  // Wire the toggle: switch the persisted choice and re-render the item.
  $("left").querySelectorAll(".qlang-opt").forEach(b =>
    b.addEventListener("click", () => {
      if(b.dataset.qlang === qlang()) return;
      setQlang(b.dataset.qlang);
      render();
    }));

  /* right panel — the text */
  const passages = it.evidence && it.evidence.length ? it.evidence :
    [{passage_id:it.passage_id, cts_urn:it.cts_urn, text_grc:it.text_grc, text_en:it.text_en}];
  $("right").innerHTML = passages.map(p =>
    \`<p class="eyebrow"><span>Passage</span><span class="id">\${esc(p.passage_id||"")}</span></p>\` +
    (p.text_grc ? \`<div class="grc">\${esc(p.text_grc)}</div>\` : \`<div class="kv">— no Greek text provided —</div>\`) +
    (p.text_en ? \`<div class="en">\${esc(p.text_en)}</div>\` : "")
  ).join('<hr style="border:0;border-top:1px solid var(--rule);margin:16px 0">');

  /* footer scale */
  $("scale").innerHTML = it.task === "answer" ? answerScaleHTML(j) : gradeScaleHTML(it, j);
  wireScale(it);

  $("note").value = j && j.notes ? j.notes : "";
  $("flag").classList.toggle("on", !!(j && j.flag));
  $("prev").disabled = S.i === 0;

  const n = Object.keys(S.judgments).length;
  $("meta").innerHTML =
    \`<span>judge <b>\${esc(S.annotator)}</b></span>\` +
    \`<span>\${S.i+1} / \${S.items.length}</span>\` +
    \`<span>judged <b>\${n}</b></span>\` +
    (S.storageOK ? "" : \`<span style="color:var(--flag)">no auto-save</span>\`);
  paintRail();
  $("railA").textContent = "The bar shows the distribution of your own judgments";
  $("railB").textContent = distSummary();
}

function gradeScaleHTML(it, j){
  const scale = it.task === "certainty" ? CERTAINTY : RELEVANCE;
  return \`<div class="grades">\` + scale.map(s =>
    \`<button class="grade\${j && j.grade===s.g ? " on":""}" data-g="\${s.g}" data-key="\${s.key}">
       <kbd>\${s.key.toUpperCase()}</kbd>
       <span class="lbl"><b>\${s.t}</b><span>\${s.d}</span></span>
     </button>\`).join("") + \`</div>\`;
}

function answerScaleHTML(j){
  return \`<div class="subscale">\` + ANSWER_ROWS.map(r =>
    \`<div class="grp" data-row="\${r.id}"><span>\${r.label}</span>\` +
      r.opts.map((o,k) =>
        \`<button data-row="\${r.id}" data-val="\${o[0]}"\${j && j.scores && j.scores[r.id]===o[0]?' class="on"':''}>
           \${o[1]} <kbd style="font-family:var(--mono);font-size:10px">\${r.keys[k].toUpperCase()}</kbd>
         </button>\`).join("") +
    \`</div>\`).join("") + \`</div>\`;
}

function wireScale(it){
  $("scale").querySelectorAll(".grade").forEach(b =>
    b.addEventListener("click", () => setGrade(b.dataset.g)));
  $("scale").querySelectorAll(".subscale button").forEach(b =>
    b.addEventListener("click", () => setScore(b.dataset.row, b.dataset.val)));
}

/* ---------------------------------------------------------- record entry */
function ensure(){
  const it = cur();
  if(!S.judgments[it.item_id]){
    S.judgments[it.item_id] = {
      item_id:it.item_id, task:it.task, annotator:S.annotator,
      batch_id:S.batchId, order_index:S.i,
      grade:null, scores:{}, flag:false, notes:"", ms:0, ts:null,
      calibration:it.calibration
    };
  }
  return S.judgments[it.item_id];
}

function stamp(r){
  r.ms += Math.round(performance.now() - S.shownAt);
  S.shownAt = performance.now();
  r.ts = new Date().toISOString();
  r.notes = $("note").value.trim();
}

function setGrade(g){
  const r = ensure(); r.grade = g; stamp(r); save();
  checkpoint();
  render();
  setTimeout(() => { if(S.i < S.items.length-1) go(1); else finish(); }, 90);
}

function setScore(row, val){
  const r = ensure(); r.scores[row] = val; stamp(r); save();
  const complete = ANSWER_ROWS.every(x => r.scores[x.id] !== undefined);
  if(complete) checkpoint();
  render();
  if(complete) setTimeout(() => { if(S.i < S.items.length-1) go(1); else finish(); }, 120);
}

/* Best-effort checkpoint every 10 judgments. Ingest is replace-idempotent
   (keyed by item_id+annotator), so re-posting is safe; errors are ignored
   because the finish() submit is authoritative. */
function checkpoint(){
  const n = Object.values(S.judgments).filter(j => j.grade!=null || Object.keys(j.scores||{}).length).length;
  if(S.poolId && n > 0 && n % 10 === 0) submitToServer(true);
}

function go(d){
  const r = S.judgments[cur().item_id];
  if(r) stamp(r);
  S.i = Math.max(0, Math.min(S.items.length-1, S.i + d));
  save(); render();
}

function toggleFlag(){
  const r = ensure(); r.flag = !r.flag; stamp(r); save();
  $("flag").classList.toggle("on", r.flag);
}

/* ------------------------------------------------------ signature: rail */
function buildRail(){
  $("rail").innerHTML = S.items.map(() => "<i></i>").join("");
}
function paintRail(){
  const ticks = $("rail").children;
  for(let k=0;k<S.order.length;k++){
    const it = S.items[S.order[k]];
    const j = S.judgments[it.item_id];
    const el = ticks[k]; if(!el) continue;
    el.removeAttribute("data-g"); el.className = "";
    if(j && j.grade !== null && j.grade !== undefined && /^[0-3]$/.test(j.grade)) el.setAttribute("data-g", j.grade);
    else if(j && (j.grade || Object.keys(j.scores||{}).length)) el.className = "done";
    if(k === S.i) el.className = "cur";
  }
}
function distSummary(){
  const c = {};
  Object.values(S.judgments).forEach(j => { if(j.grade!=null) c[j.grade] = (c[j.grade]||0)+1; });
  const total = Object.values(c).reduce((a,b)=>a+b,0);
  if(!total) return "";
  return Object.entries(c).sort().map(([k,v]) => k+" " + Math.round(100*v/total) + "%").join("  ");
}

/* ----------------------------------------------------------------- done */
function finish(){
  const vals = Object.values(S.judgments);
  const graded = vals.filter(j => j.grade!=null || Object.keys(j.scores||{}).length);
  const times = graded.map(j => j.ms/1000).sort((a,b)=>a-b);
  const median = times.length ? times[Math.floor(times.length/2)].toFixed(1) : "—";
  const dist = {};
  vals.forEach(j => { if(j.grade!=null) dist[j.grade] = (dist[j.grade]||0)+1; });

  const calib = vals.filter(j => j.calibration);
  let calibHTML = "";
  if(calib.length){
    let agree = 0, comparable = 0;
    calib.forEach(j => {
      const it = S.items.find(x => x.item_id === j.item_id);
      if(it && it.reference_grade != null && j.grade != null){
        comparable++; if(String(it.reference_grade) === String(j.grade)) agree++;
      }
    });
    calibHTML = comparable
      ? \`<p class="kv">Calibration: agreement \${agree}/\${comparable} with the adjudicated values.</p>\`
      + (agree/comparable < 0.7 ? \`<div class="warn">Agreement below 70% on the calibration items. Re-read the guidelines before continuing to a new batch — do not revise the judgments you have already given.</div>\` : "")
      : \`<p class="kv">Calibration items: \${calib.length} (no reference values in the file).</p>\`;
  }

  $("item").classList.add("hide");
  $("done").classList.remove("hide");
  $("done").innerHTML =
    \`<h1 style="font-family:var(--grc);font-size:24px;margin:0 0 6px">End of batch</h1>
     <p class="lede" style="color:var(--muted)">Your judgments are submitted to the server automatically. There is nothing to download or send.</p>
     <table>
       <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
       <tr><td>Batch records</td><td class="num">\${S.items.length}</td></tr>
       <tr><td>Judged</td><td class="num">\${graded.length}</td></tr>
       <tr><td>Median time per judgment</td><td class="num">\${median}s</td></tr>
       <tr><td>Flagged</td><td class="num">\${vals.filter(j=>j.flag).length}</td></tr>
       \${Object.entries(dist).sort().map(([k,v]) =>
         \`<tr><td>Grade <code>\${esc(k)}</code></td><td class="num">\${v} (\${Math.round(100*v/graded.length)}%)</td></tr>\`).join("")}
     </table>
     \${calibHTML}
     <div class="submitbox" id="submitbox">Submitting to the server…</div>
     <div class="row">
       <button class="btn quiet" id="back">Return to batch</button>
       <button class="btn quiet" id="clear">Delete local data</button>
     </div>\`;
  $("back").onclick = () => { $("done").classList.add("hide"); $("item").classList.remove("hide"); render(); };
  $("clear").onclick = () => {
    if(confirm("Delete the saved judgments for this batch from the browser?")){
      try{ localStorage.removeItem(KEY()); }catch(e){}
      location.reload();
    }
  };
  // Authoritative submit on finish, with an inline result and a retry path.
  submitToServer(false);
}

/* Submit all judgments to the server.
   quiet=true is a best-effort checkpoint (errors ignored, no UI).
   quiet=false renders the inline result on the done screen and offers retry. */
function submitToServer(quiet){
  if (!S.poolId){
    if(!quiet) renderSubmitResult({ error: "This batch is not linked to a pool and cannot be submitted." });
    return;
  }
  const lines = Object.values(S.judgments).map(j => JSON.stringify(j)).join("\\n")+"\\n";
  const btn = document.getElementById("upload");
  if(!quiet && btn) btn.disabled = true;
  const box = document.getElementById("submitbox");
  if(!quiet && box){ box.className = "submitbox"; box.textContent = "Submitting to the server…"; }

  fetch('/api/eval/judgments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annotator: S.annotator, token: S.token, batchId: S.batchId, lines: lines })
  })
  .then(res => {
    if(res.status === 401 || res.status === 403) throw new Error("Your access key was refused (HTTP " + res.status + "). Ask the coordinator for your personal link.");
    if(!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  })
  .then(data => {
    if(!quiet) renderSubmitResult(data);
  })
  .catch(err => {
    if(!quiet) renderSubmitResult({ error: err.message });
  });
}

function renderSubmitResult(data){
  const btn = document.getElementById("upload");
  if(btn) btn.disabled = false;
  // A submission is only a clean success when nothing was rejected.
  // A 201 that still carries rejected>0 is an INCOMPLETE submission and
  // must surface the rejected count and the first server errors, keeping
  // the retry path open.
  const transport = !!(data && data.error);
  const rejected = data && typeof data.rejected === "number" ? data.rejected : 0;
  const failed = transport || rejected > 0;
  const errs = data && Array.isArray(data.errors) ? data.errors.slice(0, 3) : [];

  const box = document.getElementById("submitbox");
  if(!box){
    // No inline box (submitted from the footer mid-session): use an alert.
    if(transport){ alert("Submission failed: " + data.error); return; }
    if(failed){
      alert("Submission incomplete: " + (data.accepted||0) + " accepted, " +
        (data.replaced||0) + " replaced, " + rejected + " rejected." +
        (errs.length ? "\\n" + errs.join("\\n") : ""));
    } else {
      alert("Submitted: " + (data.accepted||0) + " accepted, " + (data.replaced||0) + " replaced.");
    }
    return;
  }

  if(failed){
    box.className = "submitbox err";
    let html;
    if(transport){
      html = "Submission failed: " + esc(data.error) + " ";
    } else {
      html = "Submission incomplete — " + (data.accepted||0) + " accepted, " +
        (data.replaced||0) + " replaced, <b>" + rejected + " rejected</b>. ";
      if(errs.length){
        html += "<div class=\\"kv\\" style=\\"margin-top:6px\\">" +
          errs.map(e => esc(e)).join("<br>") + "</div>";
      }
    }
    box.innerHTML = html;
    const retry = document.createElement("button");
    retry.className = "btn"; retry.style.marginLeft = "10px"; retry.textContent = "Retry submission";
    retry.onclick = () => submitToServer(false);
    box.appendChild(retry);
  } else {
    box.className = "submitbox ok";
    box.textContent = "Submitted to the server: " + (data.accepted||0) + " accepted, " +
      (data.replaced||0) + " replaced.";
  }
}

/* ------------------------------------------------------------- keyboard */
document.addEventListener("keydown", e => {
  if($("item").classList.contains("hide")) return;
  if(document.activeElement === $("note")){ if(e.key === "Escape") $("note").blur(); return; }
  const it = cur(), k = e.key.toLowerCase();
  if(k === "f"){ toggleFlag(); e.preventDefault(); return; }
  if(k === "arrowright" || k === "n"){ go(1); e.preventDefault(); return; }
  if(k === "arrowleft"  || k === "p"){ go(-1); e.preventDefault(); return; }
  if(it.task === "answer"){
    for(const r of ANSWER_ROWS){
      const idx = r.keys.indexOf(k);
      if(idx >= 0){ setScore(r.id, r.opts[idx][0]); e.preventDefault(); return; }
    }
  } else {
    const scale = it.task === "certainty" ? CERTAINTY : RELEVANCE;
    const hit = scale.find(s => s.key === k);
    if(hit){ setGrade(hit.g); e.preventDefault(); }
  }
});

/* ---------------------------------------------------------------- wiring */
let batchTimer = null;
$("annot").addEventListener("input", () => {
  if(batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(refreshBatches, 250);
});
// Enter in the code field opens the single obvious next batch, if any.
$("annot").addEventListener("keydown", e => {
  if(e.key !== "Enter") return;
  e.preventDefault();
  if(batchTimer){ clearTimeout(batchTimer); batchTimer = null; }
  if(S.nextBatchId){ loadBatchById(S.nextBatchId); }
  else { refreshBatches(); }
});
$("resume").onclick = () => begin(true);
$("prev").onclick = () => go(-1);
$("next").onclick = () => { if(S.i === S.items.length-1) finish(); else go(1); };
$("flag").onclick = toggleFlag;
$("upload").onclick = () => submitToServer(false);
$("note").addEventListener("change", () => { const r = ensure(); r.notes = $("note").value.trim(); save(); });

// Deep-links: ?key=<access key> is the personal link (loads the judge's
// batches); ?batch=<id> additionally opens that batch directly.
// This document is rendered in a same-origin srcDoc iframe, so its own
// location has no query string — read the parent frame's instead.
let deepLinkSearch = window.location.search;
if(!deepLinkSearch){ try{ deepLinkSearch = window.parent.location.search; }catch(e){} }
const urlParams = new URLSearchParams(deepLinkSearch);
const urlKey = urlParams.get('key');
const batchId = urlParams.get('batch');
if (urlKey && urlKey.trim()) {
  $("annot").value = urlKey.trim();
  S.token = urlKey.trim();
  store(LAST_TOKEN_KEY, S.token);
}
if (batchId) {
  loadBatchById(batchId);
} else {
  // Returning judges: prefill the last key and load their batches at once
  // so they see their assignments without retyping. New judges get focus.
  const lastKey = urlKey || load(LAST_TOKEN_KEY);
  if (typeof lastKey === "string" && lastKey.trim()) {
    $("annot").value = lastKey.trim();
    refreshBatches();
  }
  $("annot").focus();
}
</script>
</body>
</html>
`;
    setHtml(judgeHtml);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#E4E6E0]">Loading...</div>;
  }

  // Use a completely isolated iframe to run the scholar's exact code
  return (
    <iframe 
      className="w-full h-screen border-none"
      srcDoc={html}
      title="Judge Environment"
      sandbox="allow-scripts allow-same-origin allow-downloads"
    />
  );
}
