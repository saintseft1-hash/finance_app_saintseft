# เงินงอกเงย — แอปจัดการรายรับรายจ่าย & การลงทุน

เว็บแอปจัดการการเงินส่วนตัว: บันทึกรายรับ-รายจ่าย จัดงบประมาณ และระบบแนะนำพอร์ตการลงทุนตามระดับความเสี่ยง
ข้อมูลถูกเก็บไว้ในเบราว์เซอร์ของผู้ใช้ (localStorage)

## รันบนเครื่องตัวเอง

```bash
npm install
npm run dev        # เปิด http://localhost:5173
```

## Build production

```bash
npm run build      # สร้างไฟล์ลงโฟลเดอร์ dist/
npm start          # เสิร์ฟด้วย Express (อ่านพอร์ตจาก process.env.PORT)
```

---

## ขั้นตอนที่ 1 — ขึ้น GitHub

1. ไปที่ https://github.com/new สร้าง repository เปล่า (ตั้งชื่อเช่น `ngern-ngok-ngoey`)
   อย่าเพิ่งติ๊ก add README/gitignore เพื่อไม่ให้ชนกัน
2. ในโฟลเดอร์โปรเจกต์นี้ รันคำสั่ง (โค้ดถูก commit ไว้ให้แล้ว):

```bash
git remote add origin https://github.com/<ชื่อผู้ใช้>/ngern-ngok-ngoey.git
git branch -M main
git push -u origin main
```

> ครั้งแรกที่ push GitHub จะให้ล็อกอิน — ใช้ Personal Access Token แทนรหัสผ่าน
> (สร้างที่ Settings → Developer settings → Personal access tokens)

## ขั้นตอนที่ 2 — ขึ้น Railway

**วิธีง่ายสุด: เชื่อมกับ GitHub repo**

1. ไปที่ https://railway.app แล้วล็อกอินด้วย GitHub
2. New Project → **Deploy from GitHub repo** → เลือก repo ที่เพิ่ง push
3. Railway จะตรวจเจอ Node อัตโนมัติ แล้วรัน `npm run build` ตามด้วย `npm start`
   (กำหนดไว้ใน `package.json` และ `nixpacks.toml` แล้ว)
4. ไปที่แท็บ **Settings → Networking → Generate Domain** เพื่อรับลิงก์เว็บสาธารณะ

**หรือ deploy ตรงด้วย CLI (ไม่ต้องผ่าน GitHub):**

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### หมายเหตุ
- ไม่ต้องตั้งค่า `PORT` เอง Railway ใส่ให้อัตโนมัติ และ `server.js` อ่านค่ามาแล้ว
- ถ้า build ช้าเพราะ recharts ก้อนใหญ่ ไม่กระทบการทำงาน ข้ามคำเตือน chunk size ได้
