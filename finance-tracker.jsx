import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import _ from "lodash";

// ═══════════════════════════════════════════════════════════════
// CREDIT CARD DATABASE — Singapore Cards (2025 verified rates)
// ═══════════════════════════════════════════════════════════════
const CARDS = {
  "DBS Live Fresh": { bank: "DBS", type: "cashback", fee: 194, min: 600, rewards: { "Online Services": { r: 0.05, cap: 20 }, Entertainment: { r: 0.05, cap: 20 }, Dining: { r: 0.05, cap: 20 }, Shopping: { r: 0.05, cap: 20 }, _d: { r: 0.003 } } },
  "DBS Altitude": { bank: "DBS", type: "miles", fee: 193, min: 0, rewards: { Travel: { r: 3.0 }, _d: { r: 1.2 } } },
  "OCBC 365": { bank: "OCBC", type: "cashback", fee: 194, min: 800, rewards: { Dining: { r: 0.06, cap: 80 }, Groceries: { r: 0.03, cap: 80 }, Transport: { r: 0.03, cap: 80 }, Petrol: { r: 0.229, cap: 25 }, _d: { r: 0.003 } } },
  "UOB One": { bank: "UOB", type: "cashback", fee: 193, min: 500, note: "5 txns + salary credit to UOB", rewards: { _all: { r: 0.10, cap: 50 }, _d: { r: 0.003 } } },
  "UOB PRVI Miles": { bank: "UOB", type: "miles", fee: 257, min: 0, rewards: { Travel: { r: 2.4 }, Dining: { r: 2.4 }, _d: { r: 1.4 } } },
  "Citi Cash Back+": { bank: "Citi", type: "cashback", fee: 194, min: 800, rewards: { Dining: { r: 0.08, cap: 25 }, Groceries: { r: 0.08, cap: 25 }, Petrol: { r: 0.08, cap: 25 }, _d: { r: 0.003 } } },
  "HSBC Revolution": { bank: "HSBC", type: "cashback", fee: 0, min: 0, rewards: { Dining: { r: 0.04 }, "Online Services": { r: 0.04 }, Entertainment: { r: 0.04 }, _d: { r: 0.003 } } },
  "AMEX True Cashback": { bank: "AMEX", type: "cashback", fee: 0, min: 0, rewards: { _all: { r: 0.015 }, _d: { r: 0.015 } } },
  "SC Simply Cash": { bank: "SC", type: "cashback", fee: 193, min: 0, rewards: { Dining: { r: 0.06, cap: 60 }, Groceries: { r: 0.06, cap: 60 }, Petrol: { r: 0.06, cap: 60 }, _d: { r: 0.015 } } },
};

// ═══════════════════════════════════════════════════════════════
// CATEGORY STYLING
// ═══════════════════════════════════════════════════════════════
const CAT_CFG = {
  Dining:                    { col: "#FF6B6B", ico: "🍽️" },
  Groceries:                 { col: "#51CF66", ico: "🛒" },
  Transport:                 { col: "#339AF0", ico: "🚗" },
  Shopping:                  { col: "#F06595", ico: "🛍️" },
  Entertainment:             { col: "#845EF7", ico: "🎬" },
  Fitness:                   { col: "#20C997", ico: "💪" },
  Healthcare:                { col: "#FF8787", ico: "🏥" },
  Insurance:                 { col: "#868E96", ico: "🛡️" },
  Utilities:                 { col: "#22B8CF", ico: "⚡" },
  Travel:                    { col: "#FCC419", ico: "✈️" },
  Petrol:                    { col: "#94D82D", ico: "⛽" },
  "Online Services":         { col: "#BE4BDB", ico: "💻" },
  "Bills & Payments":        { col: "#ADB5BD", ico: "📄" },
  Transfers:                 { col: "#74C0FC", ico: "🔄" },
  Education:                 { col: "#4DABF7", ico: "📚" },
  Government:                { col: "#FA5252", ico: "🏛️" },
  "Advertising & Marketing": { col: "#E599F7", ico: "📢" },
  "Income & Refunds":        { col: "#69DB7C", ico: "💰" },
  "ATM Cash":                { col: "#FFD43B", ico: "🏧" },
  Others:                    { col: "#868E96", ico: "📦" },
};
const gc = (c) => CAT_CFG[c]?.col || "#868E96";
const gi = (c) => CAT_CFG[c]?.ico || "•";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw) ? null : raw;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseTxns(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).map((r) => {
    const date = parseDate(r[0]), amount = parseFloat(r[4]);
    if (!date || isNaN(amount) || amount <= 0) return null;
    return {
      date, bank: r[1] || "", card: r[2] || "", merchant: r[3] || "Unknown",
      amount, category: r[5] || "Others", notes: r[7] || "",
      currency: r[9] || "SGD",
      type: r[10] || (r[5] === "Income & Refunds" ? "income" : "spending"),
    };
  }).filter(Boolean);
}

function detectLeakages(txns, income) {
  const sp = txns.filter((t) => t.type !== "income");
  const out = [];
  const mc = _.countBy(sp, "merchant");
  Object.entries(mc).filter(([, c]) => c >= 3).forEach(([m, c]) => {
    const tot = _.sumBy(sp.filter((t) => t.merchant === m), "amount"), avg = tot / c;
    if (avg < 50 && tot > 30) out.push({ sev: tot > 100 ? "high" : "med", title: `Recurring: ${m}`, desc: `${c} transactions avg $${avg.toFixed(2)}, total $${tot.toFixed(2)}. Review this subscription.`, amt: tot });
  });
  const disc = ["Dining", "Entertainment", "Shopping", "Online Services"];
  const discTot = _.sumBy(sp.filter((t) => disc.includes(t.category)), "amount");
  if (income > 0 && discTot / income > 0.3) out.push({ sev: "high", title: "Discretionary > 30% of income", desc: `$${discTot.toFixed(0)} on non-essentials (${((discTot / income) * 100).toFixed(0)}% of income).`, amt: discTot });
  const din = sp.filter((t) => t.category === "Dining");
  if (din.length > 20) { const t = _.sumBy(din, "amount"); out.push({ sev: "med", title: `Dining out ${din.length}× this period`, desc: `$${t.toFixed(0)} total. Cooking 5 more meals could save ~$${(t * 0.25).toFixed(0)}.`, amt: t * 0.25 }); }
  const fx = sp.filter((t) => t.currency && t.currency !== "SGD");
  if (fx.length) { const t = _.sumBy(fx, "amount"), f = t * 0.035; out.push({ sev: "med", title: `${fx.length} foreign currency txns`, desc: `~$${f.toFixed(0)} in fees. Use multi-currency card (Wise, YouTrip).`, amt: f }); }
  return _.orderBy(out, "amt", "desc");
}

function recCards(cats, total) {
  return _.orderBy(Object.entries(CARDS).map(([name, c]) => {
    let val = 0; const bens = [];
    Object.entries(cats).forEach(([cat, amt]) => {
      const rw = c.rewards[cat] || c.rewards._all || c.rewards._d;
      if (!rw) return;
      if (c.type === "cashback") { let e = amt * rw.r; if (rw.cap) e = Math.min(e, rw.cap); val += e; if (rw.r >= 0.03) bens.push(`${gi(cat)} ${cat}: ${(rw.r * 100).toFixed(0)}% → $${e.toFixed(2)}`); }
      else { const mi = amt * rw.r, dv = mi * 0.018; val += dv; if (rw.r >= 1.5) bens.push(`${gi(cat)} ${cat}: ${rw.r} mpd → ${mi.toFixed(0)} mi`); }
    });
    return { name, bank: c.bank, type: c.type, val, net: val - c.fee / 12, fee: c.fee, min: c.min, ok: !c.min || total >= c.min, bens: bens.slice(0, 5), note: c.note };
  }), "net", "desc").slice(0, 5);
}

function genDemo() {
  const now = new Date();
  const items = [
    ["Din Tai Fung", "Dining", 45.8], ["NTUC FairPrice", "Groceries", 67.3], ["Grab", "Transport", 12.5],
    ["Netflix", "Entertainment", 15.98], ["Starbucks", "Dining", 8.9], ["Shell", "Petrol", 85],
    ["Guardian", "Healthcare", 23.4], ["Shopee", "Shopping", 34.5], ["SP Services", "Utilities", 120],
    ["Singtel", "Utilities", 45], ["Klook", "Travel", 250], ["ActiveSG", "Fitness", 2.5],
    ["AIA", "Insurance", 180], ["McDonald's", "Dining", 9.5], ["Cold Storage", "Groceries", 55.2],
    ["Spotify", "Entertainment", 9.99], ["Grab", "Transport", 15.3], ["Toast Box", "Dining", 6.8],
    ["Amazon", "Shopping", 42], ["Comfort Taxi", "Transport", 18],
    ["Salary Credit", "Income & Refunds", 5200], ["Shopee Refund", "Income & Refunds", 15],
    ["Starbucks", "Dining", 7.5], ["Starbucks", "Dining", 8.2], ["Adobe", "Online Services", 28],
    ["Crystal Jade", "Dining", 38], ["NTUC FairPrice", "Groceries", 82.1], ["OCBC ATM", "ATM Cash", 200],
  ];
  return items.map(([m, c, a], i) => {
    const d = new Date(now); d.setDate(d.getDate() - Math.floor(i * 1.1));
    return { date: d, bank: ["DBS", "UOB", "OCBC"][i % 3], card: ["3115", "0076", "4949"][i % 3], merchant: m, amount: a, category: c, notes: "", currency: "SGD", type: c === "Income & Refunds" ? "income" : "spending" };
  });
}

const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));
const fmtD = (n) => n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ═══════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#162032", border: "1px solid #243247", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontSize: 11, color: "#5A6B80", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
          {p.name}: ${fmtD(p.value)}
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: "#162032", border: "1px solid #243247", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontSize: 13, color: d.payload.fill, fontWeight: 600 }}>{d.name}</div>
      <div style={{ fontSize: 12, color: "#8A9BB5" }}>${fmtD(d.value)}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sid, setSid] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showSetup, setShowSetup] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("mtd");
  const [selMonth, setSelMonth] = useState(new Date().getMonth());

  // Load saved credentials
  useEffect(() => {
    (async () => {
      try {
        const a = await window.storage.get("ft_sid");
        const b = await window.storage.get("ft_key");
        if (a?.value && b?.value) { setSid(a.value); setApiKey(b.value); setShowSetup(false); }
      } catch (e) { /* no saved creds */ }
    })();
  }, []);

  useEffect(() => { if (sid && apiKey && !showSetup) fetchData(); }, [sid, apiKey, showSetup]);

  const saveConnect = async () => {
    if (!sid.trim() || !apiKey.trim()) { setErr("Both fields required"); return; }
    try { await window.storage.set("ft_sid", sid.trim()); await window.storage.set("ft_key", apiKey.trim()); } catch (e) { }
    setShowSetup(false); setIsDemo(false); setErr(""); fetchData();
  };

  const fetchData = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/Transactions?key=${apiKey}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.values) { setTxns(parseTxns(d.values)); setConnected(true); }
      else setErr("No data found in Transactions sheet");
    } catch (e) { setErr(`Failed to connect: ${e.message}`); setConnected(false); }
    setLoading(false);
  };

  const startDemo = () => { setTxns(genDemo()); setIsDemo(true); setShowSetup(false); setConnected(true); };

  // ── Filtered data ──
  const filtered = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    if (period === "mtd") return txns.filter((t) => t.date.getMonth() === m && t.date.getFullYear() === y);
    if (period === "ytd") return txns.filter((t) => t.date.getFullYear() === y);
    if (period === "month") return txns.filter((t) => t.date.getMonth() === selMonth && t.date.getFullYear() === y);
    return txns;
  }, [txns, period, selMonth]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const sp = filtered.filter((t) => t.type !== "income");
    const inc = filtered.filter((t) => t.type === "income");
    const totalSp = _.sumBy(sp, "amount"), totalInc = _.sumBy(inc, "amount");
    const cats = {};
    sp.forEach((t) => { cats[t.category] = (cats[t.category] || 0) + t.amount; });
    const byMonth = _.groupBy(filtered, (t) => `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`);
    const trend = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, items]) => ({
      month: MONTHS[parseInt(m.split("-")[1]) - 1] || m.slice(5),
      Income: _.sumBy(items.filter((i) => i.type === "income"), "amount"),
      Expenses: _.sumBy(items.filter((i) => i.type !== "income"), "amount"),
    }));
    const byBank = {};
    sp.forEach((t) => { byBank[t.bank] = (byBank[t.bank] || 0) + t.amount; });
    // Daily spending last 14 days
    const daily = [];
    const last14 = sp.filter((t) => t.date >= new Date(Date.now() - 14 * 864e5));
    const byDay = _.groupBy(last14, (t) => t.date.toISOString().slice(0, 10));
    for (let i = 13; i >= 0; i--) {
      const dd = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      daily.push({ d: dd.slice(8) + "/" + dd.slice(5, 7), a: _.sumBy(byDay[dd] || [], "amount") });
    }
    return { totalSp, totalInc, net: totalInc - totalSp, spCnt: sp.length, incCnt: inc.length, cats, trend, byBank, daily, avg: sp.length ? totalSp / sp.length : 0 };
  }, [filtered]);

  const leaks = useMemo(() => detectLeakages(filtered, stats.totalInc || 5000), [filtered, stats.totalInc]);
  const recs = useMemo(() => recCards(stats.cats, stats.totalSp), [stats.cats, stats.totalSp]);
  const sortedCats = useMemo(() => Object.entries(stats.cats).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0), [stats.cats]);

  // ── Budget progress (income goal if income exists) ──
  const budgetPct = stats.totalInc > 0 ? Math.min(100, (stats.totalSp / stats.totalInc) * 100) : 0;

  // ═══════════════════════════════════════════════════════
  //  SETUP SCREEN
  // ═══════════════════════════════════════════════════════
  if (showSetup) return (
    <div style={st.page}>
      <style>{cssAnim}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontSize: 48, marginBottom: 12, animation: "fadeUp .5s ease" }}>📊</div>
          <h1 style={{ ...st.h1, fontSize: 32 }}>Finance Tracker</h1>
          <p style={{ ...st.muted, marginTop: 8 }}>Connect your Google Sheets to visualise your spending</p>
        </div>
        <div style={{ ...st.card, animation: "fadeUp .6s ease .1s both" }}>
          {err && <div style={st.errBox}>{err}</div>}
          <label style={st.label}>Google Sheet ID</label>
          <input style={st.input} placeholder="e.g. 1BxiMVs0XRA..." value={sid} onChange={(e) => setSid(e.target.value)} />
          <label style={{ ...st.label, marginTop: 18 }}>API Key</label>
          <input style={st.input} type="password" placeholder="AIza..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            <button style={st.btnPrimary} onClick={saveConnect}>Connect</button>
            <button style={st.btnGhost} onClick={startDemo}>Try Demo</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  //  MAIN LAYOUT
  // ═══════════════════════════════════════════════════════
  const curTab = tab;
  return (
    <div style={st.page}>
      <style>{cssAnim}</style>

      {/* ── TOP NAV ── */}
      <header style={st.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="14" width="5" height="12" rx="1.5" fill="#FF6B6B" /><rect x="9" y="8" width="5" height="18" rx="1.5" fill="#FCC419" /><rect x="16" y="4" width="5" height="22" rx="1.5" fill="#51CF66" /><rect x="23" y="10" width="5" height="16" rx="1.5" fill="#339AF0" opacity=".3" /></svg>
          <span style={st.logoText}>Finance Tracker</span>
          {isDemo && <span style={st.demoBadge}>DEMO</span>}
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          {[["overview", "Dashboard"], ["leakages", `Leakages`], ["cards", "Cards"], ["txns", "Transactions"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...st.navBtn, ...(curTab === id ? st.navBtnActive : {}) }}>
              {id === "leakages" && leaks.length > 0 && <span style={st.navDot} />}
              {label}
            </button>
          ))}
          <div style={st.navDivider} />
          {!isDemo && <button style={st.iconBtn} onClick={fetchData} title="Refresh">↻</button>}
          <button style={st.iconBtn} onClick={() => { setShowSetup(true); setIsDemo(false); }} title="Settings">⚙</button>
        </nav>
      </header>

      <div style={st.layout}>
        {/* ── MONTH SIDEBAR ── */}
        <aside style={st.sidebar}>
          {[["mtd", "MTD"], ["ytd", "YTD"], ["all", "All"]].map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{ ...st.sideBtn, ...(period === k ? st.sideBtnActive : {}) }}>{l}</button>
          ))}
          <div style={st.sideLine} />
          {MONTHS.map((m, i) => (
            <button key={m} onClick={() => { setPeriod("month"); setSelMonth(i); }} style={{
              ...st.monthBtn,
              ...(period === "month" && selMonth === i ? st.monthBtnActive : {}),
              ...(i === new Date().getMonth() && period !== "month" ? { color: "#51CF66" } : {}),
            }}>{m}</button>
          ))}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={st.main}>
          {loading && <div style={st.loadWrap}><div style={st.loader} />Fetching data...</div>}
          {err && !loading && <div style={st.errBox}>{err}</div>}

          {/* ═══════ OVERVIEW TAB ═══════ */}
          {!loading && curTab === "overview" && filtered.length > 0 && (
            <div style={{ animation: "fadeUp .4s ease" }}>
              {/* KPI Cards */}
              <div style={st.kpiGrid}>
                <div style={{ ...st.kpiCard, background: "linear-gradient(135deg, #FF6B6B 0%, #ee5a24 100%)" }}>
                  <div style={st.kpiLabel}>Total Spending</div>
                  <div style={st.kpiValue}>${fmtD(stats.totalSp)}</div>
                  <div style={st.kpiSub}>{stats.spCnt} transactions</div>
                </div>
                <div style={st.kpiCard}>
                  <div style={st.kpiLabel}>Income</div>
                  <div style={{ ...st.kpiValue, color: "#51CF66" }}>${fmtD(stats.totalInc)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, stats.totalInc > 0 ? 100 : 0)}%`, height: "100%", background: "#51CF66", borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
                <div style={st.kpiCard}>
                  <div style={st.kpiLabel}>Net Cashflow</div>
                  <div style={{ ...st.kpiValue, color: stats.net >= 0 ? "#51CF66" : "#FF6B6B" }}>{stats.net >= 0 ? "+" : ""}${fmtD(Math.abs(stats.net))}</div>
                  <div style={st.kpiSub}>{stats.net >= 0 ? "Surplus" : "Deficit"}</div>
                </div>
                <div style={st.kpiCard}>
                  <div style={st.kpiLabel}>Budget Used</div>
                  <div style={{ ...st.kpiValue, color: budgetPct > 80 ? "#FF6B6B" : budgetPct > 60 ? "#FCC419" : "#51CF66" }}>{budgetPct.toFixed(0)}%</div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${budgetPct}%`, height: "100%", borderRadius: 3, background: budgetPct > 80 ? "linear-gradient(90deg,#FCC419,#FF6B6B)" : "linear-gradient(90deg,#51CF66,#20C997)", transition: "width .6s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#5A6B80", marginTop: 4 }}>${fmtD(stats.totalSp)} / ${fmtD(stats.totalInc)}</div>
                  </div>
                </div>
              </div>

              {/* Middle row: Donut + Spendings List + Daily */}
              <div style={st.midGrid}>
                {/* Donut */}
                <div style={st.card}>
                  <h3 style={st.cardH}>Spending Breakdown</h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sortedCats.map(([n, v]) => ({ name: n, value: v }))} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none" animationDuration={800}>
                          {sortedCats.map(([c], i) => <Cell key={i} fill={gc(c)} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category list */}
                <div style={st.card}>
                  <h3 style={st.cardH}>Categories</h3>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {sortedCats.map(([c, v]) => {
                      const pct = stats.totalSp > 0 ? (v / stats.totalSp) * 100 : 0;
                      return (
                        <div key={c} style={st.catRow}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${gc(c)}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{gi(c)}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#CBD5E1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c}</div>
                              <div style={{ fontSize: 10, color: "#5A6B80" }}>{pct.toFixed(0)}%</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>${fmtK(v)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily chart */}
                <div style={st.card}>
                  <h3 style={st.cardH}>Daily Spending</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.daily} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B2A3D" vertical={false} />
                      <XAxis dataKey="d" tick={{ fill: "#5A6B80", fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={{ fill: "#5A6B80", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="a" name="Spent" fill="#339AF0" radius={[3, 3, 0, 0]} animationDuration={600} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Tracking */}
              <div style={st.card}>
                <h3 style={st.cardH}>Monthly Tracking — Income & Expenses</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.trend} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2A3D" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#5A6B80", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#5A6B80", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: "#8A9BB5" }}>{v}</span>} />
                    <Bar dataKey="Income" fill="#51CF66" radius={[4, 4, 0, 0]} barSize={32} animationDuration={700} />
                    <Bar dataKey="Expenses" fill="#FF6B6B" radius={[4, 4, 0, 0]} barSize={32} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Merchants */}
              <div style={st.card}>
                <h3 style={st.cardH}>Top Merchants</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {(() => {
                    const sp = filtered.filter((t) => t.type !== "income");
                    return Object.entries(_.groupBy(sp, "merchant")).map(([m, ts]) => ({ m, t: _.sumBy(ts, "amount"), c: ts.length })).sort((a, b) => b.t - a.t).slice(0, 8).map(({ m, t, c }, i) => (
                      <div key={m} style={{ ...st.merchantTile, animationDelay: `${i * .05}s` }}>
                        <div style={{ fontSize: 12, color: "#8A9BB5", fontWeight: 500, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>${fmtD(t)}</div>
                        <div style={{ fontSize: 10, color: "#5A6B80" }}>{c} txn{c > 1 ? "s" : ""}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ LEAKAGES TAB ═══════ */}
          {!loading && curTab === "leakages" && (
            <div style={{ animation: "fadeUp .4s ease" }}>
              <div style={{ marginBottom: 28 }}>
                <h2 style={st.secH}>Spending Leakages</h2>
                <p style={st.muted}>Patterns that may indicate wasted money</p>
              </div>
              {leaks.length === 0 ? (
                <div style={st.emptyState}><span style={{ fontSize: 40 }}>✅</span><br />No leakages detected</div>
              ) : (
                <>
                  <div style={st.saveBanner}>
                    Potential savings: <strong style={{ color: "#51CF66", fontSize: 18 }}>${_.sumBy(leaks, "amt").toFixed(2)}</strong>
                  </div>
                  {leaks.map((l, i) => (
                    <div key={i} style={{ ...st.leakItem, borderLeftColor: l.sev === "high" ? "#FF6B6B" : "#FCC419", animation: "fadeUp .4s ease", animationDelay: `${i * .06}s`, animationFillMode: "both" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ ...st.sevTag, background: l.sev === "high" ? "rgba(255,107,107,.12)" : "rgba(252,196,25,.12)", color: l.sev === "high" ? "#FF6B6B" : "#FCC419" }}>{l.sev === "high" ? "HIGH" : "MEDIUM"}</span>
                        <span style={{ fontSize: 12, color: "#5A6B80" }}>~${l.amt.toFixed(0)} impact</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>{l.title}</div>
                      <div style={{ fontSize: 13, color: "#8A9BB5", lineHeight: 1.6 }}>{l.desc}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ═══════ CARDS TAB ═══════ */}
          {!loading && curTab === "cards" && (
            <div style={{ animation: "fadeUp .4s ease" }}>
              <div style={{ marginBottom: 28 }}>
                <h2 style={st.secH}>Credit Card Optimiser</h2>
                <p style={st.muted}>Best cards for ${fmtD(stats.totalSp)} across {Object.keys(stats.cats).length} categories</p>
              </div>
              {recs.map((r, i) => (
                <div key={i} style={{ ...st.recItem, borderLeftColor: i === 0 ? "#FCC419" : i === 1 ? "#ADB5BD" : i === 2 ? "#CD7F32" : "#243247", animation: "fadeUp .4s ease", animationDelay: `${i * .06}s`, animationFillMode: "both" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? "#FCC419" : "#5A6B80" }}>#{i + 1}</span>
                        <span style={{ fontSize: 17, fontWeight: 700, color: "#E2E8F0" }}>{r.name}</span>
                        <span style={st.bankChip}>{r.bank}</span>
                      </div>
                      {r.note && <div style={{ fontSize: 11, color: "#FCC419", marginTop: 4, opacity: .8 }}>⚡ {r.note}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#51CF66", letterSpacing: "-0.5px" }}>${r.net.toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: "#5A6B80" }}>net / month</div>
                    </div>
                  </div>
                  {!r.ok && <div style={st.warnBanner}>⚠ Requires min. spend of ${r.min}/month</div>}
                  {r.bens.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: "1px solid #1B2A3D", paddingTop: 12 }}>
                      {r.bens.map((b, j) => <div key={j} style={{ fontSize: 12.5, color: "#8A9BB5", padding: "4px 0" }}>{b}</div>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "#5A6B80" }}>
                    <span>Fee: ${r.fee}/yr</span>
                    <span>{r.type === "cashback" ? "💵 Cashback" : "✈️ Miles"}</span>
                    <span>Gross: ${r.val.toFixed(2)}/mo</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════ TRANSACTIONS TAB ═══════ */}
          {!loading && curTab === "txns" && (
            <div style={{ animation: "fadeUp .4s ease" }}>
              <h2 style={st.secH}>Transactions ({filtered.length})</h2>
              <div style={st.tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Date", "Merchant", "Category", "Bank", "Amount", "Type"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.sort((a, b) => b.date - a.date).slice(0, 120).map((t, i) => (
                      <tr key={i} style={{ background: i % 2 ? "rgba(255,255,255,.015)" : "transparent" }}>
                        <td style={st.td}>{t.date.toLocaleDateString("en-SG", { day: "2-digit", month: "short" })}</td>
                        <td style={{ ...st.td, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</td>
                        <td style={st.td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${gc(t.category)}14`, color: gc(t.category) }}>{gi(t.category)} {t.category}</span>
                        </td>
                        <td style={st.td}>{t.bank}</td>
                        <td style={{ ...st.td, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.type === "income" ? "#51CF66" : "#FF6B6B" }}>
                          {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
                          {t.currency !== "SGD" && <span style={{ fontSize: 9, opacity: .5, marginLeft: 3 }}>{t.currency}</span>}
                        </td>
                        <td style={st.td}><span style={{ fontSize: 10, fontWeight: 600, color: t.type === "income" ? "#51CF66" : "#5A6B80", textTransform: "uppercase", letterSpacing: ".5px" }}>{t.type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && filtered.length === 0 && !showSetup && (
            <div style={st.emptyState}><span style={{ fontSize: 44 }}>📭</span><br />No transactions for this period</div>
          )}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════════════════
const cssAnim = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #243247; border-radius: 3px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const st = {
  page: { minHeight: "100vh", background: "#0C1220", color: "#E2E8F0", fontFamily: "'DM Sans', -apple-system, sans-serif" },
  h1: { fontSize: 28, fontWeight: 800, color: "#E2E8F0", margin: 0, letterSpacing: "-0.5px" },
  muted: { color: "#5A6B80", fontSize: 13 },

  // Header
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #1B2A3D", background: "rgba(12,18,32,.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap", gap: 12 },
  logoText: { fontSize: 17, fontWeight: 700, color: "#E2E8F0", letterSpacing: "-0.3px" },
  demoBadge: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: "rgba(252,196,25,.15)", color: "#FCC419", letterSpacing: ".5px" },
  navBtn: { position: "relative", padding: "7px 16px", background: "none", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#5A6B80", cursor: "pointer", transition: "all .15s" },
  navBtnActive: { background: "#162032", color: "#E2E8F0" },
  navDot: { position: "absolute", top: 6, right: 8, width: 5, height: 5, borderRadius: "50%", background: "#FF6B6B" },
  navDivider: { width: 1, height: 22, background: "#1B2A3D", margin: "0 6px" },
  iconBtn: { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#162032", border: "none", borderRadius: 8, color: "#5A6B80", fontSize: 14, cursor: "pointer" },

  // Layout
  layout: { display: "flex", minHeight: "calc(100vh - 56px)" },
  sidebar: { width: 60, borderRight: "1px solid #1B2A3D", padding: "16px 6px", display: "flex", flexDirection: "column", gap: 3, alignItems: "center", flexShrink: 0, background: "#0C1220" },
  main: { flex: 1, padding: "24px 28px", overflowY: "auto", maxWidth: 1280 },

  // Sidebar buttons
  sideBtn: { width: 48, padding: "6px 0", background: "none", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 800, color: "#5A6B80", cursor: "pointer", letterSpacing: ".4px" },
  sideBtnActive: { background: "#162032", color: "#51CF66" },
  sideLine: { width: 28, height: 1, background: "#1B2A3D", margin: "6px 0" },
  monthBtn: { width: 48, padding: "4px 0", background: "none", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#3D5068", cursor: "pointer" },
  monthBtnActive: { background: "#162032", color: "#51CF66", fontWeight: 700 },

  // Cards
  card: { background: "#111D2E", border: "1px solid #1B2A3D", borderRadius: 14, padding: 20, marginBottom: 14 },
  cardH: { fontSize: 11, fontWeight: 700, color: "#5A6B80", marginBottom: 14, textTransform: "uppercase", letterSpacing: "1px" },

  // KPI
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 14 },
  kpiCard: { background: "#111D2E", border: "1px solid #1B2A3D", borderRadius: 14, padding: "18px 20px" },
  kpiLabel: { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.45)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 },
  kpiValue: { fontSize: 24, fontWeight: 800, color: "#E2E8F0", letterSpacing: "-0.5px", lineHeight: 1 },
  kpiSub: { fontSize: 11, color: "#5A6B80", marginTop: 8 },

  // Mid grid (3 cols)
  midGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginBottom: 14 },

  // Category row
  catRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #1B2A3D" },

  // Merchant tile
  merchantTile: { background: "#0C1220", border: "1px solid #1B2A3D", borderRadius: 10, padding: "12px 14px", animation: "fadeUp .4s ease", animationFillMode: "both" },

  // Leakages
  secH: { fontSize: 22, fontWeight: 800, color: "#E2E8F0", letterSpacing: "-0.3px", marginBottom: 4 },
  saveBanner: { background: "rgba(81,207,102,.06)", border: "1px solid rgba(81,207,102,.12)", borderRadius: 10, padding: "14px 18px", marginBottom: 18, fontSize: 14, color: "#8A9BB5" },
  leakItem: { background: "#111D2E", border: "1px solid #1B2A3D", borderLeft: "4px solid #FF6B6B", borderRadius: 12, padding: "16px 20px", marginBottom: 10 },
  sevTag: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: ".6px" },

  // Card recs
  recItem: { background: "#111D2E", border: "1px solid #1B2A3D", borderLeft: "4px solid #FCC419", borderRadius: 12, padding: "18px 22px", marginBottom: 12 },
  bankChip: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,.05)", color: "#5A6B80", verticalAlign: "middle", marginLeft: 4 },
  warnBanner: { background: "rgba(252,196,25,.06)", border: "1px solid rgba(252,196,25,.12)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#FCC419", marginTop: 10 },

  // Table
  tableWrap: { overflowX: "auto", borderRadius: 12, border: "1px solid #1B2A3D", marginTop: 16 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 800, color: "#3D5068", textTransform: "uppercase", letterSpacing: "1px", background: "#0C1220", borderBottom: "1px solid #1B2A3D" },
  td: { padding: "10px 14px", fontSize: 12.5, color: "#8A9BB5", borderBottom: "1px solid rgba(27,42,61,.4)" },

  // States
  loadWrap: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 80, color: "#5A6B80", fontSize: 14 },
  loader: { width: 18, height: 18, border: "2px solid #1B2A3D", borderTopColor: "#339AF0", borderRadius: "50%", animation: "spin .7s linear infinite" },
  emptyState: { textAlign: "center", padding: "80px 20px", color: "#5A6B80", fontSize: 15, lineHeight: 2 },
  errBox: { background: "rgba(255,107,107,.06)", border: "1px solid rgba(255,107,107,.15)", borderRadius: 10, padding: "10px 16px", color: "#FF8787", fontSize: 13, marginBottom: 16 },

  // Setup form
  label: { display: "block", fontSize: 10, fontWeight: 800, color: "#5A6B80", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 },
  input: { width: "100%", padding: "12px 14px", background: "#0C1220", border: "1px solid #1B2A3D", borderRadius: 10, color: "#E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color .2s" },
  btnPrimary: { flex: 1, padding: "12px 24px", background: "linear-gradient(135deg,#339AF0,#228be6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  btnGhost: { flex: 1, padding: "12px 24px", background: "transparent", color: "#5A6B80", border: "1px solid #1B2A3D", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
