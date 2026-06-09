import{c as f,u as b,r as x,j as e,L as g,A as y,d as j}from"./index-CUBOQK4u.js";import{P as N,C as w,a as P}from"./PublicFooter-qx5F8Rve.js";import{u as k}from"./useSEO-DgyGzTTe.js";import{K as O}from"./key-round-D6B-OOK8.js";import{M as v}from"./mail-D7L-sfAJ.js";import{C as T}from"./copy-vTZlfGP_.js";import"./chart-no-axes-column-L37aM-_g.js";/**
 * @license lucide-react v0.503.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["polyline",{points:"4 17 10 11 4 5",key:"akl6gq"}],["line",{x1:"12",x2:"20",y1:"19",y2:"19",key:"q2wloq"}]],R=f("terminal",A),u={GET:"#22c55e",POST:"#ff6b00",PUT:"#3b82f6",DELETE:"#ef4444"};function E({samples:a,isDark:l}){const i=Object.keys(a),[r,c]=x.useState(i[0]),[t,o]=x.useState(!1),d=l?"#0a0a14":"#1e1e2e",n=l?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.1)",m=()=>{var s;(s=navigator.clipboard)==null||s.writeText(a[r]),o(!0),setTimeout(()=>o(!1),1800)};return e.jsxs("div",{className:"rounded-xl overflow-hidden",style:{background:d,border:`1px solid ${n}`},children:[e.jsxs("div",{className:"flex items-center justify-between px-3 py-2",style:{borderBottom:`1px solid ${n}`},children:[e.jsx("div",{className:"flex items-center gap-1",children:i.map(s=>e.jsx("button",{onClick:()=>c(s),className:"px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors",style:{background:r===s?"rgba(255,107,0,0.15)":"transparent",color:r===s?"#ff6b00":"rgba(255,255,255,0.5)"},children:s},s))}),e.jsxs("button",{onClick:m,className:"flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer",style:{color:t?"#22c55e":"rgba(255,255,255,0.6)"},children:[t?e.jsx(j,{className:"w-3.5 h-3.5"}):e.jsx(T,{className:"w-3.5 h-3.5"}),t?"Copied":"Copy"]})]}),e.jsx("pre",{className:"px-4 py-4 overflow-x-auto text-xs leading-relaxed",style:{color:"#e2e8f0",fontFamily:"ui-monospace, monospace"},children:e.jsx("code",{children:a[r]})})]})}const p=[{id:"create-lead",method:"POST",path:"/api/leads",title:"Create a lead",desc:"Push a new lead into your CRM pipeline. Use this from your website, landing pages, or any external system.",samples:{cURL:`curl -X POST https://api.arthaleads.com/api/leads \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "source": "Website",
    "message": "Interested in 2BHK in Pune"
  }'`,JavaScript:`await fetch("https://api.arthaleads.com/api/leads", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com",
    source: "Website",
    message: "Interested in 2BHK in Pune",
  }),
});`,Python:`import requests

requests.post(
    "https://api.arthaleads.com/api/leads",
    headers={"Authorization": "Bearer YOUR_API_TOKEN"},
    json={
        "name": "Rahul Sharma",
        "phone": "9876543210",
        "email": "rahul@example.com",
        "source": "Website",
        "message": "Interested in 2BHK in Pune",
    },
)`}},{id:"list-leads",method:"GET",path:"/api/leads",title:"List leads",desc:"Retrieve leads from your pipeline with pagination and filtering. Returns leads scoped to your organisation only.",samples:{cURL:`curl https://api.arthaleads.com/api/leads?page=1&limit=50 \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`,JavaScript:`const res = await fetch(
  "https://api.arthaleads.com/api/leads?page=1&limit=50",
  { headers: { "Authorization": "Bearer YOUR_API_TOKEN" } }
);
const { data } = await res.json();`,Python:`import requests

res = requests.get(
    "https://api.arthaleads.com/api/leads",
    headers={"Authorization": "Bearer YOUR_API_TOKEN"},
    params={"page": 1, "limit": 50},
)
data = res.json()["data"]`}},{id:"webhook",method:"POST",path:"/webhook/website",title:"Website form webhook",desc:"Connect any website form (WordPress, custom HTML, landing pages) to capture submissions automatically. Include your verify token to authenticate.",samples:{cURL:`curl -X POST https://api.arthaleads.com/webhook/website \\
  -H "Content-Type: application/json" \\
  -d '{
    "verifyToken": "YOUR_WEBHOOK_TOKEN",
    "name": "Priya Patel",
    "phone": "9123456780",
    "email": "priya@example.com",
    "source": "Landing Page"
  }'`,JavaScript:`await fetch("https://api.arthaleads.com/webhook/website", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    verifyToken: "YOUR_WEBHOOK_TOKEN",
    name: "Priya Patel",
    phone: "9123456780",
    email: "priya@example.com",
    source: "Landing Page",
  }),
});`,Python:`import requests

requests.post(
    "https://api.arthaleads.com/webhook/website",
    json={
        "verifyToken": "YOUR_WEBHOOK_TOKEN",
        "name": "Priya Patel",
        "phone": "9123456780",
        "email": "priya@example.com",
        "source": "Landing Page",
    },
)`}}];function U(){const{isDark:a}=b(),[l,i]=x.useState(p[0].id);k({title:"API Documentation | Arthaleads Real Estate CRM",description:"Arthaleads REST API documentation. Create and list leads, connect website form webhooks, and integrate your real estate stack with the Arthaleads CRM.",canonical:"https://www.arthaleads.com/api-docs"});const r=a?"#0d0d1a":"#ffffff",c=a?"#080810":"#f9fafb",t=a?"#ffffff":"#111827",o=a?"rgba(255,255,255,0.55)":"#6b7280",d=a?"rgba(255,255,255,0.02)":"#ffffff",n=a?"rgba(255,255,255,0.08)":"#e5e7eb",m=s=>{var h;i(s),(h=document.getElementById(s))==null||h.scrollIntoView({behavior:"smooth",block:"start"})};return e.jsxs("div",{className:"min-h-screen",style:{background:r,color:t,fontFamily:"Inter, sans-serif"},children:[e.jsx(N,{}),e.jsx("section",{className:"relative pt-32 pb-12 overflow-hidden",children:e.jsxs("div",{className:"relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center",children:[e.jsxs("div",{className:"inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6",style:{borderColor:"rgba(255,107,0,0.30)",background:"rgba(255,107,0,0.10)"},children:[e.jsx(w,{className:"w-3.5 h-3.5 text-[#ff6b00]"}),e.jsx("span",{className:"text-[#ff6b00] text-xs font-semibold uppercase tracking-wide",children:"Developers"})]}),e.jsxs("h1",{className:"text-4xl sm:text-5xl font-black mb-5",style:{color:t},children:["Arthaleads"," ",e.jsx("span",{className:"text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]",children:"API"})]}),e.jsx("p",{className:"text-lg max-w-xl mx-auto",style:{color:o},children:"A simple REST API to push leads into your CRM, list your pipeline, and connect any form on the web. Available on the Enterprise plan."})]})}),e.jsx("section",{className:"pb-8",children:e.jsx("div",{className:"max-w-5xl mx-auto px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"p-5 rounded-2xl flex items-start gap-4",style:{background:d,border:`1px solid ${n}`},children:[e.jsx("div",{className:"w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",style:{background:"rgba(255,107,0,0.1)"},children:e.jsx(O,{className:"w-5 h-5 text-[#ff6b00]"})}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-sm mb-1",style:{color:t},children:"Authentication"}),e.jsxs("p",{className:"text-sm leading-relaxed",style:{color:o},children:["All API requests are authenticated with a Bearer token. Find your API token in"," ",e.jsx("strong",{style:{color:t},children:"Settings → Integrations"})," inside your CRM. Pass it in the"," ",e.jsx("code",{className:"px-1.5 py-0.5 rounded text-xs",style:{background:a?"rgba(255,255,255,0.08)":"#f3f4f6",color:"#ff6b00"},children:"Authorization"})," header. Base URL: ",e.jsx("code",{className:"px-1.5 py-0.5 rounded text-xs",style:{background:a?"rgba(255,255,255,0.08)":"#f3f4f6",color:"#ff6b00"},children:"https://api.arthaleads.com"})]})]})]})})}),e.jsx("section",{className:"pb-16",children:e.jsxs("div",{className:"max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8",children:[e.jsx("aside",{className:"hidden lg:block",children:e.jsxs("div",{className:"sticky top-28",children:[e.jsx("p",{className:"text-[10px] font-bold uppercase tracking-widest mb-3",style:{color:o},children:"Endpoints"}),e.jsx("nav",{className:"space-y-1",children:p.map(s=>e.jsxs("button",{onClick:()=>m(s.id),className:"w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium cursor-pointer transition-colors",style:{background:l===s.id?"rgba(255,107,0,0.1)":"transparent",color:l===s.id?"#ff6b00":o},children:[e.jsx("span",{className:"font-bold",style:{color:u[s.method],fontSize:9},children:s.method}),s.title]},s.id))})]})}),e.jsx("div",{className:"space-y-10 min-w-0",children:p.map(s=>e.jsxs("div",{id:s.id,className:"scroll-mt-28",children:[e.jsxs("div",{className:"flex items-center gap-3 mb-3 flex-wrap",children:[e.jsx("span",{className:"px-2.5 py-1 rounded-md text-xs font-bold text-white",style:{background:u[s.method]},children:s.method}),e.jsx("code",{className:"text-sm font-mono",style:{color:t},children:s.path})]}),e.jsx("h2",{className:"text-xl font-bold mb-2",style:{color:t},children:s.title}),e.jsx("p",{className:"text-sm mb-4 leading-relaxed",style:{color:o},children:s.desc}),e.jsx(E,{samples:s.samples,isDark:a})]},s.id))})]})}),e.jsx("section",{className:"py-16",style:{background:c},children:e.jsxs("div",{className:"max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center",children:[e.jsx(R,{className:"w-8 h-8 text-[#ff6b00] mx-auto mb-4"}),e.jsx("h2",{className:"text-2xl font-bold mb-3",style:{color:t},children:"Need a custom integration?"}),e.jsx("p",{className:"text-base mb-6",style:{color:o},children:"Our team can help you connect Arthaleads to your existing tools and portals. Reach out and we'll get you set up."}),e.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[e.jsxs("a",{href:"mailto:contact@arthaleads.com?subject=API%20Integration",className:"inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl",style:{background:"rgba(255,107,0,0.10)",color:"#ff6b00",border:"1px solid rgba(255,107,0,0.40)"},children:[e.jsx(v,{className:"w-4 h-4"})," contact@arthaleads.com"]}),e.jsxs(g,{to:"/wordpress-plugin",className:"inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white bg-[#ff6b00] hover:bg-[#e05f00] transition-colors",children:["WordPress Plugin ",e.jsx(y,{className:"w-4 h-4"})]})]})]})}),e.jsx(P,{})]})}export{U as default};
