"use strict";
// Integration smoke test. Start both servers first. No third-party packages required.
const fs = require("node:fs");
const path = require("node:path");
const secure = process.env.SECURE_URL || "http://127.0.0.1:3100";
const vulnerable = process.env.VULNERABLE_URL || "http://127.0.0.1:3101";
const results = [];

async function request(base, route, method="GET", body=null, token="") {
  let res;
  try {
    res = await fetch(`${base}${route}`, { method, headers:{"Content-Type":"application/json",...(token?{"Authorization":`Bearer ${token}`}:{})}, body:body===null?undefined:JSON.stringify(body) });
  } catch(err) { throw new Error(`Cannot reach ${base}: ${err.message}`); }
  const data = await res.json().catch(()=>({}));
  return {status:res.status,data};
}
function assertion(name, ok, message) {
  results.push({name,passed:!!ok,message});
  console.log(`${ok?"PASS":"FAIL"}  ${name}: ${message}`);
}
async function run(base,mode) {
  const health=await request(base,"/api/health");
  assertion(`${mode} health`,health.status===200,`HTTP ${health.status}`);
  const wrong=await request(base,"/api/login","POST",{username:"alice",password:"wrong-password"});
  assertion(`${mode} broken authentication`,mode==="vulnerable"? wrong.status===200 && !!wrong.data.token:wrong.status===401,`HTTP ${wrong.status}, token issued: ${!!wrong.data.token}`);
  const login=await request(base,"/api/login","POST",{username:"alice",password:"Alice@123"});
  if(login.status!==200 || !login.data.token) throw new Error(`Cannot authenticate Alice on ${base}: ${login.status}`);
  const token=login.data.token;
  const own=await request(base,"/api/documents/101","GET",null,token);
  assertion(`${mode} own document`,own.status===200,`HTTP ${own.status}`);
  const bola=await request(base,"/api/documents/102","GET",null,token);
  assertion(`${mode} BOLA`,mode==="vulnerable"?bola.status===200:bola.status===403,`HTTP ${bola.status}`);
  const exposure=await request(base,"/api/profile","GET",null,token);
  const hasSensitive=["password_hash","national_id","phone"].some(k=>Object.hasOwn(exposure.data,k));
  assertion(`${mode} excessive data exposure`,mode==="vulnerable"?hasSensitive:!hasSensitive,`Sensitive fields present: ${hasSensitive}`);
  const bfla=await request(base,"/api/admin/stats","GET",null,token);
  assertion(`${mode} BFLA`,mode==="vulnerable"?bfla.status===200:bfla.status===403,`HTTP ${bfla.status}`);
  const mass=await request(base,"/api/documents/101","PATCH",{is_public:true},token);
  assertion(`${mode} mass assignment`,mode==="vulnerable"?mass.status===200&&mass.data.is_public===true:mass.status===400,`HTTP ${mass.status}`);
  const resource=await request(base,"/api/reports/preview","POST",{count:120},token);
  assertion(`${mode} resource consumption`,mode==="vulnerable"?resource.status===200&&resource.data.count===120:resource.status===413,`HTTP ${resource.status}`);
  const sqli=await request(base,`/api/documents/search?q=${encodeURIComponent("' OR 1=1 --")}`,"GET",null,token);
  const bobVisible=Array.isArray(sqli.data.documents)&&sqli.data.documents.some(d=>d.id===102);
  assertion(`${mode} SQL injection`,mode==="vulnerable"?sqli.status===200&&bobVisible:sqli.status===200&&!bobVisible,`HTTP ${sqli.status}, Bob's document visible: ${bobVisible}`);
}
(async()=>{
  await run(vulnerable,"vulnerable");
  await run(secure,"secure");
  const report={generated_at:new Date().toISOString(),summary:{passed:results.filter(x=>x.passed).length,total:results.length},results};
  const target=path.join(__dirname,"../reports/7-scenarios-results.json");
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2));
  console.log(`\nSaved report: ${target}`);
  if(report.summary.passed!==report.summary.total) process.exitCode=1;
})().catch(err=>{console.error("ERROR:",err.message);process.exitCode=1;});
