import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ----------------------------- ค่าคงที่/ตั้งค่า ----------------------------- */

const PALETTE = {
  paper: "#F4F2EC",
  card: "#FCFBF7",
  ink: "#15201C",
  brand: "#143F3A",
  brass: "#B08838",
  income: "#1F7A4D",
  expense: "#B4533E",
  muted: "#6B6F68",
  hair: "#DAD6CA",
};

const INCOME_CATS = [
  { id: "salary", label: "เงินเดือน" },
  { id: "freelance", label: "งานเสริม / ฟรีแลนซ์" },
  { id: "invest", label: "ผลตอบแทนการลงทุน" },
  { id: "other_in", label: "อื่น ๆ" },
];

const EXPENSE_CATS = [
  { id: "home", label: "ที่พัก", bucket: "needs" },
  { id: "food", label: "อาหาร", bucket: "needs" },
  { id: "transport", label: "เดินทาง", bucket: "needs" },
  { id: "utility", label: "สาธารณูปโภค", bucket: "needs" },
  { id: "essential", label: "ของใช้จำเป็น", bucket: "needs" },
  { id: "health", label: "สุขภาพ", bucket: "needs" },
  { id: "debt", label: "หนี้สิน / ผ่อน", bucket: "needs" },
  { id: "shopping", label: "ช้อปปิ้ง", bucket: "wants" },
  { id: "fun", label: "บันเทิง", bucket: "wants" },
  { id: "travel", label: "ท่องเที่ยว", bucket: "wants" },
  { id: "invest_out", label: "ออม / ลงทุน", bucket: "save" },
  { id: "other_out", label: "อื่น ๆ", bucket: "wants" },
];

const ASSETS = {
  cash: { label: "เงินสด / กองทุนตลาดเงิน", ret: 2, risk: 1, vehicle: "กองทุนตลาดเงิน, เงินฝากดอกเบี้ยสูง", color: "#9AA39B" },
  bond: { label: "ตราสารหนี้ / พันธบัตร", ret: 4, risk: 5, vehicle: "พันธบัตรรัฐบาล, กองทุนตราสารหนี้", color: "#6E8FA6" },
  gold: { label: "ทองคำ", ret: 6, risk: 15, vehicle: "กองทุนทองคำ, ทองคำแท่ง", color: "#C9A227" },
  th: { label: "หุ้นไทย", ret: 8, risk: 18, vehicle: "กองทุนดัชนี SET50, SSF/RMF หุ้นไทย", color: "#B4533E" },
  intl: { label: "หุ้นต่างประเทศ", ret: 9, risk: 16, vehicle: "กองทุนหุ้นโลก / S&P500, SSF/RMF ต่างประเทศ", color: "#1F7A4D" },
};

const LOW = { cash: 15, bond: 55, gold: 10, th: 8, intl: 12 };
const HIGH = { cash: 0, bond: 5, gold: 10, th: 35, intl: 50 };

// สินทรัพย์ที่ดึงราคาเรียลไทม์ (ใช้ ETF ที่ซื้อขายในสหรัฐเป็นตัวแทนแต่ละสินทรัพย์)
const MARKET_ASSETS = [
  { sym: "SPY", label: "หุ้นโลก / สหรัฐ", note: "S&P 500 ETF — ตัวแทนหุ้นต่างประเทศ" },
  { sym: "THD", label: "หุ้นไทย", note: "MSCI Thailand ETF — ตัวแทนตลาดหุ้นไทย" },
  { sym: "GLD", label: "ทองคำ", note: "Gold ETF — ตัวแทนราคาทองคำ" },
  { sym: "BND", label: "ตราสารหนี้", note: "Total Bond ETF — ตัวแทนตราสารหนี้" },
];

/* ----------------------------- ตัวช่วย ----------------------------- */

const fmt = (n) => "฿" + Math.round(n || 0).toLocaleString("th-TH");
const fmtK = (n) => {
  if (Math.abs(n) >= 1e6) return "฿" + (n / 1e6).toFixed(1) + "ล้าน";
  if (Math.abs(n) >= 1e3) return "฿" + Math.round(n / 1e3) + "k";
  return "฿" + Math.round(n);
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (k) => {
  const [y, m] = k.split("-");
  const names = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${names[+m - 1]} ${+y + 543}`;
};

function portfolioFromRisk(riskPct) {
  const t = Math.max(0, Math.min(1, (riskPct - 5) / (22 - 5)));
  const w = {};
  let sum = 0;
  for (const k of Object.keys(LOW)) {
    w[k] = LOW[k] + t * (HIGH[k] - LOW[k]);
    sum += w[k];
  }
  for (const k of Object.keys(w)) w[k] = (w[k] / sum) * 100;
  let expRet = 0, wRisk = 0;
  for (const k of Object.keys(w)) {
    expRet += (w[k] / 100) * ASSETS[k].ret;
    wRisk += (w[k] / 100) * ASSETS[k].risk;
  }
  const portRisk = wRisk * 0.85;
  return { w, expRet, portRisk };
}

function projectGrowth(monthly, annualRatePct, years) {
  const r = annualRatePct / 100 / 12;
  const data = [];
  for (let y = 0; y <= years; y++) {
    const n = y * 12;
    const fv = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
    data.push({ year: y, value: Math.round(fv), contributed: Math.round(monthly * n) });
  }
  return data;
}

/* ----------------------------- storage (localStorage) ----------------------------- */

function load(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
}

/* ----------------------------- คอมโพเนนต์ย่อย ----------------------------- */

function Stat({ label, value, sub, color }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || PALETTE.ink }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Bar({ pct, color }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: Math.min(100, pct) + "%", background: color }} />
    </div>
  );
}

/* ----------------------------- แอปหลัก ----------------------------- */

export default function App() {
  const [tab, setTab] = useState("overview");
  const [settings, setSettings] = useState(() =>
    load("finance:settings", { monthlyIncome: 18000, riskTolerance: 20, investOverride: null, finnhubKey: "" })
  );
  const [txns, setTxns] = useState(() => load("finance:txns", []));
  const [viewMonth, setViewMonth] = useState(monthKey(todayStr()));

  useEffect(() => { save("finance:settings", settings); }, [settings]);
  useEffect(() => { save("finance:txns", txns); }, [txns]);

  const monthsWithData = useMemo(() => {
    const set = new Set(txns.map((t) => monthKey(t.date)));
    set.add(monthKey(todayStr()));
    return [...set].sort();
  }, [txns]);

  const monthTxns = useMemo(
    () => txns.filter((t) => monthKey(t.date) === viewMonth),
    [txns, viewMonth]
  );

  const income = monthTxns.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = monthTxns.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  const cumNet = useMemo(
    () => txns.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0),
    [txns]
  );

  const avgExpense = useMemo(() => {
    const byMonth = {};
    txns.filter((t) => t.type === "expense").forEach((t) => {
      byMonth[monthKey(t.date)] = (byMonth[monthKey(t.date)] || 0) + t.amount;
    });
    const vals = Object.values(byMonth);
    if (!vals.length) return settings.monthlyIncome * 0.5;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [txns, settings.monthlyIncome]);

  const emergencyTarget = avgExpense * 6;

  const { w, expRet, portRisk } = useMemo(
    () => portfolioFromRisk(settings.riskTolerance),
    [settings.riskTolerance]
  );

  const recommendedInvest = useMemo(
    () => Math.round((settings.monthlyIncome * 0.2) / 100) * 100,
    [settings.monthlyIncome]
  );

  const investMonthly = settings.investOverride ?? recommendedInvest;
  const [projYears, setProjYears] = useState(20);
  const projection = useMemo(
    () => projectGrowth(investMonthly, expRet, projYears),
    [investMonthly, expRet, projYears]
  );
  const finalVal = projection[projection.length - 1];
  const passiveMonthly = (finalVal.value * 0.04) / 12;

  return (
    <div className="root">
      <style>{CSS}</style>

      <header className="hdr">
        <div>
          <div className="brand-mark">เงินงอกเงย</div>
          <div className="brand-sub">บัญชีส่วนตัว · ออม · ลงทุน</div>
        </div>
        <div className="hdr-net">
          <span className="hdr-net-label">ยอดสะสมทั้งหมด</span>
          <span className="hdr-net-val" style={{ color: cumNet >= 0 ? PALETTE.income : PALETTE.expense }}>
            {fmt(cumNet)}
          </span>
        </div>
      </header>

      <nav className="tabs">
        {[
          ["overview", "ภาพรวม"],
          ["txns", "รายการ"],
          ["budget", "งบประมาณ"],
          ["invest", "การลงทุน"],
          ["markets", "ตลาด"],
        ].map(([id, label]) => (
          <button key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === "overview" && (
          <Overview {...{ viewMonth, setViewMonth, income, expense, net, savingsRate, avgExpense, emergencyTarget }} />
        )}
        {tab === "txns" && (
          <Transactions {...{ txns, setTxns, viewMonth, setViewMonth, monthTxns }} />
        )}
        {tab === "budget" && (
          <Budget {...{ settings, setSettings, monthTxns, income }} />
        )}
        {tab === "invest" && (
          <Invest {...{ settings, setSettings, w, expRet, portRisk, recommendedInvest,
            investMonthly, projYears, setProjYears, projection, finalVal, passiveMonthly,
            avgExpense, emergencyTarget }} />
        )}
        {tab === "markets" && <Markets {...{ settings, setSettings }} />}
      </main>

      <footer className="ftr">
        ข้อมูลผลตอบแทน/ความเสี่ยงเป็นค่าประมาณการเพื่อการวางแผนเท่านั้น ไม่ใช่คำแนะนำการลงทุนหรือการรับประกันผลตอบแทน
        — โปรดศึกษาข้อมูลและพิจารณาความเหมาะสมก่อนตัดสินใจ
      </footer>
    </div>
  );
}

/* ----------------------------- แท็บ: ภาพรวม ----------------------------- */

function Overview({ viewMonth, setViewMonth, income, expense, net, savingsRate, avgExpense, emergencyTarget }) {
  return (
    <>
      <MonthNav viewMonth={viewMonth} setViewMonth={setViewMonth} />

      <div className="hero-card">
        <div className="hero-row">
          <Stat label="รายรับเดือนนี้" value={fmt(income)} color={PALETTE.income} />
          <div className="hero-divider" />
          <Stat label="รายจ่ายเดือนนี้" value={fmt(expense)} color={PALETTE.expense} />
        </div>
        <div className="hero-net">
          <span>คงเหลือ</span>
          <span style={{ color: net >= 0 ? PALETTE.income : PALETTE.expense }}>{fmt(net)}</span>
        </div>
        <div className="hero-rate">
          <span>อัตราการออม</span>
          <Bar pct={Math.max(0, savingsRate)} color={PALETTE.brand} />
          <span className="rate-num">{savingsRate.toFixed(0)}%</span>
        </div>
        <div className="hero-hint">
          {savingsRate >= 20
            ? "ออมได้ดีมาก เกิน 20% — เหมาะสำหรับการลงทุนต่อยอด"
            : savingsRate >= 0
            ? "เป้าหมายที่ดีคือออมให้ได้ 20% ขึ้นไป ลองตัดรายจ่ายหมวด ‘อยากได้’"
            : "เดือนนี้จ่ายเกินรับ ลองดูหมวดที่จ่ายเยอะที่สุดในแท็บรายการ"}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">ลำดับความสำคัญทางการเงิน</div>
          <ol className="priority">
            <li><b>กองทุนฉุกเฉิน</b> — สำรอง 6 เท่าของรายจ่าย ≈ {fmt(emergencyTarget)}</li>
            <li><b>ปลดหนี้ดอกเบี้ยสูง</b> — เช่น บัตรเครดิต ก่อนเริ่มลงทุน</li>
            <li><b>ลงทุนระยะยาว</b> — ทยอยลงทุนสม่ำเสมอ (DCA)</li>
          </ol>
          <div className="muted-note">รายจ่ายเฉลี่ย/เดือน ≈ {fmt(avgExpense)}</div>
        </div>
        <div className="card">
          <div className="card-title">เคล็ดลับให้รายได้โต</div>
          <ul className="tips">
            <li>เก็บก่อนใช้ — ตั้งโอนเข้าบัญชีลงทุนทันทีที่เงินเดือนเข้า</li>
            <li>เพิ่มรายรับทางที่สอง งานเสริม/ฟรีแลนซ์ เพื่อเร่งเงินต้นลงทุน</li>
            <li>ลงทุนผ่าน SSF/RMF เพื่อลดหย่อนภาษีและบังคับออมระยะยาว</li>
            <li>ให้ดอกเบี้ยทบต้นทำงาน — ยิ่งเริ่มเร็ว ยิ่งได้เปรียบ</li>
          </ul>
        </div>
      </div>
    </>
  );
}

function MonthNav({ viewMonth, setViewMonth }) {
  const shift = (n) => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setViewMonth(d.toISOString().slice(0, 7));
  };
  return (
    <div className="month-nav">
      <button onClick={() => shift(-1)}>‹</button>
      <span>{monthLabel(viewMonth)}</span>
      <button onClick={() => shift(1)}>›</button>
    </div>
  );
}

/* ----------------------------- แท็บ: รายการ ----------------------------- */

function Transactions({ txns, setTxns, viewMonth, setViewMonth, monthTxns }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;

  const add = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const validCat = cats.find((c) => c.id === cat) ? cat : cats[0].id;
    setTxns([{ id: Date.now(), type, amount: amt, category: validCat, date, note }, ...txns]);
    setAmount(""); setNote("");
  };
  const del = (id) => setTxns(txns.filter((t) => t.id !== id));

  const catLabel = (id) =>
    [...INCOME_CATS, ...EXPENSE_CATS].find((c) => c.id === id)?.label || id;

  const sorted = [...monthTxns].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <>
      <div className="card form-card">
        <div className="type-toggle">
          <button className={type === "expense" ? "active exp" : ""} onClick={() => { setType("expense"); setCat("food"); }}>รายจ่าย</button>
          <button className={type === "income" ? "active inc" : ""} onClick={() => { setType("income"); setCat("salary"); }}>รายรับ</button>
        </div>
        <div className="form-grid">
          <label>จำนวนเงิน
            <input type="number" inputMode="decimal" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>หมวดหมู่
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>วันที่
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>บันทึก (ไม่บังคับ)
            <input type="text" value={note} placeholder="รายละเอียด" onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <button className="btn-primary" onClick={add}>+ เพิ่มรายการ</button>
      </div>

      <MonthNav viewMonth={viewMonth} setViewMonth={setViewMonth} />

      <div className="card list-card">
        {sorted.length === 0 && <div className="empty">ยังไม่มีรายการในเดือนนี้ เพิ่มรายการแรกด้านบนได้เลย</div>}
        {sorted.map((t) => (
          <div className="txn" key={t.id}>
            <div className="txn-main">
              <span className="txn-cat">{catLabel(t.category)}</span>
              {t.note && <span className="txn-note">{t.note}</span>}
              <span className="txn-date">{t.date.slice(8)}/{t.date.slice(5, 7)}</span>
            </div>
            <div className="txn-amt" style={{ color: t.type === "income" ? PALETTE.income : PALETTE.expense }}>
              {t.type === "income" ? "+" : "−"}{fmt(t.amount).slice(1)}
            </div>
            <button className="txn-del" onClick={() => del(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ----------------------------- แท็บ: งบประมาณ ----------------------------- */

function Budget({ settings, setSettings, monthTxns, income }) {
  const inc = settings.monthlyIncome;
  const plan = { needs: 0.5, wants: 0.3, save: 0.2 };

  const actual = { needs: 0, wants: 0, save: 0 };
  monthTxns.filter((t) => t.type === "expense").forEach((t) => {
    const c = EXPENSE_CATS.find((x) => x.id === t.category);
    if (c) actual[c.bucket] += t.amount;
  });
  const spentTotal = actual.needs + actual.wants + actual.save;
  actual.save += Math.max(0, income - spentTotal);

  const rows = [
    { key: "needs", label: "จำเป็น (ที่พัก อาหาร เดินทาง)", color: PALETTE.brand },
    { key: "wants", label: "อยากได้ (ช้อปปิ้ง บันเทิง)", color: PALETTE.brass },
    { key: "save", label: "ออม / ลงทุน", color: PALETTE.income },
  ];

  return (
    <>
      <div className="card">
        <div className="card-title">รายได้ต่อเดือน</div>
        <div className="income-edit">
          <span>฿</span>
          <input
            type="number"
            value={inc}
            onChange={(e) => setSettings({ ...settings, monthlyIncome: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="muted-note">ใช้สูตร 50 / 30 / 20 เป็นแนวทางจัดสรรเงิน</div>
      </div>

      <div className="card">
        <div className="card-title">แผน vs ใช้จริงเดือนนี้</div>
        {rows.map((r) => {
          const planAmt = inc * plan[r.key];
          const actAmt = actual[r.key];
          const pct = planAmt > 0 ? (actAmt / planAmt) * 100 : 0;
          const over = actAmt > planAmt && r.key !== "save";
          return (
            <div className="budget-row" key={r.key}>
              <div className="budget-head">
                <span>{r.label}</span>
                <span className="budget-nums">
                  <b style={{ color: over ? PALETTE.expense : PALETTE.ink }}>{fmt(actAmt)}</b>
                  <span className="muted"> / {fmt(planAmt)}</span>
                </span>
              </div>
              <Bar pct={pct} color={over ? PALETTE.expense : r.color} />
            </div>
          );
        })}
        <div className="muted-note">
          แนะนำให้กันส่วน “ออม/ลงทุน” อย่างน้อย {fmt(inc * 0.2)} ทุกเดือน — ตั้งโอนอัตโนมัติทันทีที่เงินเข้า
        </div>
      </div>
    </>
  );
}

/* ----------------------------- แท็บ: การลงทุน ----------------------------- */

function Invest({ settings, setSettings, w, expRet, portRisk, recommendedInvest, investMonthly, projYears, setProjYears, projection, finalVal, passiveMonthly, avgExpense, emergencyTarget }) {
  const risk = settings.riskTolerance;
  const overTarget = portRisk > 20;
  const sortedAssets = Object.keys(w).sort((a, b) => w[b] - w[a]);

  return (
    <>
      <div className="card">
        <div className="card-title">ระดับความเสี่ยงที่รับได้</div>
        <div className="risk-row">
          <input
            type="range" min="5" max="25" value={risk}
            onChange={(e) => setSettings({ ...settings, riskTolerance: parseInt(e.target.value) })}
          />
          <span className="risk-num">{risk}%</span>
        </div>
        <div className="risk-stats">
          <Stat label="ผลตอบแทนคาดหวัง/ปี" value={expRet.toFixed(1) + "%"} color={PALETTE.income} />
          <Stat
            label="ความผันผวนพอร์ต (ประมาณ)"
            value={portRisk.toFixed(1) + "%"}
            color={overTarget ? PALETTE.expense : PALETTE.ink}
            sub={overTarget ? "เกินเพดาน 20% ที่ตั้งไว้" : "อยู่ในเพดาน 20%"}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">พอร์ตที่แนะนำ</div>
        {sortedAssets.map((k) => (
          <div className="asset-row" key={k}>
            <div className="asset-head">
              <span className="asset-name">{ASSETS[k].label}</span>
              <span className="asset-pct">{w[k].toFixed(0)}%</span>
            </div>
            <Bar pct={w[k]} color={ASSETS[k].color} />
            <div className="asset-vehicle">{ASSETS[k].vehicle}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">ลงทุนสม่ำเสมอ (DCA)</div>
        <div className="invest-amt">
          <span>ลงทุนต่อเดือน</span>
          <div className="income-edit small">
            <span>฿</span>
            <input
              type="number" value={investMonthly}
              onChange={(e) => setSettings({ ...settings, investOverride: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="muted-note">แนะนำเริ่มที่ ≈ {fmt(recommendedInvest)} (20% ของรายได้)</div>

        <div className="years-toggle">
          {[5, 10, 20, 30].map((y) => (
            <button key={y} className={projYears === y ? "active" : ""} onClick={() => setProjYears(y)}>
              {y} ปี
            </button>
          ))}
        </div>

        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={projection} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.income} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={PALETTE.income} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={PALETTE.hair} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: PALETTE.muted }} tickFormatter={(y) => y + "ปี"} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} tickFormatter={fmtK} width={48} />
              <Tooltip
                formatter={(v, n) => [fmt(v), n === "value" ? "มูลค่ารวม" : "เงินต้นสะสม"]}
                labelFormatter={(y) => "ปีที่ " + y}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${PALETTE.hair}` }}
              />
              <Area type="monotone" dataKey="contributed" stroke={PALETTE.muted} strokeDasharray="4 4" fill="none" />
              <Area type="monotone" dataKey="value" stroke={PALETTE.income} strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="proj-stats">
          <Stat label={`มูลค่าใน ${projYears} ปี`} value={fmt(finalVal.value)} color={PALETTE.income} />
          <Stat label="เงินต้นที่ใส่" value={fmt(finalVal.contributed)} />
          <Stat label="กำไรจากการลงทุน" value={fmt(finalVal.value - finalVal.contributed)} color={PALETTE.brass} />
        </div>
        <div className="passive">
          เมื่อถึงเป้า เงินก้อนนี้สร้างรายได้แบบ Passive ได้ ≈ <b>{fmt(passiveMonthly)}/เดือน</b> (ถอน 4%/ปี)
        </div>
      </div>

      <div className="card warn-card">
        <b>ก่อนเริ่มลงทุน</b> ควรมีกองทุนฉุกเฉิน ≈ {fmt(emergencyTarget)} (6 เท่าของรายจ่าย ≈ {fmt(avgExpense)}/เดือน)
        และปลดหนี้ดอกเบี้ยสูงก่อน เพื่อให้การลงทุนเดินหน้าได้โดยไม่ต้องถอนกลางทาง
      </div>
    </>
  );
}

/* ----------------------------- แท็บ: ตลาด (เรียลไทม์) ----------------------------- */

function Markets({ settings, setSettings }) {
  const key = settings.finnhubKey || "";
  const [keyInput, setKeyInput] = useState(key);
  const [quotes, setQuotes] = useState({});
  const [status, setStatus] = useState("idle");
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadAll = async () => {
    if (!key) return;
    setStatus("loading");
    try {
      const out = {};
      for (const a of MARKET_ASSETS) {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${a.sym}&token=${key}`);
        if (!r.ok) throw new Error("http");
        out[a.sym] = await r.json();
      }
      const valid = Object.values(out).some((q) => typeof q.c === "number" && q.c > 0);
      if (!valid) throw new Error("empty");
      setQuotes(out);
      setUpdatedAt(new Date());
      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (key) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) {
    return (
      <div className="card">
        <div className="card-title">เชื่อมต่อข้อมูลตลาดเรียลไทม์</div>
        <p className="md-intro">
          ดูราคาตลาดแบบเรียลไทม์ของสินทรัพย์ในพอร์ตของคุณ ใช้ได้ฟรีผ่าน Finnhub
          เพียงสมัครรับคีย์ฟรี ใช้เวลาประมาณ 1 นาที
        </p>
        <ol className="md-steps">
          <li>เปิดเว็บ <b>finnhub.io</b> แล้วกด Get free API key สมัครด้วยอีเมล</li>
          <li>คัดลอก API key ที่ได้</li>
          <li>วางในช่องด้านล่าง แล้วกดบันทึก</li>
        </ol>
        <div className="md-key-row">
          <input type="text" placeholder="วาง API key ที่นี่" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <button className="btn-primary" onClick={() => setSettings({ ...settings, finnhubKey: keyInput.trim() })}>บันทึก</button>
        </div>
        <div className="muted-note">คีย์ถูกเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น ไม่ส่งไปที่อื่น</div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="md-head">
          <div className="card-title" style={{ margin: 0 }}>ตลาดวันนี้</div>
          <button className="md-refresh" onClick={loadAll} disabled={status === "loading"}>
            {status === "loading" ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
        </div>
        {status === "error" && (
          <div className="md-error">โหลดข้อมูลไม่ได้ — ตรวจสอบ API key หรือลองรีเฟรชอีกครั้ง</div>
        )}
        {MARKET_ASSETS.map((a) => {
          const q = quotes[a.sym] || {};
          const dp = q.dp;
          const up = dp >= 0;
          return (
            <div className="md-row" key={a.sym}>
              <div className="md-asset">
                <span className="md-label">{a.label}</span>
                <span className="md-note">{a.note}</span>
              </div>
              <div className="md-nums">
                {typeof dp !== "number" ? (
                  <span className="md-na">—</span>
                ) : (
                  <>
                    <span className="md-price">${Number(q.c).toFixed(2)}</span>
                    <span className="md-chg" style={{ color: up ? PALETTE.income : PALETTE.expense }}>
                      {up ? "▲" : "▼"} {Math.abs(dp).toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {updatedAt && (
          <div className="md-foot">
            <span className="muted-note">อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH")}</span>
            <button className="md-changekey" onClick={() => setSettings({ ...settings, finnhubKey: "" })}>เปลี่ยน API key</button>
          </div>
        )}
      </div>

      <div className="card md-guide">
        <div className="card-title">อ่านอย่างไรไม่ให้หลงทาง</div>
        <p>
          ตัวเลขสีเขียว/แดงคือการเคลื่อนไหว <b>รายวัน</b> เอาไว้ดูภาพรวมเฉย ๆ <b>ไม่ใช่สัญญาณให้ซื้อหรือขาย</b>
          สำหรับมนุษย์เงินเดือน สิ่งที่สร้างความมั่งคั่งจริงคือการลงทุนสม่ำเสมอทุกเดือน (DCA)
          ไม่ว่าวันนั้นตลาดจะแดงหรือเขียว
        </p>
        <p className="muted-note">
          “เวลาอยู่ในตลาด” สำคัญกว่า “การจับจังหวะตลาด” — การพยายามเดาว่าวันไหนตัวไหนจะขึ้น
          คือสิ่งที่แม้แต่มืออาชีพยังพลาดบ่อย และมักทำให้ผลตอบแทนระยะยาวแย่ลง
        </p>
      </div>
    </>
  );
}

/* ----------------------------- CSS ----------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&display=swap');

.root{
  --paper:${PALETTE.paper};--card:${PALETTE.card};--ink:${PALETTE.ink};--brand:${PALETTE.brand};
  --brass:${PALETTE.brass};--income:${PALETTE.income};--expense:${PALETTE.expense};--muted:${PALETTE.muted};--hair:${PALETTE.hair};
  background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans Thai',sans-serif;
  max-width:760px;margin:0 auto;padding:18px 16px 40px;font-size:15px;line-height:1.5;min-height:100vh;
}
.root *{box-sizing:border-box}
.root input,.root select,.root button{font-family:inherit}

.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:1px solid var(--hair)}
.brand-mark{font-family:'Noto Serif Thai',serif;font-weight:700;font-size:26px;color:var(--brand);letter-spacing:-.5px}
.brand-sub{font-size:12.5px;color:var(--muted);letter-spacing:.5px}
.hdr-net{display:flex;flex-direction:column;align-items:flex-end}
.hdr-net-label{font-size:11px;color:var(--muted)}
.hdr-net-val{font-family:'Noto Serif Thai',serif;font-weight:700;font-size:22px;font-variant-numeric:tabular-nums}

.tabs{display:flex;gap:4px;margin:16px 0;background:#EBE8DF;padding:4px;border-radius:12px}
.tab{flex:1;border:none;background:none;padding:9px 4px;border-radius:9px;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;transition:.15s}
.tab.active{background:var(--card);color:var(--brand);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.06)}

.main{display:flex;flex-direction:column;gap:14px}

.card{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:16px}
.card-title{font-weight:600;font-size:14px;margin-bottom:12px;color:var(--brand)}

.stat{display:flex;flex-direction:column;gap:2px}
.stat-label{font-size:12px;color:var(--muted)}
.stat-value{font-family:'Noto Serif Thai',serif;font-weight:600;font-size:20px;font-variant-numeric:tabular-nums}
.stat-sub{font-size:11px;color:var(--muted)}

.bar-track{height:8px;background:#EBE8DF;border-radius:99px;overflow:hidden;margin:6px 0}
.bar-fill{height:100%;border-radius:99px;transition:width .4s}

.month-nav{display:flex;justify-content:center;align-items:center;gap:18px;font-weight:600;color:var(--brand)}
.month-nav button{border:1px solid var(--hair);background:var(--card);width:32px;height:32px;border-radius:99px;font-size:18px;cursor:pointer;color:var(--brand)}

.hero-card{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:18px}
.hero-row{display:flex;align-items:center}
.hero-row .stat{flex:1}
.hero-divider{width:1px;height:38px;background:var(--hair);margin:0 16px}
.hero-net{display:flex;justify-content:space-between;align-items:baseline;margin:16px 0 14px;padding-top:14px;border-top:1px dashed var(--hair)}
.hero-net span:first-child{color:var(--muted);font-size:14px}
.hero-net span:last-child{font-family:'Noto Serif Thai',serif;font-weight:700;font-size:26px;font-variant-numeric:tabular-nums}
.hero-rate{display:flex;align-items:center;gap:10px}
.hero-rate>span:first-child{font-size:13px;color:var(--muted);white-space:nowrap}
.hero-rate .bar-track{flex:1;margin:0}
.rate-num{font-weight:600;font-variant-numeric:tabular-nums}
.hero-hint{margin-top:12px;font-size:13px;color:var(--brand);background:#EEF2EC;padding:10px 12px;border-radius:9px}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.priority{margin:0;padding-left:20px;font-size:13.5px}
.priority li{margin-bottom:8px}
.tips{margin:0;padding-left:18px;font-size:13.5px}
.tips li{margin-bottom:7px}
.muted-note{font-size:12.5px;color:var(--muted);margin-top:10px}
.muted{color:var(--muted)}

.form-card .type-toggle{display:flex;gap:6px;margin-bottom:14px}
.type-toggle button{flex:1;padding:9px;border:1px solid var(--hair);background:var(--paper);border-radius:9px;font-weight:600;color:var(--muted);cursor:pointer}
.type-toggle button.active.exp{background:var(--expense);color:#fff;border-color:var(--expense)}
.type-toggle button.active.inc{background:var(--income);color:#fff;border-color:var(--income)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form-grid label{display:flex;flex-direction:column;font-size:12px;color:var(--muted);gap:4px}
.form-grid input,.form-grid select{padding:9px;border:1px solid var(--hair);border-radius:9px;font-size:15px;background:#fff;color:var(--ink)}
.btn-primary{width:100%;margin-top:12px;padding:11px;background:var(--brand);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer}
.btn-primary:hover{opacity:.92}

.list-card{padding:6px 8px}
.empty{padding:28px 12px;text-align:center;color:var(--muted);font-size:14px}
.txn{display:flex;align-items:center;gap:10px;padding:11px 8px;border-bottom:1px solid var(--hair)}
.txn:last-child{border-bottom:none}
.txn-main{flex:1;display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;min-width:0}
.txn-cat{font-weight:500}
.txn-note{font-size:12.5px;color:var(--muted)}
.txn-date{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.txn-amt{font-family:'Noto Serif Thai',serif;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.txn-del{border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:4px}
.txn-del:hover{color:var(--expense)}

.income-edit{display:flex;align-items:center;gap:6px;font-family:'Noto Serif Thai',serif;font-size:24px;font-weight:600}
.income-edit input{border:none;border-bottom:2px solid var(--hair);background:none;font:inherit;width:140px;color:var(--ink);padding:2px 0}
.income-edit input:focus{outline:none;border-color:var(--brand)}
.income-edit.small{font-size:20px}
.income-edit.small input{width:110px}

.budget-row{margin-bottom:14px}
.budget-head{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:2px}
.budget-nums{font-variant-numeric:tabular-nums}

.risk-row{display:flex;align-items:center;gap:14px}
.risk-row input[type=range]{flex:1;accent-color:var(--brand)}
.risk-num{font-family:'Noto Serif Thai',serif;font-weight:700;font-size:22px;color:var(--brand);width:54px;text-align:right}
.risk-stats{display:flex;gap:24px;margin-top:14px}

.asset-row{margin-bottom:14px}
.asset-head{display:flex;justify-content:space-between;font-size:14px;font-weight:500}
.asset-pct{font-variant-numeric:tabular-nums;font-weight:600}
.asset-vehicle{font-size:12px;color:var(--muted);margin-top:3px}

.invest-amt{display:flex;justify-content:space-between;align-items:center}
.invest-amt>span{font-size:14px;color:var(--muted)}
.years-toggle{display:flex;gap:6px;margin:14px 0}
.years-toggle button{flex:1;padding:8px;border:1px solid var(--hair);background:var(--paper);border-radius:8px;font-weight:500;color:var(--muted);cursor:pointer}
.years-toggle button.active{background:var(--brand);color:#fff;border-color:var(--brand)}
.chart-wrap{margin:6px -6px}
.proj-stats{display:flex;justify-content:space-between;gap:12px;margin-top:8px}
.proj-stats .stat-value{font-size:17px}
.passive{margin-top:14px;font-size:13px;background:#F3EEE2;color:#6b5a2d;padding:10px 12px;border-radius:9px}

.warn-card{background:#FBF1EE;border-color:#E8CFC7;font-size:13px;color:#7a3f31}

.md-intro{font-size:13.5px;margin:0 0 12px}
.md-steps{margin:0 0 14px;padding-left:20px;font-size:13.5px}
.md-steps li{margin-bottom:6px}
.md-key-row{display:flex;gap:8px}
.md-key-row input{flex:1;padding:10px;border:1px solid var(--hair);border-radius:9px;font-size:14px;background:#fff;color:var(--ink)}
.md-key-row .btn-primary{width:auto;margin:0;padding:10px 18px}
.md-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.md-refresh{border:1px solid var(--hair);background:var(--paper);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;color:var(--brand);cursor:pointer}
.md-refresh:disabled{opacity:.5;cursor:default}
.md-error{background:#FBF1EE;color:#7a3f31;font-size:13px;padding:9px 12px;border-radius:8px;margin-bottom:10px}
.md-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--hair)}
.md-row:last-of-type{border-bottom:none}
.md-asset{display:flex;flex-direction:column;gap:2px}
.md-label{font-weight:600;font-size:14.5px}
.md-note{font-size:11.5px;color:var(--muted)}
.md-nums{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.md-price{font-family:'Noto Serif Thai',serif;font-weight:600;font-variant-numeric:tabular-nums;font-size:16px}
.md-chg{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.md-na{color:var(--muted);font-size:18px}
.md-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.md-foot .muted-note{margin:0}
.md-changekey{border:none;background:none;color:var(--brand);font-size:12px;cursor:pointer;text-decoration:underline;padding:0}
.md-guide p{font-size:13.5px;margin:0 0 10px;line-height:1.6}
.md-guide p:last-child{margin-bottom:0}

.ftr{margin-top:22px;padding-top:14px;border-top:1px solid var(--hair);font-size:11.5px;color:var(--muted);line-height:1.5;text-align:center}
`;
