import{c as E,r as o,g as U,a1 as q,ac as O,j as e,t as Y,ad as G,ae as V,R as H,a as K,af as Z,C as J,z as D,m as Q}from"./index-CUBOQK4u.js";import{U as X}from"./UpgradeWall-hilGX6_e.js";import{T as ee}from"./target-CMrBsyPD.js";import{T as te}from"./trophy-ALF7Hbhw.js";import{L as se}from"./layers-BQFN7sGI.js";import"./lock-OQwEUt0Q.js";/**
 * @license lucide-react v0.503.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ae=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M12 18v-6",key:"17g6i2"}],["path",{d:"m9 15 3 3 3-3",key:"1npd3o"}]],ie=E("file-down",ae);function ge(){o.useEffect(()=>{document.title="Analytics & Reports - Arthaleads CRM"},[]);const{org:a}=U(),g=q(),[l,u]=o.useState([]),[j,y]=o.useState(!0),[$,I]=o.useState(!1),[x,L]=o.useState(""),[m,R]=o.useState(""),[v,z]=o.useState(""),M=o.useRef(!1),c=o.useMemo(()=>v?l.filter(t=>t._id===v):l,[l,v]),T=()=>{const t=new Date,d=t.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}),i=t.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),s=(a==null?void 0:a.name)||"Your Organisation",w=a!=null&&a.logo&&!a.logo.startsWith("data:")?a.logo:null,C=x||m?`${x?new Date(x).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Start"} → ${m?new Date(m).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Today"}`:"All time · Live data",N=c.map((f,B)=>{const h=f.pipeline||{},r=f.project||{},W=Math.min(h.conversionRate||0,100),F=Math.min(r.conversionRate||0,100),_=(f.name||"?")[0].toUpperCase(),P=["#f97316","#6366f1","#22c55e","#3b82f6","#ec4899","#f59e0b","#14b8a6"];return`
        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-name-area">
              <div class="agent-avatar" style="background:${P[B%P.length]}">${_}</div>
              <div>
                <div class="agent-name">${f.name||"—"}</div>
                <div class="agent-email">${f.email||""}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="role-badge">${f.role||""}</span>
              <span style="font-size:10px;color:${f.isActive!==!1?"#22c55e":"#94a3b8"};font-weight:600;">
                ${f.isActive!==!1?"● Active":"○ Inactive"}
              </span>
            </div>
          </div>
          <div class="pipelines">
            <div class="pipeline-section">
              <div class="pipeline-label orange">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                Main Pipeline
              </div>
              <table class="stat-table">
                <thead><tr>
                  <th>Assigned</th><th>New</th><th>Site Visit</th><th>Closed Won</th><th>Avg Resp.</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(h.totalAssigned||0).toLocaleString("en-IN")}</td>
                  <td>${(h.newLeads||0).toLocaleString("en-IN")}</td>
                  <td>${(h.siteVisits||0).toLocaleString("en-IN")}</td>
                  <td class="won">${(h.closedWon||0).toLocaleString("en-IN")}</td>
                  <td class="blue">${h.avgResponseTime||"—"}</td>
                </tr></tbody>
              </table>
              <div class="prog-row">
                <div class="prog-lbl">Conversion Rate</div>
                <div class="prog-bar"><div class="prog-fill orange" style="width:${W}%"></div></div>
                <div class="prog-pct orange">${h.conversionRate||0}%</div>
              </div>
            </div>
            <div class="pipeline-section">
              <div class="pipeline-label indigo">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="9" width="6" height="12" rx="1"/><rect x="16" y="6" width="6" height="15" rx="1"/></svg>
                Project Pipeline
              </div>
              <table class="stat-table">
                <thead><tr>
                  <th>Assigned</th><th>Interested</th><th>Site Visit</th><th>Booked</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(r.totalAssigned||0).toLocaleString("en-IN")}</td>
                  <td class="orange">${(r.interested||0).toLocaleString("en-IN")}</td>
                  <td>${(r.siteVisits||0).toLocaleString("en-IN")}${r.siteVisitDone>0?`<span style="display:block;font-size:9px;color:#14b8a6;font-weight:700;margin-top:2px;">${r.siteVisitDone} done</span>`:""}</td>
                  <td class="won">${(r.booked||0).toLocaleString("en-IN")}</td>
                </tr></tbody>
              </table>
              <table class="stat-table secondary">
                <thead><tr>
                  <th>Call Back</th><th>Not Interested</th><th>Not Reachable</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(r.callBack||0).toLocaleString("en-IN")}</td>
                  <td>${(r.notInterested||0).toLocaleString("en-IN")}</td>
                  <td>${(r.notReachable||0).toLocaleString("en-IN")}</td>
                </tr></tbody>
              </table>
              <div class="prog-row">
                <div class="prog-lbl">Booking Rate</div>
                <div class="prog-bar"><div class="prog-fill indigo" style="width:${F}%"></div></div>
                <div class="prog-pct indigo">${r.conversionRate||0}%</div>
              </div>
            </div>
          </div>
        </div>`}).join(""),k=`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Team Performance Report – Arthaleads</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',-apple-system,system-ui,sans-serif;color:#0f172a;background:#fff;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#f97316 0%,#c2410c 100%);color:#fff;padding:28px 40px 24px;display:flex;align-items:center;justify-content:space-between;}
  .logo-area{display:flex;align-items:center;gap:14px;}
  .logo-icon{width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex-shrink:0;}
  .logo-img{width:48px;height:48px;border-radius:14px;object-fit:cover;}
  .logo-name{font-size:20px;font-weight:900;letter-spacing:-0.5px;}
  .logo-sub{font-size:11px;opacity:0.78;margin-top:2px;font-weight:500;}
  .header-right{text-align:right;}
  .report-title{font-size:15px;font-weight:800;letter-spacing:-0.2px;}
  .report-meta{font-size:10px;opacity:0.72;margin-top:5px;line-height:1.6;}
  .content{padding:28px 40px;}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;}
  .metric{border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;border:1.5px solid #f1f5f9;}
  .metric-accent{position:absolute;top:0;left:0;right:0;height:4px;border-radius:14px 14px 0 0;}
  .m-orange .metric-accent{background:linear-gradient(90deg,#f97316,#fb923c);}
  .m-blue   .metric-accent{background:linear-gradient(90deg,#3b82f6,#60a5fa);}
  .m-green  .metric-accent{background:linear-gradient(90deg,#22c55e,#4ade80);}
  .metric-val{font-size:34px;font-weight:900;letter-spacing:-1.5px;line-height:1;margin-top:4px;}
  .m-orange .metric-val{color:#f97316;} .m-blue .metric-val{color:#3b82f6;} .m-green .metric-val{color:#22c55e;}
  .metric-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-top:6px;}
  .metric-note{font-size:10px;color:#94a3b8;margin-top:3px;}
  .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;}
  .agent-card{border:1.5px solid #f1f5f9;border-radius:16px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;}
  .agent-header{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:linear-gradient(135deg,#f8fafc,#fff);border-bottom:1.5px solid #f1f5f9;}
  .agent-name-area{display:flex;align-items:center;gap:11px;}
  .agent-avatar{width:36px;height:36px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;}
  .agent-name{font-size:13px;font-weight:700;color:#0f172a;}
  .agent-email{font-size:10px;color:#94a3b8;margin-top:1px;}
  .role-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:capitalize;background:rgba(249,115,22,0.1);color:#ea580c;letter-spacing:.02em;}
  .pipelines{display:grid;grid-template-columns:1fr 1fr;}
  .pipeline-section{padding:14px 18px;}
  .pipeline-section+.pipeline-section{border-left:1.5px solid #f1f5f9;}
  .pipeline-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;display:flex;align-items:center;gap:5px;}
  .pipeline-label.orange{color:#f97316;} .pipeline-label.indigo{color:#6366f1;}
  .stat-table{width:100%;border-collapse:collapse;margin:8px 0;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;}
  .stat-table thead tr{background:#f8fafc;}
  .stat-table th{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;padding:6px 10px;text-align:center;border-right:1.5px solid #e2e8f0;}
  .stat-table th:last-child{border-right:none;}
  .stat-table tbody tr{background:#fff;}
  .stat-table td{font-size:20px;font-weight:900;color:#0f172a;padding:10px 10px 8px;text-align:center;border-right:1.5px solid #f1f5f9;border-top:1.5px solid #e2e8f0;line-height:1;}
  .stat-table td:last-child{border-right:none;}
  .stat-table td.won{color:#22c55e;} .stat-table td.blue{color:#3b82f6;} .stat-table td.orange{color:#f97316;}
  .stat-table.secondary th{font-size:8px;} .stat-table.secondary td{font-size:15px;padding:7px 10px 6px;}
  .prog-row{margin-top:10px;display:flex;align-items:center;gap:8px;}
  .prog-lbl{font-size:9px;color:#94a3b8;font-weight:600;min-width:80px;}
  .prog-bar{flex:1;height:5px;background:#f1f5f9;border-radius:999px;overflow:hidden;}
  .prog-fill{height:100%;border-radius:999px;}
  .prog-fill.orange{background:linear-gradient(90deg,#f97316,#fb923c);}
  .prog-fill.indigo{background:linear-gradient(90deg,#6366f1,#818cf8);}
  .prog-pct{font-size:10px;font-weight:800;min-width:32px;text-align:right;}
  .prog-pct.orange{color:#f97316;} .prog-pct.indigo{color:#6366f1;}
  .footer{margin-top:28px;padding-top:14px;border-top:1.5px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;}
  .footer-left{font-size:10px;color:#94a3b8;}
  .footer-brand{font-size:11px;font-weight:800;color:#f97316;}
  @page{margin:0;size:A4;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    ${w?`<img src="${w}" class="logo-img" alt="Logo" />`:'<div class="logo-icon">A</div>'}
    <div>
      <div class="logo-name">Arthaleads</div>
      <div class="logo-sub">${s}</div>
    </div>
  </div>
  <div class="header-right">
    <div class="report-title">Team Performance Report</div>
    <div class="report-meta">
      Generated ${d} at ${i}<br>
      ${c.length} team member${c.length!==1?"s":""} · ${C}
    </div>
  </div>
</div>

<div class="content">
  <div class="summary">
    <div class="metric m-orange">
      <div class="metric-accent"></div>
      <div class="metric-val">${b.totalAssigned.toLocaleString("en-IN")}</div>
      <div class="metric-label">Total Leads</div>
      <div class="metric-note">Pipeline + Projects combined</div>
    </div>
    <div class="metric m-blue">
      <div class="metric-accent"></div>
      <div class="metric-val">${b.siteVisits.toLocaleString("en-IN")}</div>
      <div class="metric-label">Site Visits</div>
      <div class="metric-note">Across all pipelines</div>
    </div>
    <div class="metric m-green">
      <div class="metric-accent"></div>
      <div class="metric-val">${b.closedWon.toLocaleString("en-IN")}</div>
      <div class="metric-label">Closed / Booked</div>
      <div class="metric-note">Won in pipeline + Booked in projects</div>
    </div>
  </div>

  <div class="section-title">
    <span>Agent Performance Breakdown</span>
    <span style="font-weight:500;color:#94a3b8;text-transform:none;letter-spacing:0">${c.length} member${c.length!==1?"s":""}</span>
  </div>

  ${N}

  <div class="footer">
    <div class="footer-left">Confidential · Internal use only · ${s} · ${d}</div>
    <div class="footer-brand">Arthaleads CRM · arthaleads.com</div>
  </div>
</div>
</body></html>`,p=window.open("","_blank");if(!p){D.error("Allow pop-ups to export the PDF");return}p.document.write(k),p.document.close(),p.onload=()=>{p.focus(),p.print()}},A=async(t=!1)=>{t?I(!0):y(!0);try{const d={...x&&{dateFrom:x},...m&&{dateTo:m}},i=await Q.get("/auth/performance",{params:d});u(i.data.performance||[])}catch{D.error("Failed to load team performance")}finally{y(!1),I(!1)}};o.useEffect(()=>{A()},[]),o.useEffect(()=>{if(!M.current){M.current=!0;return}A(!0)},[x,m]);const b=o.useMemo(()=>c.reduce((t,d)=>(t.totalAssigned+=d.totalAssigned||0,t.closedWon+=d.closedWon||0,t.siteVisits+=d.siteVisits||0,t),{totalAssigned:0,closedWon:0,siteVisits:0}),[c]);return O(a,"growth")?j?e.jsx(Y,{}):e.jsxs("div",{className:"stitch-page space-y-6",children:[e.jsx("section",{className:"card p-6",children:e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-start justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("p",{className:"stitch-kicker mb-2",children:"Performance Board"}),e.jsx("h1",{className:"text-2xl sm:text-3xl font-black tracking-tight text-app",children:"Team Performance"}),e.jsx("p",{className:"mt-2 max-w-2xl text-sm text-app-soft",children:"Track how each team member is handling leads across both the main pipeline and project pipelines - updated live."})]}),e.jsxs("div",{className:"flex flex-col items-start sm:items-end gap-2 shrink-0",children:[l.length>1&&e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:"text-xs font-medium shrink-0",style:{color:"var(--app-text-soft)"},children:"Agent"}),e.jsx(G,{value:v,onChange:z,placeholder:"All Members",options:[{value:"",label:"All Members"},...l.map(t=>({value:t._id,label:t.name}))],className:"min-w-[140px]",triggerClassName:"text-xs py-1.5"}),v&&e.jsx("button",{onClick:()=>z(""),className:"text-xs font-medium text-orange-400 hover:text-orange-500 transition",children:"Clear"})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:"text-xs font-medium shrink-0",style:{color:"var(--app-text-soft)"},children:"From"}),e.jsx(V,{value:x,onChange:L,className:"w-36"}),e.jsx("span",{className:"text-xs font-medium shrink-0",style:{color:"var(--app-text-soft)"},children:"To"}),e.jsx(V,{value:m,onChange:R,className:"w-36"}),(x||m)&&e.jsx("button",{onClick:()=>{L(""),R("")},className:"text-xs font-medium text-orange-400 hover:text-orange-500 transition",children:"Clear"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("button",{onClick:()=>A(!0),disabled:$,className:"flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50",style:{borderColor:"var(--app-border)",color:"var(--app-text-soft)"},children:[e.jsx(H,{className:`w-3.5 h-3.5 ${$?"animate-spin":""}`}),$?"Refreshing…":"Refresh"]}),e.jsxs("button",{onClick:T,disabled:!l.length,className:"flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-40",style:{borderColor:"var(--app-border)",color:"var(--app-text-soft)"},children:[e.jsx(ie,{className:"w-3.5 h-3.5"}),"Download Report"]})]})]})]})}),e.jsxs("section",{className:"grid grid-cols-1 gap-4 md:grid-cols-3",children:[e.jsx(S,{icon:K,label:"Total Leads",value:b.totalAssigned,note:"Pipeline + Project combined"}),e.jsx(S,{icon:ee,label:"Site Visits",value:b.siteVisits,note:"Visit-stage across all pipelines"}),e.jsx(S,{icon:te,label:"Closed / Booked",value:b.closedWon,note:"Won in pipeline + Booked in projects"})]}),e.jsx("section",{className:"grid grid-cols-1 gap-4 xl:grid-cols-2",children:c.map(t=>{var N,k,p;const d=((N=g.state)==null?void 0:N.focusUserId)===t._id,i=t.pipeline||{},s=t.project||{},w=i.totalAssigned>0,C=s.totalAssigned>0;return e.jsxs("article",{className:`card p-5 space-y-4 transition ${d?"ring-2 ring-orange-500/60":""}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3 min-w-0",children:[t.avatar?e.jsx("img",{src:t.avatar,alt:t.name,className:"h-12 w-12 rounded-2xl object-cover border",style:{borderColor:"var(--app-border)"}}):e.jsx("div",{className:"flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-bold text-orange-500",children:(p=(k=t.name)==null?void 0:k[0])==null?void 0:p.toUpperCase()}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h3",{className:"truncate text-sm font-semibold text-app",children:t.name}),e.jsx("p",{className:"truncate text-xs text-app-soft",children:t.email})]})]}),e.jsxs("div",{className:"text-right shrink-0",children:[e.jsx("span",{className:"badge bg-orange-500/10 text-orange-400 capitalize",children:t.role}),e.jsx("p",{className:"mt-2 text-xs text-app-soft",children:t.isActive?"Active":"Inactive"})]})]}),e.jsxs("div",{className:"rounded-[1.15rem] overflow-hidden",style:{border:"1px solid var(--app-border)"},children:[e.jsxs("div",{className:"flex items-center gap-2 px-4 py-2.5",style:{background:"var(--app-surface-low)"},children:[e.jsx(se,{className:"w-3.5 h-3.5 text-orange-500"}),e.jsx("span",{className:"text-xs font-semibold text-app",children:"Main Pipeline"}),e.jsxs("span",{className:"ml-auto text-xs text-app-soft",children:[i.totalAssigned||0," leads"]})]}),e.jsxs("div",{className:"p-3 grid grid-cols-3 xs:grid-cols-5 sm:grid-cols-5 gap-2",children:[e.jsx(n,{label:"Assigned",value:i.totalAssigned||0}),e.jsx(n,{label:"New",value:i.newLeads||0}),e.jsx(n,{label:"Site Visit",value:i.siteVisits||0}),e.jsx(n,{label:"Closed Won",value:i.closedWon||0,highlight:i.closedWon>0}),e.jsx(n,{label:"Avg Response",value:i.avgResponseTime||"-",valueClass:"text-blue-400"})]}),w&&e.jsxs("div",{className:"px-3 pb-3",children:[e.jsxs("div",{className:"flex justify-between text-[10px] text-app-soft mb-1",children:[e.jsx("span",{children:"Conversion Rate"}),e.jsxs("span",{className:"text-orange-500 font-semibold",children:[i.conversionRate,"%"]})]}),e.jsx("div",{className:"h-1.5 overflow-hidden rounded-full",style:{background:"var(--app-border)"},children:e.jsx("div",{className:"h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400",style:{width:`${Math.min(i.conversionRate,100)}%`}})})]})]}),e.jsxs("div",{className:"rounded-[1.15rem] overflow-hidden",style:{border:"1px solid var(--app-border)"},children:[e.jsxs("div",{className:"flex items-center gap-2 px-4 py-2.5",style:{background:"var(--app-surface-low)"},children:[e.jsx(Z,{className:"w-3.5 h-3.5 text-blue-500"}),e.jsx("span",{className:"text-xs font-semibold text-app",children:"Project Pipeline"}),e.jsxs("span",{className:"ml-auto text-xs text-app-soft",children:[s.totalAssigned||0," leads"]})]}),e.jsxs("div",{className:"p-3 grid grid-cols-2 sm:grid-cols-4 gap-2",children:[e.jsx(n,{label:"Assigned",value:s.totalAssigned||0}),e.jsx(n,{label:"Interested",value:s.interested||0}),e.jsx(n,{label:"Site Visit",value:s.siteVisits||0,note:s.siteVisitDone>0?`${s.siteVisitDone} done`:null}),e.jsx(n,{label:"Booked",value:s.booked||0,highlight:s.booked>0})]}),e.jsxs("div",{className:"p-3 pt-0 grid grid-cols-3 gap-2",children:[e.jsx(n,{label:"Call Back",value:s.callBack||0}),e.jsx(n,{label:"Not Interested",value:s.notInterested||0}),e.jsx(n,{label:"Not Reachable",value:s.notReachable||0})]}),C&&e.jsxs("div",{className:"px-3 pb-3",children:[e.jsxs("div",{className:"flex justify-between text-[10px] text-app-soft mb-1",children:[e.jsx("span",{children:"Booking Rate"}),e.jsxs("span",{className:"text-blue-500 font-semibold",children:[s.conversionRate,"%"]})]}),e.jsx("div",{className:"h-1.5 overflow-hidden rounded-full",style:{background:"var(--app-border)"},children:e.jsx("div",{className:"h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400",style:{width:`${Math.min(s.conversionRate,100)}%`}})})]})]})]},t._id)})}),!c.length&&e.jsxs("section",{className:"card p-6 text-sm text-app-soft flex items-center gap-3",children:[e.jsx(J,{className:"h-4 w-4"})," ",v?"No data for this agent.":"No performance data available yet."]})]}):e.jsx(X,{org:a,feature:"Analytics & Reports",description:"View team performance, conversion rates, booking metrics and individual agent tracking."})}function S({icon:a,label:g,value:l,note:u}){return e.jsx("div",{className:"card p-5",children:e.jsxs("div",{className:"flex items-start justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("p",{className:"stitch-kicker mb-2",children:g}),e.jsx("p",{className:"text-3xl font-black tracking-tight text-app",children:l.toLocaleString("en-IN")}),e.jsx("p",{className:"mt-2 text-xs text-app-soft",children:u})]}),e.jsx("div",{className:"flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500",children:e.jsx(a,{className:"h-5 w-5"})})]})})}function n({label:a,value:g,highlight:l=!1,valueClass:u="",note:j=null}){const y=typeof g=="number";return e.jsxs("div",{className:"rounded-xl p-3 stitch-surface-muted",children:[e.jsx("p",{className:"text-[10px] text-app-soft leading-none",children:a}),e.jsx("p",{className:`mt-1.5 text-base font-bold truncate ${u||(l&&g>0?"text-green-500":"text-app")}`,children:y?g.toLocaleString("en-IN"):g}),j&&e.jsx("p",{className:"text-[9px] text-teal-500 font-semibold mt-0.5 leading-none",children:j})]})}export{ge as default};
