# Belt Conveyor Dashboard — ITD HONGSA (เรียลไทม์ผ่าน GitHub Pages + Google Sheets)

Dashboard สรุปงานเปลี่ยน/ซ่อมสายพานลำเลียง โฮสต์บน **GitHub Pages** (ฟรี) และเก็บข้อมูลกลางใน
**Google Sheets** ทำให้หลายคนช่วยกันกรอกได้ และทุกคนเห็นข้อมูลชุดเดียวกันแบบ near real-time
(หน้าเว็บรีเฟรชข้อมูลจาก Sheet อัตโนมัติทุก 20 วินาที)

```
[หลายคนกรอกผ่านหน้าเว็บ] ⇄ [Apps Script Web App = API] ⇄ [Google Sheet = ฐานข้อมูล]
            ↑
   [GitHub Pages เสิร์ฟ index.html] ──► ดึงข้อมูลมาแสดง + auto-refresh ทุก 20 วิ
```

ไฟล์ในโปรเจกต์:
- `index.html` — หน้า dashboard (เชื่อม Google Sheet แล้ว เหลือแค่วาง URL)
- `google-apps-script.gs` — โค้ด API วางใน Google Apps Script
- `README.md` — คู่มือนี้

---

## ขั้นตอนที่ 1 — สร้าง Google Sheet + ติดตั้ง API

1. ไปที่ https://sheets.google.com สร้างไฟล์ใหม่ 1 ไฟล์ (ตั้งชื่ออะไรก็ได้ เช่น `ITD Belt Data`)
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมในหน้าจอออกให้หมด แล้ว **คัดลอกเนื้อหาทั้งหมดจาก `google-apps-script.gs`** มาวาง
4. กด 💾 บันทึก (ไอคอน Save)
5. ที่แถบฟังก์ชันด้านบน เลือกฟังก์ชัน **`setup`** แล้วกด **▶ Run** หนึ่งครั้ง
   - ครั้งแรกจะขออนุญาต: กด **Review permissions → เลือกบัญชี → Advanced → Go to (project) → Allow**
   - จะได้ชีตชื่อ `data` พร้อมหัวตาราง

## ขั้นตอนที่ 2 — Deploy เป็น Web App แล้วเอา URL มาใส่

1. มุมขวาบนของ Apps Script กด **Deploy → New deployment**
2. กดเฟือง ⚙ ข้าง "Select type" เลือก **Web app**
3. ตั้งค่า:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`   ← สำคัญ ต้องเป็น Anyone หน้าเว็บถึงจะอ่าน/เขียนได้
4. กด **Deploy** แล้วคัดลอก **Web app URL** (ลงท้ายด้วย `/exec`)
5. เปิดไฟล์ `index.html` แก้บรรทัด `API_URL` ใกล้ๆ บนสุดของ `<script>`:
   ```js
   const CONFIG={
     API_URL:'https://script.google.com/macros/s/AKfyc..../exec',  // ← วาง URL ตรงนี้
     POLL_MS:20000
   };
   ```

> หมายเหตุ: ทุกครั้งที่แก้โค้ด `.gs` ต้อง **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**
> URL จะคงเดิม ไม่ต้องเปลี่ยนใน index.html

## ขั้นตอนที่ 3 — อัปโหลดข้อมูลเดิม 283 รายการขึ้น Sheet (ทำครั้งเดียว)

1. เปิด `index.html` ด้วยเบราว์เซอร์ (ดับเบิลคลิกไฟล์ หรือเปิดผ่าน GitHub Pages หลังขั้นตอนที่ 4)
2. กด **F12** เปิด Console
3. พิมพ์ `seedSheet()` แล้ว Enter → ยืนยัน
4. รอจนขึ้น "อัปโหลดสำเร็จ" — ข้อมูลต้นฉบับจะอยู่ใน Sheet แล้ว
   (ไฟ "สถานะข้อมูล" บน header จะเป็นสีเขียว = เชื่อมต่อแล้ว)

> ทำครั้งเดียวพอ หลังจากนี้ทุกคนกรอกผ่านปุ่ม "➕ กรอกข้อมูลใหม่" ข้อมูลจะเข้า Sheet โดยตรง

## ขั้นตอนที่ 4 — ขึ้น GitHub Pages

1. สร้าง repository ใหม่บน https://github.com (เช่น `belt-dashboard`) ตั้งเป็น **Public**
2. อัปโหลด `index.html` (และ `README.md`, `google-apps-script.gs` ถ้าต้องการ) เข้า repo
   - วิธีง่าย: หน้า repo กด **Add file → Upload files** ลากไฟล์เข้าไป → Commit
3. ไปที่ **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / folder: **/ (root)** → Save
4. รอ ~1 นาที จะได้ลิงก์ เช่น `https://<username>.github.io/belt-dashboard/`
5. แชร์ลิงก์นี้ให้ทีม — ทุกคนเปิดดู/กรอกได้ และเห็นข้อมูลชุดเดียวกัน

---

## การใช้งานประจำวัน
- **กรอกข้อมูล:** กดปุ่ม **➕ กรอกข้อมูลใหม่** → บันทึก → ขึ้น Sheet ทันที คนอื่นเห็นภายใน ~20 วิ
- **ดูสถานะ:** ไฟมุมขวาบน — 🟢 เชื่อมต่อแล้ว · 🟡 กำลังซิงค์ · ⚫ ออฟไลน์ · 🔴 ต่อไม่ติด
- **แก้ไข/ลบรายการ:** แก้ใน Google Sheet ได้โดยตรง (หน้าเว็บจะอัปเดตตามรอบรีเฟรช)
- **ปริ้น A4:** ปุ่ม 🖨️ เหมือนเดิม

## ปัญหาที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ไฟสถานะเป็นสีเทา "ออฟไลน์ (SEED)" | ยังไม่ได้วาง `API_URL` ใน index.html |
| ไฟแดง "ต่อไม่ติด" | Deploy ไม่ได้ตั้ง Who has access = **Anyone** หรือยังไม่ได้ New version |
| กรอกแล้วคนอื่นไม่เห็น | ตรวจว่าใช้ URL ลงท้าย `/exec` (ไม่ใช่ `/dev`) และ deploy เวอร์ชันล่าสุดแล้ว |
| ข้อมูลซ้ำ | `seedSheet()` รันได้ครั้งเดียวพอ (มันล้างแล้วเขียนใหม่ทุกครั้ง อย่ารันซ้ำหลังเริ่มกรอกจริง) |

## ความปลอดภัย (ควรรู้)
"Who has access: Anyone" หมายถึงใครมี URL ของ API ก็อ่าน/เพิ่มข้อมูลได้ เหมาะกับข้อมูลภายในที่ไม่ลับมาก
ถ้าต้องการจำกัดสิทธิ์จริงจัง ต้องเพิ่มระบบ login/โทเคน ซึ่งเกินขอบเขตชุดนี้ — แจ้งได้ถ้าต้องการต่อยอด
