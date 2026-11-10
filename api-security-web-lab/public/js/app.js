"use strict";
const app = document.getElementById("app");
const nav = document.getElementById("nav-list");
const modeBadge = document.getElementById("mode-badge");
const accountDisplay = document.getElementById("account-display");
const breadcrumb = document.getElementById("breadcrumb");
const toastEl = document.getElementById("toast");
let labConfig = { mode: "secure" };
let currentUser = null;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function notify(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.setTimeout(() => toastEl.classList.remove("show"), 3600);
}
function getToken() { return sessionStorage.getItem("lab_token"); }
function logout() { sessionStorage.removeItem("lab_token"); location.href = "/login"; }
async function api(path, options = {}) {
  const headers = { "Content-Type":"application/json", ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try { response = await fetch(path, { ...options, headers, cache:"no-store" }); }
  catch (error) { throw Object.assign(new Error("Không kết nối được máy chủ"), { status: 0 }); }
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw Object.assign(new Error(data.message || `HTTP ${response.status}`), { status:response.status, data });
  return data;
}
function head(kicker, title, desc, action="") {
  return `<section class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${action}</section>`;
}
function cardTitle(title, extra="") { return `<div class="card-title"><h2>${esc(title)}</h2>${extra}</div>`; }
function resultMarkup(data) { return `<pre class="api-response">${esc(JSON.stringify(data, null, 2))}</pre>`; }
function documentItem(d) {
  return `<article class="doc-item"><div><h3>${esc(d.title)}</h3><p>${esc(String(d.content || "").slice(0, 130))}</p><div class="doc-item-meta">ID #${d.id} · Owner #${d.owner_id} · ${d.is_public ? "Public" : "Private"}</div></div><a class="btn secondary small" href="/documents/${d.id}">Mở tài liệu →</a></article>`;
}
function showError(error, defaultMessage="Đã xảy ra lỗi") { notify(error?.message || defaultMessage); }
function setContent(html) { app.innerHTML = html; }
function wireLogout() { document.querySelector("#logout-btn")?.addEventListener("click", logout); }
function setupNav() {
  const path = location.pathname;
  const navItems = [
    ["/dashboard", "⌂", "Tổng quan"], ["/documents", "▤", "Tài liệu"],
    ["/profile", "◉", "Hồ sơ"], ["/admin", "▥", "Quản trị"],
    ["/lab", "◇", "Thực hành 7 lỗ hổng"]
  ];
  nav.innerHTML = navItems.map(([href,icon,text]) => `<a href="${href}" class="${path === href || (href === "/documents" && path.startsWith("/documents/")) ? "active" : ""}"><span class="nav-icon">${icon}</span>${esc(text)}</a>`).join("") +
    (getToken() ? `<button id="logout-btn" class="btn secondary" style="margin-top:20px;justify-content:start">⇥ &nbsp; Đăng xuất</button>` : `<a href="/login" class="btn secondary" style="margin-top:20px">Đăng nhập</a>`);
  wireLogout();
  document.getElementById("mobile-menu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
  modeBadge.textContent = labConfig.mode === "vulnerable" ? "● VULNERABLE MODE" : "● SECURE MODE";
  modeBadge.classList.toggle("danger", labConfig.mode === "vulnerable");
  accountDisplay.textContent = currentUser ? `${currentUser.full_name} · ${currentUser.role}` : "Khách";
}
function protect() {
  if (getToken()) return true;
  location.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
  return false;
}
async function loadUser() {
  if (!getToken()) return;
  try {
    const result = await api("/api/profile");
    currentUser = { id: result.id, username: result.username, full_name: result.full_name, role: result.role || "USER" };
  } catch (e) { if (e.status === 401) sessionStorage.removeItem("lab_token"); }
}

async function pageHome() {
  if (!protect()) return;
  breadcrumb.textContent = "Tổng quan";
  const [health, docs] = await Promise.all([api("/api/health"), api("/api/documents")]);
  const rows = docs.documents || [];
  setContent(`<section class="hero"><div><div class="eyebrow">WELCOME TO API SHIELD LAB</div><h1>Bảo vệ API bắt đầu từ việc hiểu lỗ hổng.</h1><p>Một hệ thống quản lý tài liệu dành cho thực hành 7 tình huống bảo mật API, có thể đối chiếu phiên bản có lỗi với phiên bản được khắc phục.</p><div class="btn-row"><a class="btn" href="/lab">Thử nghiệm bảo mật →</a><a class="btn secondary" href="/documents">Quản lý tài liệu</a></div></div><div class="hero-stats"><div class="hero-stat"><strong>07</strong><small>Kịch bản bảo mật</small></div><div class="hero-stat"><strong>${rows.length}</strong><small>Tài liệu của bạn</small></div></div></section>
    <section class="grid grid-3"><div class="card stat-card"><span class="stat-icon">◈</span><span class="label">Trạng thái hệ thống</span><strong>${health.status === "ok" ? "Online" : "Unknown"}</strong><span class="sub">GET /api/health</span></div><div class="card stat-card"><span class="stat-icon">▤</span><span class="label">Tài liệu sở hữu</span><strong>${rows.length}</strong><span class="sub">Quyền ở cấp đối tượng</span></div><div class="card stat-card"><span class="stat-icon">◇</span><span class="label">Chế độ hiện tại</span><strong style="font-size:23px">${labConfig.mode === "vulnerable" ? "Vulnerable" : "Secure"}</strong><span class="sub">Hai máy chủ, hai bộ dữ liệu</span></div></section>
    <div class="section-head"><div><h2>Tài liệu gần đây</h2><p>Chỉ liệt kê các tài liệu thuộc tài khoản của bạn</p></div><a href="/documents" class="btn secondary small">Xem tất cả</a></div><section class="doc-list">${rows.length ? rows.slice(0, 4).map(documentItem).join("") : `<div class="card empty">Chưa có tài liệu nào.</div>`}</section>
    <section class="top-gap notice ${labConfig.mode === "vulnerable" ? "danger" : "good"}"><strong>${labConfig.mode === "vulnerable" ? "Cảnh báo phòng lab:" : "Chế độ đã khắc phục:"}</strong> ${labConfig.mode === "vulnerable" ? "Một số endpoint cố ý thiếu kiểm tra an toàn. Không sử dụng dữ liệu thật và không đưa ra Internet." : "Các cơ chế xác thực, phân quyền, kiểm tra dữ liệu và giới hạn request được áp dụng trong bản demo này."}</section>`);
}

function pageLogin() {
  breadcrumb.textContent = "Đăng nhập";
  setContent(`<div class="auth-grid"><div class="auth-aside"><div class="eyebrow">LEARN • TEST • FIX</div><h1>Một website.<br>Bảy lỗ hổng.<br>Hai cách triển khai.</h1><p>Đăng nhập bằng tài khoản mẫu để khám phá dữ liệu riêng tư, phân quyền, báo cáo quản trị và các tình huống API Security đã xây dựng.</p><div class="notice ${labConfig.mode === "vulnerable" ? "danger" : "good"}">${labConfig.mode === "vulnerable" ? "Đây là phiên bản cố ý có lỗ hổng. Không dùng thông tin thật." : "Đây là phiên bản đã khắc phục các tình huống trong phòng lab."}</div></div><form id="login-form" class="card auth-card"><div class="eyebrow">WELCOME BACK</div><h2>Đăng nhập tài khoản</h2><p>Nhập thông tin để truy cập hệ thống.</p><div class="form-field"><label for="username">Tên đăng nhập</label><input id="username" name="username" required autocomplete="username" value="alice"></div><div class="form-field"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Nhập mật khẩu" value="Alice@123"></div><button class="btn" type="submit" style="width:100%">Đăng nhập →</button><div class="account-pills"><button class="account-pill" type="button" data-login="alice" data-pass="Alice@123">Alice</button><button class="account-pill" type="button" data-login="bob" data-pass="Bob@123">Bob</button><button class="account-pill" type="button" data-login="admin" data-pass="Admin@123">Admin</button></div><div class="hr"></div><div class="form-help">Chưa có tài khoản? <a class="table-link" href="/register">Đăng ký tại đây</a>. Đây là tài khoản giả lập, chỉ phục vụ bài học.</div></form></div>`);
  document.querySelectorAll("[data-login]").forEach(el => el.addEventListener("click", () => { document.querySelector("#username").value=el.dataset.login; document.querySelector("#password").value=el.dataset.pass; }));
  document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/login", { method:"POST", body:JSON.stringify({ username: form.get("username"), password:form.get("password") }) });
      sessionStorage.setItem("lab_token", data.token);
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch(e) { showError(e); }
  });
}
function pageRegister() {
  breadcrumb.textContent="Đăng ký";
  setContent(`<div class="auth-grid"><div class="auth-aside"><div class="eyebrow">CREATE ACCOUNT</div><h1>Thêm người dùng để thử kiểm soát quyền.</h1><p>Mỗi tài khoản mới đều mang vai trò USER. Chức năng đăng ký không cho phép tự cấp vai trò ADMIN.</p></div><form id="register-form" class="card auth-card"><h2>Tạo tài khoản</h2><p>Chỉ sử dụng thông tin giả lập trong môi trường này.</p><div class="form-field"><label>Họ tên hiển thị</label><input name="full_name" required maxlength="120" placeholder="Nguyễn Văn A"></div><div class="form-field"><label>Username</label><input name="username" required pattern="[A-Za-z0-9_]{3,40}" placeholder="username_demo"></div><div class="form-field"><label>Email</label><input name="email" required type="email" placeholder="demo@example.test"></div><div class="form-field"><label>Mật khẩu</label><input name="password" required type="password" minlength="8" placeholder="Ít nhất 8 ký tự"></div><button type="submit" class="btn" style="width:100%">Tạo tài khoản</button><p class="form-help" style="margin:15px 0 0">Đã có tài khoản? <a href="/login" class="table-link">Đăng nhập</a></p></form></div>`);
  document.querySelector("#register-form").addEventListener("submit", async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    try { await api("/api/register", {method:"POST",body:JSON.stringify(Object.fromEntries(form.entries()))}); notify("Đăng ký thành công. Hãy đăng nhập."); location.href="/login"; }
    catch(err){showError(err);}
  });
}

async function pageDocuments() {
  if (!protect()) return;
  breadcrumb.textContent="Kho tài liệu";
  setContent(`${head("DOCUMENT CENTER","Quản lý tài liệu","Tạo, xem, sửa, xóa và tìm kiếm tài liệu cá nhân. Bài thực hành BOLA, Mass Assignment và SQL Injection đều sử dụng khu vực này.")}
  <div class="search-layout"><section class="stack"><div class="card"><div class="card-title"><h2>Tìm kiếm tài liệu</h2><span class="tag blue">GET /api/documents/search</span></div><form id="search-form" class="search-bar"><input id="search-text" placeholder="Nhập tên tài liệu cần tìm..." autocomplete="off"><button class="btn" type="submit">Tìm kiếm</button><button class="btn secondary" id="clear-search" type="button">Đặt lại</button></form><div class="form-help" style="margin-top:12px">Trong phòng lab, bạn có thể thử chuỗi SQL Injection có kiểm soát tại trang Thực hành.</div></div><section id="doc-results" class="doc-list"><div class="card empty">Đang tải tài liệu...</div></section></section><section class="card"><div class="card-title"><h2>Thêm tài liệu</h2><span class="tag teal">POST</span></div><form id="create-doc"><div class="form-field"><label>Tiêu đề</label><input name="title" required maxlength="120" placeholder="Tên tài liệu"></div><div class="form-field"><label>Nội dung</label><textarea name="content" maxlength="4000" placeholder="Nhập nội dung..." required></textarea></div><button class="btn" type="submit">+ Tạo tài liệu</button></form><div class="hr"></div><div class="notice">Mỗi tài liệu gắn với <code>owner_id</code>. Khi xem tài liệu, server phải đối chiếu người gọi với chủ sở hữu.</div></section></div>`);
  const results = document.querySelector("#doc-results");
  async function loadDocs(q=null) {
    try { const data=await api(q === null ? "/api/documents" : `/api/documents/search?q=${encodeURIComponent(q)}`);
      results.innerHTML = data.documents?.length ? data.documents.map(documentItem).join("") : `<div class="card empty">Không tìm thấy tài liệu nào.</div>`;
    } catch(err) { results.innerHTML=`<div class="notice danger">${esc(err.message)}</div>`; }
  }
  document.querySelector("#search-form").addEventListener("submit",e=>{e.preventDefault();loadDocs(document.querySelector("#search-text").value);});
  document.querySelector("#clear-search").addEventListener("click",()=>{document.querySelector("#search-text").value="";loadDocs();});
  document.querySelector("#create-doc").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await api("/api/documents",{method:"POST",body:JSON.stringify(Object.fromEntries(f.entries()))});notify(`Đã tạo tài liệu #${d.id}`);location.href=`/documents/${d.id}`;}catch(err){showError(err);}});
  await loadDocs();
}
async function pageDocument(id) {
  if(!protect())return;
  breadcrumb.textContent=`Tài liệu #${id}`;
  try {
    const d=await api(`/api/documents/${id}`);
    setContent(`${head("DOCUMENT DETAIL",d.title,`Document #${d.id} • Owner #${d.owner_id} • ${d.is_public ? "Public" : "Private"}`,`<a class="btn secondary" href="/documents">← Trở lại</a>`)}<div class="grid grid-2"><section class="card"><div class="card-title"><h2>Nội dung tài liệu</h2><span class="tag teal">GET /api/documents/${d.id}</span></div><div class="document-text">${esc(d.content)}</div><div class="inline-meta"><span class="mini-pill">Owner ID: ${d.owner_id}</span><span class="mini-pill">Visibility: ${d.is_public ? "Public" : "Private"}</span></div><div class="notice top-gap">BOLA: ở chế độ có lỗ hổng, người dùng có thể truy cập URL tài liệu của tài khoản khác, ví dụ <code>/documents/102</code>.</div></section><section class="card"><div class="card-title"><h2>Chỉnh sửa tài liệu</h2><span class="tag blue">PATCH</span></div><form id="edit-form"><div class="form-field"><label>Tiêu đề</label><input name="title" required maxlength="120" value="${esc(d.title)}"></div><div class="form-field"><label>Nội dung</label><textarea name="content" maxlength="4000" required>${esc(d.content)}</textarea></div><div class="btn-row"><button type="submit" class="btn">Lưu thay đổi</button><button type="button" class="btn danger" id="delete-doc">Xóa tài liệu</button></div></form><div class="hr"></div><div class="notice warn">Mass Assignment: giao diện chỉ cho sửa title/content. Nhưng nếu API phía server không kiểm soát thuộc tính, người dùng vẫn có thể gửi thêm owner_id bằng Postman/Burp.</div></section></div>`);
    document.querySelector("#edit-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api(`/api/documents/${id}`,{method:"PATCH",body:JSON.stringify(Object.fromEntries(f.entries()))});notify("Đã cập nhật tài liệu");location.reload();}catch(err){showError(err);}});
    document.querySelector("#delete-doc").addEventListener("click",async()=>{if(!confirm("Bạn có chắc muốn xóa tài liệu mẫu này?"))return;try{await api(`/api/documents/${id}`,{method:"DELETE"});location.href="/documents";}catch(err){showError(err);}});
  } catch(err){setContent(`${head("DOCUMENT DETAIL",`Tài liệu #${id}`,"Không thể tải tài liệu được yêu cầu.")}<div class="notice danger"><strong>HTTP ${esc(err.status || "?")}</strong> – ${esc(err.message)}</div><div class="btn-row"><a class="btn secondary" href="/documents">Quay lại danh sách</a></div>`);}
}

async function pageProfile() {
  if(!protect())return;
  breadcrumb.textContent="Hồ sơ";
  const d=await api("/api/profile");
  setContent(`${head("ACCOUNT INFORMATION","Hồ sơ cá nhân","Theo dõi các thông tin mà endpoint GET /api/profile cung cấp cho client.")}
    <div class="grid grid-2"><section class="card">${cardTitle("Thông tin cơ bản",`<span class="tag blue">GET /api/profile</span>`)}${[["ID",d.id],["Username",d.username],["Họ tên",d.full_name],["Email",d.email || "—"],["Vai trò",d.role || "USER"]].map(([k,v])=>`<div class="key-value"><span class="key">${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</section><section class="card">${cardTitle("Dữ liệu thực tế do API trả về", `<span class="tag ${labConfig.mode === "vulnerable" ? "red" : "teal"}">${labConfig.mode === "vulnerable" ? "Data Exposure" : "Allowlist"}</span>`)}${resultMarkup(d)}<div class="notice ${labConfig.mode === "vulnerable" ? "danger" : "good"}" style="margin-top:15px">${labConfig.mode === "vulnerable" ? "CẢNH BÁO: Response đang chứa password_hash và dữ liệu cá nhân đã được giải mã. Đây là lỗ hổng cố ý trong bản lab." : "Chỉ những trường cần thiết mới được đưa vào response. Không có password_hash, phone hay national_id."}</div></section></div>`);
}

async function pageAdmin() {
  if(!protect())return;
  breadcrumb.textContent="Quản trị";
  try {
    const d=await api("/api/admin/stats");
    setContent(`${head("ADMIN CONSOLE","Thống kê hệ thống","Trang quản trị: server phải xác minh role ADMIN chứ không chỉ kiểm tra JWT.")}
      <section class="grid grid-3"><div class="card stat-card"><span class="stat-icon">♙</span><span class="label">Tổng người dùng</span><strong>${d.total_users}</strong></div><div class="card stat-card"><span class="stat-icon">▤</span><span class="label">Tổng tài liệu</span><strong>${d.total_documents}</strong></div><div class="card stat-card"><span class="stat-icon">◉</span><span class="label">Tài khoản đang truy cập</span><strong style="font-size:22px">${esc(currentUser?.username || "—")}</strong></div></section>
      <div class="top-gap card">${cardTitle("Số tài liệu theo người dùng")}<div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Số tài liệu</th></tr></thead><tbody>${d.documents_by_user.map(x=>`<tr><td>${esc(x.username)}</td><td>${x.document_count}</td></tr>`).join("")}</tbody></table></div></div><div class="top-gap notice ${currentUser?.role !== "ADMIN" ? "danger" : "good"}">${currentUser?.role !== "ADMIN" ? "BFLA: tài khoản USER đã xem được dữ liệu quản trị. Đây là hành vi cố ý của phiên bản có lỗi." : "Tài khoản Admin có quyền truy cập trang này."}</div>`);
  } catch(err) {setContent(`${head("ADMIN CONSOLE","Quản trị hệ thống","Trang này yêu cầu quyền ADMIN.")}<div class="notice good"><strong>HTTP ${esc(err.status)}</strong> – ${esc(err.message)}. Đây là kết quả đúng nếu bạn đăng nhập với tài khoản USER trong chế độ Secure.</div><div class="btn-row"><a href="/lab" class="btn">Mở kịch bản BFLA</a></div>`);}
}

const scenarios = [
  {id:"auth",name:"Broken Authentication",tag:"API2:2023",method:"POST /api/login",summary:"Dùng mật khẩu sai của Alice để kiểm tra API có cấp JWT hay không.",expected:"Vulnerable: 200 + JWT · Secure: 401"},
  {id:"bola",name:"Broken Object Level Authorization",tag:"API1:2023",method:"GET /api/documents/102",summary:"Giữ token Alice nhưng yêu cầu tài liệu 102 thuộc sở hữu của Bob.",expected:"Vulnerable: 200 · Secure: 403"},
  {id:"exposure",name:"Excessive Data Exposure",tag:"API3:2023",method:"GET /api/profile",summary:"Kiểm tra response có lộ password_hash và dữ liệu nhạy cảm hay không.",expected:"Vulnerable: lộ trường · Secure: không lộ"},
  {id:"bfla",name:"Broken Function Level Authorization",tag:"API5:2023",method:"GET /api/admin/stats",summary:"Tài khoản USER thử gọi API chỉ dành cho quản trị viên.",expected:"Vulnerable: 200 · Secure: 403"},
  {id:"mass",name:"Mass Assignment",tag:"API3:2023",method:"PATCH /api/documents/101",summary:"Gửi trường is_public mà giao diện không cho phép người dùng chỉnh sửa.",expected:"Vulnerable: 200 + is_public=true · Secure: 400"},
  {id:"resource",name:"Unrestricted Resource Consumption",tag:"API4:2023",method:"POST /api/reports/preview",summary:"Đề nghị trả 120 bản ghi mô phỏng trong một request (không gây tải lớn).",expected:"Vulnerable: 200 · Secure: 413"},
  {id:"sqli",name:"SQL Injection",tag:"OWASP Injection",method:"GET /api/documents/search",summary:"Kiểm thử truy vấn tìm kiếm có ghép chuỗi SQL không an toàn hay không.",expected:"Vulnerable: có thể thấy tài liệu người khác · Secure: không"}
];
async function runScenario(s) {
  switch(s) {
    case "auth": {
      // Never overwrite the login session when testing broken authentication.
      const response=await fetch("/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"alice",password:"totally-wrong-password"})});
      const d=await response.json();return { status:response.status, result:{message:d.message,token_issued:typeof d.token==="string"} };
    }
    case "bola": {const d=await api("/api/documents/102");return {status:200,result:d};}
    case "exposure": {const d=await api("/api/profile");return {status:200,result:{returned_fields:Object.keys(d), sensitive_data_present:["password_hash","phone","national_id"].some(k => k in d)}};}
    case "bfla": {const d=await api("/api/admin/stats");return {status:200,result:d};}
    case "mass": {if(!confirm("Phép thử sẽ đặt is_public=true cho tài liệu 101 ở bản Vulnerable. Dữ liệu demo có thể reset. Tiếp tục?"))return null;const d=await api("/api/documents/101",{method:"PATCH",body:JSON.stringify({is_public:true})});return {status:200,result:{id:d.id,is_public:d.is_public,owner_id:d.owner_id}};}
    case "resource": {const d=await api("/api/reports/preview",{method:"POST",body:JSON.stringify({count:120})});return {status:200,result:{count:d.count,items_returned:d.items.length}};}
    case "sqli": {const d=await api(`/api/documents/search?q=${encodeURIComponent("' OR 1=1 --")}`);return {status:200,result:{count:d.documents.length,document_ids:d.documents.map(x=>x.id),owner_ids:d.documents.map(x=>x.owner_id)}};}
    default:return null;
  }
}
function pageLab() {
  if(!protect())return;
  breadcrumb.textContent="Thực hành bảo mật";
  setContent(`${head("PRACTICAL SECURITY TESTING","Bảy kịch bản bảo mật API","Chạy từng tình huống trên tài khoản Alice, so sánh trạng thái HTTP và dữ liệu trả về giữa hai chế độ. Không cần gửi lưu lượng lớn.")}
    <div class="notice ${labConfig.mode === "vulnerable" ? "danger" : "good"}" style="margin-bottom:22px"><strong>${labConfig.mode === "vulnerable" ? "Chế độ có lỗ hổng" : "Chế độ đã khắc phục"}:</strong> ${labConfig.mode === "vulnerable" ? "Những vấn đề bên dưới được tạo có chủ đích để nghiên cứu trên localhost." : "Server kiểm tra điều kiện an toàn để chặn các kịch bản khai thác."} Bạn nên đăng nhập <strong>Alice</strong> để các kết quả so sánh khớp hướng dẫn.</div>
    <div class="scenario-grid">${scenarios.map((s,i)=>`<section class="card scenario"><div class="scenario-meta"><span class="tag blue">KỊCH BẢN ${String(i+1).padStart(2,"0")}</span><span class="tag">${esc(s.tag)}</span></div><h3>${esc(s.name)}</h3><div><code>${esc(s.method)}</code></div><p>${esc(s.summary)}</p><div class="form-help"><strong>Mong đợi:</strong> ${esc(s.expected)}</div><button class="btn small" type="button" data-run="${s.id}">Chạy kiểm thử →</button><div class="scenario-result" id="result-${s.id}"></div></section>`).join("")}</div><div class="top-gap notice warn"><strong>Phạm vi an toàn:</strong> Toàn bộ dữ liệu là giả lập. Kịch bản API4 có trần kỹ thuật 1.200 phần tử và chỉ kiểm thử 120 phần tử để tránh gây quá tải thật. SQLi chỉ tác động lên dữ liệu SQLite mẫu.</div>`);
  document.querySelectorAll("[data-run]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=btn.dataset.run;const slot=document.getElementById(`result-${id}`);
    btn.disabled=true;btn.textContent="Đang kiểm tra...";
    try {const r=await runScenario(id);if(r)slot.innerHTML=`<div class="result-label neutral">HTTP ${r.status}</div>${resultMarkup(r.result)}`;}
    catch(err){slot.innerHTML=`<div class="result-label ${err.status>=400?"bad":"neutral"}">HTTP ${esc(err.status || "NETWORK")}</div>${resultMarkup({message:err.message})}`;}
    finally{btn.disabled=false;btn.textContent="Chạy kiểm thử →";}
  }));
}

async function bootstrap() {
  try {labConfig=await api("/api/config");}catch(err){setContent(`<div class="notice danger">Không thể kết nối API Server: ${esc(err.message)}</div>`);return;}
  await loadUser(); setupNav();
  const path=location.pathname.replace(/\/$/,"")||"/";
  try {
    if(path === "/" || path === "/dashboard") return await pageHome();
    if(path === "/login") return pageLogin();
    if(path === "/register") return pageRegister();
    if(path === "/documents") return await pageDocuments();
    if(/^\/documents\/\d+$/.test(path)) return await pageDocument(path.split("/")[2]);
    if(path === "/profile") return await pageProfile();
    if(path === "/admin") return await pageAdmin();
    if(path === "/lab") return pageLab();
    setContent(head("404","Trang không tồn tại","Hãy chọn một trang khác từ menu."));
  } catch(err) {setContent(`<div class="notice danger"><strong>Không tải được trang:</strong> ${esc(err.message)}</div>`);}
}
bootstrap();
