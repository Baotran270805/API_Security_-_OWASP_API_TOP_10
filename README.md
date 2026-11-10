# API SHIELD LAB — Website hoan chinh co ban cho 7 kich ban API Security

**Day la DU AN MAU DOC LAP, khong ghi de du an `D:\an_toan_mang\backend` ban dau.**

Giao dien website co 8 duong dan, backend Node.js/Express, SQLite, bcrypt, JWT, AES-256-GCM. Hai che do tach biet `secure` va `vulnerable` de doi chieu 7 kich ban. Dung du lieu gia, khong dung Internet.

## 1. Chay tren Windows PowerShell (Node.js 24+)

Giai nen thu muc nay vao `D:\an_toan_mang\api-security-web-lab` (hoac duong dan tuy y).

**Cai thu vien (mot lan):**

```powershell
cd D:\an_toan_mang\api-security-web-lab\backend
npm install
```

**PowerShell A — ban DA VA:**

```powershell
cd D:\an_toan_mang\api-security-web-lab\backend
$env:LAB_MODE = 'secure'
$env:PORT = '3100'
npm start
```

Mo <http://127.0.0.1:3100/login>

**PowerShell B — ban CO LO HONG:**

```powershell
cd D:\an_toan_mang\api-security-web-lab\backend
$env:LAB_MODE = 'vulnerable'
$env:PORT = '3101'
npm start
```

Mo <http://127.0.0.1:3101/login>

**Khong can Nginx de chay website.** Co file tham khao `nginx/nginx-site-gateway.conf` cho cong 18180 neu muon thu gateway, khong duoc ghi de cau hinh Nginx dang chay cong 18080.

### Tai khoan demo

| User | Mat khau | Role |
| --- | --- | --- |
| alice | `Alice@123` | USER |
| bob | `Bob@123` | USER |
| admin | `Admin@123` | ADMIN |

**Khong su dung mat khau nay tren he thong that.** Du lieu SQLite va khoa ma hoa luu rieng o `backend/data/secure/` va `backend/data/vulnerable/`. Hai may chu su dung hai database khac nhau.

## 2. Website co nhung trang nao?

1. `/login` — Dang nhap, cap JWT
2. `/register` — Dang ky USER
3. `/dashboard` — Thong ke va tai lieu gan day
4. `/documents` — Danh sach, tim kiem, tao tai lieu
5. `/documents/101` — Xem, sua, xoa tai lieu
6. `/profile` — Ho so tai khoan va JSON API
7. `/admin` — Bang thong ke quan tri, bao ve theo role
8. `/lab` — Mot giao dien chay 7 tinh huong va hien HTTP status

## 3. Bay kich ban va endpoint

| # | Nhap | Endpoint | Vulnerable | Secure |
|---|---|---|---|---|
| 1 | Broken Authentication (API2:2023) | POST /api/login sai mat khau | 200 + JWT | 401 |
| 2 | BOLA (API1:2023) | GET /api/documents/102 (Alice JWT) | 200 | 403 |
| 3 | Excessive Data Exposure (API3:2023) | GET /api/profile | Lo password_hash, phone, national_id | Chi field duoc phep |
| 4 | BFLA (API5:2023) | GET /api/admin/stats (Alice JWT) | 200 | 403 |
| 5 | Mass Assignment (API3:2023) | PATCH /api/documents/101 {"is_public":true} | 200 | 400 |
| 6 | Unrestricted Resource Consumption (API4:2023) | POST /api/reports/preview {"count":120} | 200 | 413 |
| 7 | SQL Injection (OWASP Injection) | GET /api/documents/search?q=... | Co the lo tai lieu Bob | Tim kiem co tham so |

**Chinh xac ve phan loai:** Excessive Data Exposure va Mass Assignment la hai truong hop thuoc API3:2023 (Broken Object Property Level Authorization). SQL Injection khong phai mot muc doc lap trong OWASP API Security Top 10 2023.

Kich ban 6 *chi mo phong thieu gioi han nghiep vu*: co tran ky thuat 1200 items tren ca hai che do. Trong lab chi test 120 items de KHONG gay DoS that.

## 4. Kiem thu tu dong ca 2 che do

Khi ca hai cua so PowerShell tren dang chay, mo PowerShell thu ba:

```powershell
cd D:\an_toan_mang\api-security-web-lab
node scripts\check-seven.js
```

Script kiem tra 9 dieu kien / moi che do (18 phep kiem tra) va xuat `reports/7-scenarios-results.json`. Khong in token len console.

## 5. Khoi phuc du lieu demo

**Dung server can reset bang Ctrl+C truoc**, sau do:

```powershell
cd D:\an_toan_mang\api-security-web-lab\backend
$env:LAB_MODE = 'vulnerable'
npm run reset
```

Khoi dong lai server; du lieu Alice/Bob/Admin va 4 tai lieu duoc tao lai. Lam tuong tu voi `LAB_MODE=secure` neu can. Khong xoa key/secret khi database van dang su dung.

## 6. Cau truc ma nguon

```text
api-security-web-lab/
|-- backend/
|   |-- index.js            # API va 7 nhanh vulnerable/secure
|   |-- db.js               # SQLite, users, documents, seed
|   |-- encryption.js       # AES-256-GCM
|   |-- reset.js            # Reset du lieu demo cua moi mode
|   `-- package.json
|-- public/
|   |-- index.html          # Shell giao dien
|   |-- assets/style.css    # Responsive design
|   `-- js/app.js           # 8 man hinh/route va luong fetch
|-- scripts/check-seven.js # Kiem thu va xuat JSON
|-- nginx/nginx-site-gateway.conf
|-- docs/SCENARIOS.md
`-- reports/
```

## 7. Luu y bao mat

- Intentionally vulnerable code CHI mo tren `127.0.0.1`, khong host tren Vercel/Azure, khong mo port ra Internet, khong lam viec voi du lieu that.
- Khong sua `host = '127.0.0.1'` trong backend/index.js thanh `0.0.0.0`.
- Ban demo su dung Bearer JWT trong sessionStorage de don gian hoa phan frontend. Day KHONG PHAI thiet ke dang nhap production. Moi truong that can danh gia XSS, CSRF, cookie policy, TLS, auditing, secret lifecycle, RBAC, validation, security testing day du.
- Khong commit `backend/data/*`, file `.env`, khoa ma hoa hoac token.
- Cau hinh Nginx tham khao chi proxy den ban SECURE va KHONG thay the file Nginx cua du an cu.

## 8. Trang thai kiem chung khi ban giao

Ma nguon JavaScript da duoc kiem tra cu phap. Chua chay end-to-end trong moi truong tao ZIP vi khong tai duoc npm dependencies; tren may Windows co mang, chay `npm install` va `node scripts/check-seven.js` de xac nhan day du 7 kich ban.
