import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "3mb" }));

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`);
}

const sign = (user) => jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "60d" });

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "ยังไม่ได้เข้าสู่ระบบ" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }
}

app.post("/api/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "กรอกอีเมลและรหัสผ่าน" });
    if (password.length < 6) return res.status(400).json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" });
    const hash = await bcrypt.hash(password, 10);
    let result;
    try {
      result = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email",
        [email, hash]
      );
    } catch (e) {
      if (e.code === "23505") return res.status(400).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
      throw e;
    }
    const user = result.rows[0];
    await pool.query(
      "INSERT INTO app_data (user_id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, JSON.stringify({})]
    );
    res.json({ token: sign(user), email: user.email });
  } catch (e) {
    console.error("register:", e.message);
    res.status(500).json({ error: "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    res.json({ token: sign(user), email: user.email });
  } catch (e) {
    console.error("login:", e.message);
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

app.get("/api/data", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT data FROM app_data WHERE user_id=$1", [req.user.id]);
    res.json({ data: r.rows[0]?.data || {} });
  } catch (e) {
    console.error("get data:", e.message);
    res.status(500).json({ error: "โหลดข้อมูลไม่สำเร็จ" });
  }
});

app.put("/api/data", auth, async (req, res) => {
  try {
    const data = req.body.data || {};
    await pool.query(
      `INSERT INTO app_data (user_id, data, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (user_id) DO UPDATE SET data=$2, updated_at=now()`,
      [req.user.id, JSON.stringify(data)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("put data:", e.message);
    res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
});

const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log("เงินงอกเงย พร้อมใช้งานที่พอร์ต " + port)))
  .catch((e) => {
    console.error("เชื่อมต่อฐานข้อมูลไม่สำเร็จ:", e.message);
    app.listen(port, () => console.log("เปิดเซิร์ฟเวอร์ (ฐานข้อมูลยังไม่พร้อม) ที่พอร์ต " + port));
  });
