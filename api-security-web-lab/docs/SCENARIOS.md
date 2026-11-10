# So sanh code co lo hong va da sua

Mo `backend/index.js` va tim cac comment `VULNERABILITY` cung cac nhom tu khoa `API1`, `API2`, `API3`, `API4`, `API5`, `SQL Injection`.

Cac nhanh `if (VULNERABLE)` chinh la noi chuong trinh **co tinh** tao hanh vi thieu an toan. `VULNERABLE` chi duoc bat bang bien moi truong server `LAB_MODE=vulnerable`. Client khong duoc phap tu bat che do nay qua API.

## 1. Broken Authentication (API2)

- File: `backend/index.js`, `POST /api/login`
- Loi: tim thay username roi `jwt.sign()` ngay, **khong** kiem tra password.
- Sau sua: `await bcrypt.compare(password, user.password_hash)`; neu sai tra 401 truoc khi tao JWT.
- Thu: Alice + mat khau `wrong-password`. Vulnerable 200+JWT; secure 401.

## 2. BOLA (API1)

- File: `backend/index.js`, `GET /api/documents/:id`
- Loi: doc tai lieu tu ID ma khong doi chieu `row.owner_id` voi `req.user.id`.
- Sau sua: `if (row.owner_id !== req.user.id) return 403`.
- Thu: Alice JWT xem `/api/documents/102` (Bob). Vulnerable 200; secure 403.

## 3. Excessive Data Exposure (API3)

- File: `backend/index.js`, `GET /api/profile`
- Loi: `SELECT * FROM users` + response toan bo, con giai ma `phone` va `national_id`.
- Sau sua: tao JSON allowlist chi co `id`, `username`, `full_name`, `email`, `role`.
- Thu: so sanh danh sach thuoc tinh JSON, khong can ghi lai gia tri nhay cam vao bao cao.

## 4. Broken Function Level Authorization (API5)

- File: `backend/index.js`, `GET /api/admin/stats`
- Loi: bat buoc JWT nhung bo qua `role`.
- Sau sua: `if (req.user.role !== 'ADMIN') return 403`.
- Thu: dang nhap Alice, truy cap `/admin`: Vulnerable hien so lieu, Secure 403.

## 5. Mass Assignment (API3)

- File: `backend/index.js`, `PATCH /api/documents/:id`
- Loi: nhan ca `owner_id` va `is_public` tu JSON cua client, du UI khong co truong nay.
- Sau sua: chi chap nhan `title` va `content` (allowlist); field ngoai danh sach -> 400.
- Thu: Alice PATCH document 101 `{ "is_public": true }`. Vulnerable sua flag, secure 400.
- Co the thu `owner_id:2` bang Postman nhung can reset du lieu sau do.

## 6. Unrestricted Resource Consumption (API4) — MO PHONG AN TOAN

- File: `backend/index.js`, `POST /api/reports/preview`
- Loi nghiep vu: khong gioi han preview toi da 50 ban ghi cho request binh thuong.
- Sau sua: neu `count > 50`, tra HTTP 413.
- Ca hai mode deu co *gioi han ky thuat* 1200 de tranh tai nguyen tang bat kiem soat. Do do day la bai mo phong ve tai nguyen theo muc dich giang day, khong phai exploit DoS that.
- Thu: `{ "count": 120 }`: Vulnerable 200; Secure 413.

## 7. SQL Injection

- File: `backend/index.js`, `GET /api/documents/search`
- Loi: `... title LIKE '%${q}%'` ghep du lieu client vao chuoi SQL. Neu q chua nhay don/cau SQL, cau truc truy van co the bi thay doi.
- Sau sua: `db.prepare('... owner_id = ? AND title LIKE ? ...').all(req.user.id, like)`; `q` luon la gia tri tham so.
- Thu local bang chuoi `' OR 1=1 --` qua query `q` da URL-encode. Vulnerable co the tra ca tai lieu Bob; Secure khong tra tai lieu Bob.

## Lien he OWASP

OWASP API Security Top 10:2023:
- API1: BOLA
- API2: Broken Authentication
- API3: Broken Object Property Level Authorization (ca Exposure va Mass Assignment)
- API4: Unrestricted Resource Consumption
- API5: BFLA
- SQL Injection la mot loai Injection, khong phai mot muc rieng trong OWASP API Top 10:2023.

Nguon: https://api-security.owasp.org/editions/2023/en/0x11-t10/

## Bang ket qua ky vong cho tai khoan Alice

| Tinh huong | Vulnerable :3101 | Secure :3100 |
|---|---|---|
| Sai password | 200 | 401 |
| Doc document 102 | 200 | 403 |
| GET profile | Lo sensitive fields | Khong lo |
| GET admin stats | 200 | 403 |
| PATCH is_public | 200 | 400 |
| POST preview count120 | 200 | 413 |
| Search payload injection | Co document Bob | Khong co document Bob |

Doi chieu them `scripts/check-seven.js`, mo Postman/Burp/ZAP de xem request/response va xuat bang chung.
