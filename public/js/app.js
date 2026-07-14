/* ============ Impress3D dashboard (vanilla SPA) ============ */
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const TOKEN_KEY = "i3d_token";
let TOKEN = localStorage.getItem(TOKEN_KEY) || "";

/* ---- Lucide-style inline icons ---- */
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21v.01M21 21v.01M17.5 17.5h.01M21 17.5h.01"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.51 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  spark: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0 0 20.5 15"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  bot: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M8 3h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  tag: '<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

/* ---- labels (tags), per country ---- */
const LABELS_BY_COUNTRY = {
  pt: [
    { name: "Projetos Novo", color: "#0ea5e9" },
    { name: "Orçamentos", color: "#f59e0b" },
    { name: "Filamentos", color: "#22c55e" },
  ],
  br: [
    { name: "Fornecedores", color: "#6366f1" },
    { name: "Projetos Novo", color: "#0ea5e9" },
    { name: "Notas fiscal", color: "#14b8a6" },
    { name: "Orça Arquivos", color: "#ec4899" },
    { name: "Orçamentos", color: "#f59e0b" },
    { name: "Cursos", color: "#8b5cf6" },
  ],
};
// Custom labels the user creates (like WhatsApp), discovered from existing conversations.
const customLabels = { pt: new Map(), br: new Map() };
function hashColor(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 62% 46%)`; }
function noteCustomLabels(chats) {
  let grew = false;
  for (const c of chats || []) {
    const cc = c.country; if (!cc || !customLabels[cc]) continue;
    const preset = new Set(LABELS_BY_COUNTRY[cc].map((l) => l.name));
    for (const name of c.labels || []) if (name && !preset.has(name) && !customLabels[cc].has(name)) { customLabels[cc].set(name, hashColor(name)); grew = true; }
  }
  return grew;
}
const customFor = (country) => (customLabels[country] ? [...customLabels[country]].map(([name, color]) => ({ name, color })) : []);
function allLabels() {
  const m = new Map();
  for (const c of ["pt", "br"]) for (const l of [...LABELS_BY_COUNTRY[c], ...customFor(c)]) if (!m.has(l.name)) m.set(l.name, l);
  return [...m.values()];
}
const labelsForCountry = (country) => (country ? [...(LABELS_BY_COUNTRY[country] || []), ...customFor(country)] : allLabels());
const labelColor = (name) => { for (const c of ["pt", "br"]) { const l = LABELS_BY_COUNTRY[c].find((x) => x.name === name); if (l) return l.color; if (customLabels[c].has(name)) return customLabels[c].get(name); } return "#64748b"; };
const labelChip = (name) => `<span class="lbl" style="--lc:${labelColor(name)}">${escapeHtml(name)}</span>`;
const ico = (name, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`;

/* ---- helpers ---- */
async function api(pathname, opts = {}) {
  const res = await fetch(pathname, {
    ...opts,
    headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error("unauthorized"); }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error(data.error || "erro"), { data });
  return data;
}
function toast(msg) {
  let t = $(".toast"); if (!t) { t = el("div", "toast"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600);
}
const initials = (s) => (s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const avatarColor = (s) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 62% 52%)`; };
function timeAgo(ts) {
  if (!ts) return "";
  const d = (Date.now() - new Date(ts)) / 1000;
  if (d < 60) return "agora"; if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`; return `${Math.floor(d / 86400)} d`;
}
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "");
function logout() { TOKEN = ""; localStorage.removeItem(TOKEN_KEY); location.hash = ""; renderLogin(); }

/* ---- theme ---- */
function initTheme() { const t = localStorage.getItem("i3d_theme") || "light"; document.documentElement.dataset.theme = t; }
function toggleTheme() { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; localStorage.setItem("i3d_theme", n); const b = $("#themeBtn"); if (b) b.innerHTML = ico(n === "dark" ? "sun" : "moon"); }

/* ================= LOGIN ================= */
function renderLogin() {
  document.body.innerHTML = "";
  const wrap = el("div", "login-wrap");
  wrap.innerHTML = `
    <form class="login-card" id="loginForm">
      <div class="login-logo">${ico("chat", "icon")}</div>
      <h1>Impress3D</h1>
      <p>Painel de Atendimento · WhatsApp IA</p>
      <div class="field"><label>Senha de acesso</label>
        <input class="input" type="password" id="pw" placeholder="••••••••" autocomplete="current-password" autofocus /></div>
      <button class="btn btn-primary block" type="submit">Entrar</button>
    </form>`;
  document.body.appendChild(wrap);
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = "A entrar…";
    try {
      const { token } = await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#pw").value }) });
      TOKEN = token; localStorage.setItem(TOKEN_KEY, token); location.hash = "#/"; renderApp();
    } catch (err) { toast(err.data?.error || "Senha incorreta"); btn.disabled = false; btn.textContent = "Entrar"; }
  });
}

/* ================= APP SHELL ================= */
const NAV = [
  { id: "", label: "Dashboard", icon: "grid" },
  { id: "conexao", label: "Conexão", icon: "qr" },
  { id: "pt", label: "🇵🇹 Portugal", icon: "chat" },
  { id: "br", label: "🇧🇷 Brasil", icon: "chat" },
  { id: "config", label: "Configurações", icon: "settings" },
];
const isConvHash = () => ["pt", "br"].includes((location.hash.replace(/^#\/?/, "") || "").split("/")[0]);
function renderApp() {
  initTheme();
  document.body.innerHTML = "";
  const shell = el("div", "shell");
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-badge">${ico("chat")}</div>
        <div><div class="brand-name">Impress3D</div><div class="brand-sub">Atendimento IA</div></div>
      </div>
      <div class="nav-label">Menu</div>
      <nav id="nav"></nav>
      <div class="nav-spacer"></div>
      <a class="nav-item" id="logoutBtn">${ico("logout")} Sair</a>
    </aside>
    <div class="scrim" id="scrim"></div>
    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" id="menuBtn">${ico("menu")}</button>
        <div><h2 id="pageTitle">Dashboard</h2><div class="sub" id="pageSub"></div></div>
        <div class="top-right">
          <button class="icon-btn" id="themeBtn">${ico(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
          <span class="badge" id="connBadge"><span class="dot"></span> …</span>
        </div>
      </header>
      <section class="content" id="view"></section>
    </main>`;
  document.body.appendChild(shell);
  const nav = $("#nav");
  NAV.forEach((n) => { const a = el("a", "nav-item", `${ico(n.icon)} ${n.label}`); a.dataset.id = n.id; a.href = `#/${n.id}`; nav.appendChild(a); });
  $("#logoutBtn").addEventListener("click", logout);
  $("#themeBtn").addEventListener("click", toggleTheme);
  $("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.toggle("open"); $("#scrim").classList.toggle("show"); });
  $("#scrim").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); });
  window.addEventListener("hashchange", route);
  refreshConnBadge();
  route();
}

async function refreshConnBadge() {
  const b = $("#connBadge"); if (!b) return;
  try {
    const c = await api("/api/connection");
    const map = { open: ["ok live", "Conectado"], connecting: ["warn", "A ligar…"], close: ["off", "Desconectado"], not_created: ["off", "Não configurado"] };
    const [cls, txt] = map[c.state] || ["off", c.state];
    b.className = `badge ${cls}`; b.innerHTML = `<span class="dot"></span> WhatsApp: ${txt}`;
  } catch { b.className = "badge off"; b.innerHTML = `<span class="dot"></span> WhatsApp: —`; }
}

/* ================= ROUTER ================= */
const TITLES = { "": ["Dashboard", "Visão geral do atendimento"], conexao: ["Conexão", "Ligar o WhatsApp por QR Code"], pt: ["🇵🇹 Portugal", "Conversas do número de Portugal"], br: ["🇧🇷 Brasil", "Conversas do número do Brasil"], config: ["Configurações", "Definições do assistente"] };
function route() {
  if (!TOKEN) return renderLogin();
  const id = (location.hash.replace(/^#\/?/, "") || "").split("/")[0];
  const [title, sub] = TITLES[id] || TITLES[""];
  $("#pageTitle").textContent = title; $("#pageSub").textContent = sub;
  document.querySelectorAll(".nav-item[data-id]").forEach((a) => a.classList.toggle("active", a.dataset.id === id));
  $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show");
  const v = $("#view"); v.innerHTML = `<div class="empty-state">${ico("refresh", "icon spin")}<div style="margin-top:8px">A carregar…</div></div>`;
  ({ "": pageDashboard, conexao: pageConexao, pt: (el) => pageConversas(el, "pt"), br: (el) => pageConversas(el, "br"), config: pageConfig }[id] || pageDashboard)(v);
}

/* ================= DASHBOARD ================= */
function kpi(tone, icon, val, label, trend) {
  return `<div class="kpi"><div class="kpi-ic tone-${tone}">${ico(icon)}</div>
    <div><div class="kpi-val">${val}</div><div class="kpi-lbl">${label}</div></div>
    ${trend ? `<div class="kpi-trend ${trend.cls}">${trend.txt}</div>` : ""}</div>`;
}
function lineChart(labels, series) {
  const w = 560, h = 200, pad = 26, max = Math.max(1, ...series);
  const step = (w - pad * 2) / Math.max(1, series.length - 1);
  const pts = series.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => `<line x1="${pad}" x2="${w - pad}" y1="${(pad + g * (h - pad * 2)).toFixed(1)}" y2="${(pad + g * (h - pad * 2)).toFixed(1)}" stroke="var(--border)" />`).join("");
  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"/>`).join("");
  const lbls = labels.map((l, i) => `<text x="${pad + i * step}" y="${h - 6}" text-anchor="middle" font-size="10" fill="var(--muted-2)">${l}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>${dots}${lbls}</svg>`;
}
function donut(a, b) {
  const total = Math.max(1, a + b), r = 52, c = 2 * Math.PI * r, seg = (a / total) * c;
  return `<svg width="130" height="130" viewBox="0 0 130 130"><g transform="translate(65,65)">
    <circle r="${r}" fill="none" stroke="var(--accent-soft)" stroke-width="16"/>
    <circle r="${r}" fill="none" stroke="var(--brand)" stroke-width="16" stroke-linecap="round"
      stroke-dasharray="${seg.toFixed(1)} ${(c - seg).toFixed(1)}" transform="rotate(-90)"/></g></svg>`;
}
async function pageDashboard(v) {
  try {
    const [s, chats, conn] = await Promise.all([api("/api/stats"), api("/api/chats"), api("/api/connection").catch(() => ({ state: "?" }))]);
    const health = conn.state === "open" ? 99 : conn.state === "connecting" ? 60 : 0;
    const logs = chats.slice(0, 6).map((c) => `
      <div class="log-row">
        <div class="avatar" style="background:${avatarColor(c.name || c.number)}">${initials(c.name || c.number)}</div>
        <div style="min-width:0"><div class="who">${c.name || c.number}</div><div class="msg">${(c.lastRole === "assistant" ? "🤖 " : "") + (c.lastMessage || "—")}</div></div>
        <div class="time">${ico("clock", "icon icon-sm")} ${timeAgo(c.lastTs)}</div>
      </div>`).join("") || `<div class="empty-state">${ico("chat")}<div>Ainda sem conversas.</div></div>`;
    v.innerHTML = `
      <div class="kpi-grid">
        ${kpi("green", "chat", s.totalQueries, "Mensagens recebidas", { cls: "trend-up", txt: "IA ativa" })}
        ${kpi("indigo", "users", s.totalUsers, "Clientes atendidos", { cls: "trend-flat", txt: `${s.activeToday} hoje` })}
        ${kpi("amber", "spark", s.successRate + "%", "Taxa de resposta", { cls: "trend-up", txt: "respostas/pedido" })}
        ${kpi("sky", "heart", health + "%", "Saúde do sistema", { cls: health ? "trend-up" : "trend-flat", txt: conn.state === "open" ? "online" : "verificar" })}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div>${ico("activity")}</div><div><h3>Mensagens por mês</h3><div class="sub">Últimos 12 meses</div></div>
            <div style="margin-left:auto" class="badge ok"><span class="dot"></span> ${s.totalQueries} total</div></div>
          ${lineChart(s.chart.labels, s.chart.series)}
        </div>
        <div class="card">
          <div class="card-head"><div>${ico("users")}</div><h3>Clientes</h3></div>
          <div class="donut-wrap"><div style="position:relative">${donut(s.newUsers, s.returning)}
            <div class="donut-center" style="position:absolute;inset:0;display:grid;place-items:center"><div><div class="big">${s.totalUsers}</div><div class="small">total</div></div></div></div>
            <div class="stack">
              <div class="legend-item"><span class="legend-swatch" style="background:var(--brand)"></span> Novos (30d): <b style="margin-left:4px">${s.newUsers}</b></div>
              <div class="legend-item"><span class="legend-swatch" style="background:var(--accent-soft);border:1px solid var(--accent)"></span> Recorrentes: <b style="margin-left:4px">${s.returning}</b></div>
            </div></div>
        </div>
      </div>
      <div class="grid-2b">
        <div class="card">
          <div class="card-head"><div>${ico("heart")}</div><h3>Estado</h3></div>
          <div class="kv"><span class="k">WhatsApp</span><span class="v">${conn.state === "open" ? "🟢 Conectado" : conn.state === "connecting" ? "🟠 A ligar" : "🔴 Offline"}</span></div>
          <div class="kv"><span class="k">Assistente IA</span><span class="v">🟢 Ativo</span></div>
          <div class="kv"><span class="k">Respostas enviadas</span><span class="v">${s.totalReplies}</span></div>
          <div class="kv"><span class="k">Ativos hoje</span><span class="v">${s.activeToday}</span></div>
          ${conn.state !== "open" ? `<a href="#/conexao" class="btn btn-primary block" style="margin-top:14px">${ico("qr", "icon icon-sm")} Ligar WhatsApp</a>` : ""}
        </div>
        <div class="card">
          <div class="card-head"><div>${ico("chat")}</div><h3>Conversas recentes</h3>
            <a href="#/pt" class="btn btn-ghost" style="margin-left:auto">Ver todas</a></div>
          ${logs}
        </div>
      </div>`;
  } catch (e) { v.innerHTML = `<div class="empty-state">${ico("activity")}<div>Não foi possível carregar os dados.</div></div>`; }
}

/* ================= CONEXÃO / QR (multi-número) ================= */
let connPolls = {};
function stopConnPolls() { Object.values(connPolls).forEach(clearInterval); connPolls = {}; }
function connCardHtml(i) {
  const title = `${i.flag || flagOf(i.country) || ""} ${escapeHtml(i.label || i.id)}`.trim();
  return `<div class="card qr-stage" data-inst="${escapeHtml(i.id)}">
    <div class="between" style="width:100%">
      <div class="card-head" style="margin:0"><div>${ico("qr")}</div><h3>${title}</h3></div>
      <span class="badge" data-role="state"><span class="dot"></span> …</span>
    </div>
    <div class="qr-frame empty" data-role="frame" style="margin-top:18px">${ico("qr", "icon")}<div style="position:absolute;bottom:14px;font-size:12px;color:var(--muted-2)">Gere o QR para ligar</div></div>
    <div class="row" style="margin-top:18px">
      <button class="btn btn-primary" data-role="gen">${ico("qr", "icon icon-sm")} Gerar QR</button>
      <button class="btn btn-danger" data-role="out">${ico("power", "icon icon-sm")} Desligar</button>
    </div>
  </div>`;
}
function wireConnCard(i) {
  const card = document.querySelector(`.qr-stage[data-inst="${CSS.escape(i.id)}"]`); if (!card) return;
  const frame = card.querySelector('[data-role="frame"]'), stateB = card.querySelector('[data-role="state"]');
  let lastQrAt = 0;
  const setState = (st) => {
    const map = { open: ["ok live", "Conectado ✅"], connecting: ["warn", "Aguardando leitura…"], close: ["off", "Desligado"], not_created: ["off", "Não ligado"] };
    const [cls, txt] = map[st] || ["off", st]; stateB.className = `badge ${cls}`; stateB.innerHTML = `<span class="dot"></span> ${txt}`;
  };
  setState(i.state);
  async function poll() {
    try {
      const c = await api(`/api/connection?instance=${encodeURIComponent(i.id)}`); setState(c.state); refreshConnBadge();
      if (c.state === "open") { clearInterval(connPolls[i.id]); delete connPolls[i.id]; frame.className = "qr-frame"; frame.innerHTML = `<div style="text-align:center;color:var(--brand-700)">${ico("check", "icon")}<div style="margin-top:8px;font-weight:600">Ligado!</div></div>`; return; }
      if (c.state === "connecting" && frame.querySelector("img") && Date.now() - lastQrAt > 18000) {
        try { const r = await api("/api/connection/connect", { method: "POST", body: JSON.stringify({ instance: i.id }) }); if (r.qr) { frame.querySelector("img").src = r.qr; lastQrAt = Date.now(); } } catch {}
      }
    } catch {}
  }
  async function generate() {
    const btn = card.querySelector('[data-role="gen"]'); btn.disabled = true; btn.innerHTML = `${ico("refresh", "icon icon-sm spin")} A gerar…`;
    frame.className = "qr-frame"; frame.innerHTML = `<div class="qr-skeleton"></div>`;
    try {
      const { qr, state } = await api("/api/connection/connect", { method: "POST", body: JSON.stringify({ instance: i.id }) });
      if (qr) { frame.innerHTML = `<img src="${qr}" alt="QR Code WhatsApp"/>`; lastQrAt = Date.now(); setState("connecting"); }
      else if (state === "open") { setState("open"); poll(); }
      else { frame.className = "qr-frame empty"; frame.innerHTML = "Sem QR — tente novamente"; }
      if (!connPolls[i.id]) connPolls[i.id] = setInterval(poll, 3000);
    } catch (e) { frame.className = "qr-frame empty"; frame.innerHTML = `${ico("power", "icon")}<div style="margin-top:8px;font-size:12px">Serviço indisponível</div>`; toast(e.data?.error || "Erro ao gerar QR"); }
    finally { btn.disabled = false; btn.innerHTML = `${ico("qr", "icon icon-sm")} Gerar QR`; }
  }
  card.querySelector('[data-role="gen"]').addEventListener("click", generate);
  card.querySelector('[data-role="out"]').addEventListener("click", async () => { try { await api("/api/connection/logout", { method: "POST", body: JSON.stringify({ instance: i.id }) }); toast("Número desligado"); setState("close"); refreshConnBadge(); } catch { toast("Erro"); } });
  if (!connPolls[i.id]) connPolls[i.id] = setInterval(poll, 4000);
}
async function pageConexao(v) {
  let insts = [];
  try { insts = await api("/api/instances"); } catch {}
  if (!insts.length) insts = [{ id: "impress3d", label: "WhatsApp", country: "", state: "?" }];
  v.innerHTML = `
    <div class="num-grid">
      ${insts.map(connCardHtml).join("")}
      <div class="card">
        <div class="card-head"><div>${ico("phone")}</div><h3>Como ligar cada número</h3></div>
        <div class="steps">
          <div class="step"><div class="n"></div><div class="t">Abra o <b>WhatsApp</b> no telemóvel do número (Portugal ou Brasil)</div></div>
          <div class="step"><div class="n"></div><div class="t">Toque em <b>Definições → Aparelhos ligados</b><small>Android: menu ⋮ → Aparelhos ligados</small></div></div>
          <div class="step"><div class="n"></div><div class="t">Toque em <b>Ligar um aparelho</b></div></div>
          <div class="step"><div class="n"></div><div class="t">Aponte a câmara ao <b>QR do cartão desse país</b></div></div>
          <div class="step"><div class="n"></div><div class="t">Pronto! A IA responde no idioma certo de cada país ✅</div></div>
        </div>
        <div class="divider"></div>
        <div class="muted" style="font-size:12.5px">${ico("link", "icon icon-sm")} O QR renova-se sozinho enquanto espera. Ligue um número em cada cartão.</div>
      </div>
    </div>`;
  stopConnPolls();
  insts.forEach(wireConnCard);
}
window.addEventListener("hashchange", () => { if (!location.hash.includes("conexao")) stopConnPolls(); });

/* ================= CONVERSAS ================= */
let convPoll = null, convOpenId = null, convSig = "";
let convFilter = { kind: "all", value: "" };
let convScope = ""; // "pt" | "br" — the country page currently open
const flagOf = (country) => ({ pt: "🇵🇹", br: "🇧🇷" }[country] || "");
function pauseLabel(c) {
  if (c.paused) return "IA pausada";
  if (c.pausedUntil && c.pausedUntil > Date.now()) { const m = Math.max(1, Math.ceil((c.pausedUntil - Date.now()) / 60000)); return `IA pausada (auto ~${m}m)`; }
  return "IA ativa";
}
function applyConvFilter(chats) {
  let list = convScope ? chats.filter((c) => c.country === convScope) : chats;
  const f = convFilter;
  if (f.kind === "quote") return list.filter((c) => c.quote || (c.labels || []).includes("Orçamentos") || (c.labels || []).includes("Orçamento"));
  if (f.kind === "label") return list.filter((c) => (c.labels || []).includes(f.value));
  return list;
}
function filterBarHtml() {
  const chip = (kind, value, label, active) =>
    `<button class="fchip${active ? " on" : ""}" data-kind="${kind}" data-value="${escapeHtml(value)}">${label}</button>`;
  const f = convFilter;
  const parts = [chip("all", "", "Todas", f.kind === "all")];
  parts.push(chip("quote", "", `${ico("tag", "icon icon-sm")} Orçamentos`, f.kind === "quote"));
  for (const l of labelsForCountry(convScope)) parts.push(chip("label", l.name, `<span class="lbl-dot" style="background:${l.color}"></span>${l.name}`, f.kind === "label" && f.value === l.name));
  return `<div class="conv-filters">${parts.join("")}</div>`;
}
function wireFilterBar() {
  document.querySelectorAll(".conv-filters .fchip").forEach((b) =>
    b.addEventListener("click", () => { convFilter = { kind: b.dataset.kind, value: b.dataset.value }; loadList(false); })
  );
}
async function pageConversas(v, country) {
  convScope = country || "";
  convFilter = { kind: "all", value: "" };
  convOpenId = null;
  v.innerHTML = `
    ${filterBarHtml()}
    <div class="chat-layout">
      <div class="card chat-list" id="chatList" style="padding:8px"></div>
      <div class="card chat-panel" id="chatPanel"><div class="empty-state" style="margin:auto">${ico("chat")}<div>Selecione uma conversa</div></div></div>
    </div>`;
  wireFilterBar();
  await loadList(true);
  if (convPoll) clearInterval(convPoll);
  convPoll = setInterval(pollConversas, 4000);
}
window.addEventListener("hashchange", () => { if (!isConvHash() && convPoll) { clearInterval(convPoll); convPoll = null; convOpenId = null; } });

function chatItemHtml(c) {
  const autoP = c.pausedUntil && c.pausedUntil > Date.now();
  const tag = (c.paused || autoP) ? `<span class="badge warn" style="margin-top:4px;padding:2px 8px">IA pausada${autoP && !c.paused ? " (auto)" : ""}</span>`
    : c.handoff ? '<span class="badge warn" style="margin-top:4px;padding:2px 8px">humano</span>' : "";
  const flag = flagOf(c.country);
  const chips = (c.labels || []).slice(0, 3).map(labelChip).join("");
  return `<div class="item${c.id === convOpenId ? " active" : ""}" data-id="${encodeURIComponent(c.id)}">
      <div class="avatar" style="background:${avatarColor(c.name || c.number)}">${initials(c.name || c.number)}</div>
      <div style="min-width:0;flex:1">
        <div class="who">${flag ? `<span class="flag">${flag}</span> ` : ""}${escapeHtml(c.name || c.number)}</div>
        <div class="prev">${(c.lastRole === "assistant" ? "🤖 " : "") + escapeHtml(c.lastMessage || "—")}</div>
        ${chips ? `<div class="item-labels">${chips}</div>` : ""}
      </div>
      <div style="text-align:right"><div class="muted" style="font-size:11px">${timeAgo(c.lastTs)}</div>${tag}</div>
    </div>`;
}
async function loadList(autoOpen) {
  let chats = [];
  try { chats = await api("/api/chats"); } catch { return; }
  // Discover any custom labels and refresh the filter bar if new ones appeared.
  if (noteCustomLabels(chats)) { const bar = document.querySelector(".conv-filters"); if (bar) { bar.outerHTML = filterBarHtml(); wireFilterBar(); } }
  document.querySelectorAll(".conv-filters .fchip").forEach((b) => b.classList.toggle("on", b.dataset.kind === convFilter.kind && (b.dataset.value || "") === (convFilter.value || "")));
  const list = $("#chatList"); if (!list) return;
  const filtered = applyConvFilter(chats);
  const inScope = convScope ? chats.filter((c) => c.country === convScope) : chats;
  if (!filtered.length) {
    const noneInCountry = inScope.length === 0;
    const pais = convScope === "br" ? "do Brasil" : convScope === "pt" ? "de Portugal" : "";
    const msg = noneInCountry ? `Ainda sem conversas ${pais}.` : "Nenhuma conversa neste filtro.";
    const sub = noneInCountry ? "Assim que um cliente escrever neste número, aparece aqui." : "Experimente outro filtro.";
    list.innerHTML = `<div class="empty-state">${ico("chat")}<div>${msg}</div><div class="muted" style="font-size:12px;margin-top:6px">${sub}</div></div>`;
    return;
  }
  list.innerHTML = filtered.map(chatItemHtml).join("");
  list.querySelectorAll(".item").forEach((it) => it.addEventListener("click", () => openChat(decodeURIComponent(it.dataset.id))));
  if (autoOpen && !convOpenId) list.querySelector(".item")?.click();
}
function chatLabelsHtml(active, country) {
  return `<span class="labels-lead">${ico("tag", "icon icon-sm")}</span>` +
    labelsForCountry(country).map((l) => `<button class="lbl-toggle${active.includes(l.name) ? " on" : ""}" data-label="${escapeHtml(l.name)}" style="--lc:${l.color}">${escapeHtml(l.name)}</button>`).join("");
}
function threadHtml(c) {
  return c.messages.map((m) => {
    const cls = m.agent ? "assistant agent" : m.role;
    const tag = m.agent ? `<span class="who-tag">👤 atendente</span>` : (m.role === "assistant" ? `<span class="who-tag">🤖 IA</span>` : "");
    return `<div class="bubble ${cls}">${tag}${mediaHtml(m)}${m.content ? `<span>${escapeHtml(m.content)}</span>` : ""}<span class="b-time">${fmtTime(m.ts)}</span></div>`;
  }).join("");
}
async function openChat(id) {
  convOpenId = id;
  document.querySelectorAll("#chatList .item").forEach((x) => x.classList.toggle("active", decodeURIComponent(x.dataset.id) === id));
  const panel = $("#chatPanel");
  panel.innerHTML = `<div class="empty-state" style="margin:auto">${ico("refresh", "icon spin")}</div>`;
  let c;
  try { c = await api(`/api/chats/${encodeURIComponent(id)}`); }
  catch { panel.innerHTML = `<div class="empty-state" style="margin:auto">${ico("chat")}<div>Erro ao abrir conversa</div></div>`; return; }
  convSig = c.messages.length + "|" + (c.messages[c.messages.length - 1]?.ts || "");
  panel.innerHTML = `
    <div class="chat-panel-head">
      <div class="avatar" style="background:${avatarColor(c.name || c.number)}">${initials(c.name || c.number)}</div>
      <div style="min-width:0"><div style="font-weight:600">${flagOf(c.country) ? flagOf(c.country) + " " : ""}${escapeHtml(c.name || c.number)}</div><div class="muted" style="font-size:12px">${c.number}${c.country ? " · " + (c.country === "pt" ? "Portugal" : "Brasil") : ""}</div></div>
      <label class="pause-toggle" title="Pausar a IA nesta conversa para responder manualmente">
        <input type="checkbox" id="pauseChk" ${c.paused || (c.pausedUntil > Date.now()) ? "checked" : ""}/>
        <span class="pause-label">${pauseLabel(c)}</span>
      </label>
    </div>
    <div class="chat-labels" id="chatLabels">${chatLabelsHtml(c.labels || [], c.country)}</div>
    <div class="chat-thread" id="thread">${threadHtml(c) || `<div class="empty-state">${ico("chat")}<div>Sem mensagens</div></div>`}</div>
    <form class="chat-composer" id="composer" autocomplete="off">
      <label class="icon-btn composer-attach" title="Anexar imagem, áudio, vídeo ou documento">${ico("paperclip", "icon icon-sm")}<input type="file" id="composerFile" hidden accept="image/*,audio/*,video/*,application/pdf" /></label>
      <input class="composer-input" id="composerInput" placeholder="Escreva uma resposta manual…" />
      <button class="btn btn-primary" id="composerSend" type="submit" title="Enviar">${ico("send", "icon icon-sm")}</button>
    </form>`;
  const th = $("#thread"); if (th) th.scrollTop = th.scrollHeight;
  $("#pauseChk").addEventListener("change", async (e) => {
    const paused = e.target.checked;
    $(".pause-label").textContent = paused ? "IA pausada" : "IA ativa";
    try { await api(`/api/chats/${encodeURIComponent(id)}/pause`, { method: "POST", body: JSON.stringify({ paused }) }); toast(paused ? "IA pausada nesta conversa" : "IA reativada"); loadList(false); }
    catch { toast("Erro ao alterar"); e.target.checked = !paused; }
  });
  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#composerInput"), txt = input.value.trim(); if (!txt) return;
    const btn = $("#composerSend"); btn.disabled = true; input.disabled = true;
    try {
      await api(`/api/chats/${encodeURIComponent(id)}/send`, { method: "POST", body: JSON.stringify({ text: txt }) });
      input.value = ""; await refreshThread(true); loadList(false);
    } catch (err) { toast(err.data?.error || "Falha ao enviar"); }
    finally { btn.disabled = false; input.disabled = false; input.focus(); }
  });
  $("#composerFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast("Ficheiro muito grande (máx. 15 MB)"); e.target.value = ""; return; }
    const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("audio/") ? "audio" : f.type.startsWith("video/") ? "video" : "document";
    toast("A enviar ficheiro…");
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(f); });
    try {
      await api(`/api/chats/${encodeURIComponent(id)}/send-media`, { method: "POST", body: JSON.stringify({ base64: b64, type, mime: f.type, fileName: f.name, caption: $("#composerInput").value.trim() }) });
      $("#composerInput").value = ""; await refreshThread(true); loadList(false); toast("Ficheiro enviado");
    } catch (err) { toast(err.data?.error || "Falha ao enviar ficheiro"); }
    finally { e.target.value = ""; }
  });
  const curLabels = new Set(c.labels || []);
  const labelsBox = $("#chatLabels");
  async function saveLabels() {
    try { await api(`/api/chats/${encodeURIComponent(id)}/labels`, { method: "POST", body: JSON.stringify({ labels: [...curLabels] }) }); loadList(false); return true; }
    catch { toast("Erro ao guardar etiqueta"); return false; }
  }
  function renderLabels() {
    labelsBox.innerHTML = chatLabelsHtml([...curLabels], c.country) + `<input class="lbl-new-input" id="lblNew" placeholder="+ nova etiqueta" maxlength="24" />`;
    labelsBox.querySelectorAll(".lbl-toggle").forEach((b) => b.addEventListener("click", async () => {
      const name = b.dataset.label, had = curLabels.has(name);
      had ? curLabels.delete(name) : curLabels.add(name); b.classList.toggle("on");
      if (!(await saveLabels())) { had ? curLabels.add(name) : curLabels.delete(name); b.classList.toggle("on"); }
    }));
    labelsBox.querySelector("#lblNew").addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return; e.preventDefault();
      const name = e.target.value.trim(); if (!name) return;
      if (curLabels.has(name)) { e.target.value = ""; return; }
      curLabels.add(name);
      if (c.country && customLabels[c.country] && !LABELS_BY_COUNTRY[c.country].some((l) => l.name === name)) customLabels[c.country].set(name, hashColor(name));
      if (await saveLabels()) { toast(`Etiqueta "${name}" criada`); renderLabels(); } else curLabels.delete(name);
    });
  }
  renderLabels();
}
async function refreshThread(force) {
  if (!convOpenId) return;
  let c;
  try { c = await api(`/api/chats/${encodeURIComponent(convOpenId)}`); } catch { return; }
  const sig = c.messages.length + "|" + (c.messages[c.messages.length - 1]?.ts || "");
  if (!force && sig === convSig) return;
  convSig = sig;
  const th = $("#thread"); if (!th) return;
  const atBottom = th.scrollHeight - th.scrollTop - th.clientHeight < 60;
  th.innerHTML = threadHtml(c);
  if (force || atBottom) th.scrollTop = th.scrollHeight;
}
async function pollConversas() {
  if (!isConvHash()) return;
  await loadList(false);
  if (convOpenId) await refreshThread(false);
}
const escapeHtml = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function mediaHtml(m) {
  if (!m.type) return "";
  const docName = m.fileName ? escapeHtml(m.fileName) : "documento";
  if (!m.media) {
    if (m.type === "document") return `<span class="bubble-doc">📄 ${docName} <span class="muted">(indisponível)</span></span>`;
    return `<span class="media-missing">${{ image: "📷", audio: "🎤", video: "🎬", sticker: "🃏" }[m.type] || "📎"} (mídia indisponível)</span>`;
  }
  const src = `/media/${encodeURIComponent(m.media)}?t=${encodeURIComponent(TOKEN)}`;
  if (m.type === "image" || m.type === "sticker") return `<a href="${src}" target="_blank" rel="noopener"><img class="bubble-media" src="${src}" alt="imagem" loading="lazy"/></a>`;
  if (m.type === "audio") return `<audio class="bubble-audio" controls preload="none" src="${src}"></audio>`;
  if (m.type === "video") return `<video class="bubble-media" controls preload="none" src="${src}"></video>`;
  if (m.type === "document") return `<a class="bubble-doc" href="${src}" target="_blank" rel="noopener" download>📄 ${docName}</a>`;
  return "";
}

/* ================= CONFIGURAÇÕES ================= */
async function pageConfig(v) {
  let conn = { state: "?", instance: "-", provider: "-" };
  try { conn = await api("/api/connection"); } catch { }
  v.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div>${ico("bot")}</div>
        <div><h3>Treino da IA · Prompt</h3><div class="sub">Escreva as informações, serviços, preços e o comportamento da IA para cada país. Guarda e passa a valer de imediato.</div></div>
      </div>
      <div class="prompt-tabs">
        <button class="ptab on" data-c="pt">🇵🇹 Portugal</button>
        <button class="ptab" data-c="br">🇧🇷 Brasil</button>
        <span class="prompt-status" id="promptStatus"></span>
      </div>
      <textarea class="input prompt-area" id="promptArea" rows="16" spellcheck="false" placeholder="A carregar…"></textarea>
      <div class="row" style="margin-top:12px;justify-content:flex-end;gap:10px">
        <span class="muted" style="font-size:12px" id="promptHint">Dica: inclua serviços, materiais, tabela de preços, FAQ e quando falar com um humano.</span>
        <button class="btn" id="promptReload">${ico("refresh", "icon icon-sm")} Recarregar</button>
        <button class="btn btn-primary" id="promptSave">${ico("check", "icon icon-sm")} Guardar prompt</button>
      </div>
    </div>
    <div class="settings-grid">
      <div class="card">
        <div class="card-head"><div>${ico("bot")}</div><h3>Assistente</h3></div>
        <div class="kv"><span class="k">Estado da IA</span><span class="v">🟢 Ativo</span></div>
        <div class="kv"><span class="k">Modelo</span><span class="v">Claude (Anthropic)</span></div>
        <div class="kv"><span class="k">Idioma</span><span class="v">PT-PT / PT-BR (automático)</span></div>
        <div class="kv"><span class="k">Encaminhar a humano</span><span class="v">palavra “atendente”</span></div>
        <div class="divider"></div>
        <div class="muted" style="font-size:12.5px">A base de conhecimento (serviços, materiais, preços) é definida no prompt do sistema. Envie o material e afinamos as respostas.</div>
      </div>
      <div class="card">
        <div class="card-head"><div>${ico("clock")}</div><h3>Pausa automática da IA</h3></div>
        <div class="muted" style="font-size:12.5px;margin-bottom:12px">Quando um atendente responde numa conversa, a IA fica em silêncio durante este tempo. Se o cliente responder dentro da janela, a IA continua calada; passado o tempo, volta a responder sozinha.</div>
        <div class="field"><label>Tempo de pausa (minutos) — 0 desativa</label>
          <input class="input" type="number" min="0" max="1440" id="autoPauseMin" style="max-width:160px" placeholder="60" /></div>
        <button class="btn btn-primary" id="autoPauseSave">${ico("check", "icon icon-sm")} Guardar tempo</button>
        <span class="prompt-status" id="autoPauseStatus" style="margin-left:10px"></span>
      </div>
      <div class="card">
        <div class="card-head"><div>${ico("link")}</div><h3>Ligação WhatsApp</h3></div>
        <div class="kv"><span class="k">Fornecedor</span><span class="v">${conn.provider || "Evolution API"}</span></div>
        <div class="kv"><span class="k">Instância</span><span class="v">${conn.instance || "-"}</span></div>
        <div class="kv"><span class="k">Estado</span><span class="v">${conn.state === "open" ? "🟢 Conectado" : "🔴 Desconectado"}</span></div>
        <a href="#/conexao" class="btn btn-primary block" style="margin-top:14px">${ico("qr", "icon icon-sm")} Gerir ligação</a>
      </div>
      <div class="card">
        <div class="card-head"><div>${ico("settings")}</div><h3>Conta</h3></div>
        <div class="muted" style="font-size:12.5px;margin-bottom:12px">Termine a sessão do painel administrativo com segurança.</div>
        <button class="btn btn-danger block" id="cfgLogout">${ico("logout", "icon icon-sm")} Terminar sessão</button>
      </div>
      <div class="card">
        <div class="card-head"><div>${ico("heart")}</div><h3>Sobre</h3></div>
        <div class="kv"><span class="k">Projeto</span><span class="v">Impress3D · Atendimento IA</span></div>
        <div class="kv"><span class="k">Versão</span><span class="v">Fase 2A · 2 números</span></div>
        <div class="kv"><span class="k">Domínio</span><span class="v">api.impress3d.com.br</span></div>
      </div>
    </div>`;
  $("#cfgLogout").addEventListener("click", logout);

  // ---- Prompt editor ----
  let promptCountry = "pt";
  const area = $("#promptArea"), status = $("#promptStatus");
  async function loadPrompt() {
    area.disabled = true; status.textContent = "A carregar…";
    try { const d = await api(`/api/prompt?country=${promptCountry}`); area.value = d.text || ""; status.textContent = ""; }
    catch { status.textContent = "Erro ao carregar"; }
    finally { area.disabled = false; }
  }
  document.querySelectorAll(".ptab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".ptab").forEach((x) => x.classList.remove("on"));
    t.classList.add("on"); promptCountry = t.dataset.c; loadPrompt();
  }));
  $("#promptReload").addEventListener("click", loadPrompt);
  $("#promptSave").addEventListener("click", async () => {
    const btn = $("#promptSave"); btn.disabled = true; status.textContent = "A guardar…";
    try {
      await api("/api/prompt", { method: "POST", body: JSON.stringify({ country: promptCountry, text: area.value }) });
      status.textContent = "✅ Guardado — já está ativo"; toast("Prompt guardado e ativo");
      setTimeout(() => (status.textContent = ""), 3000);
    } catch (e) { status.textContent = "❌ " + (e.data?.error || "Erro ao guardar"); }
    finally { btn.disabled = false; }
  });
  loadPrompt();

  // ---- Auto-pause timer setting ----
  const apInput = $("#autoPauseMin"), apStatus = $("#autoPauseStatus");
  try { const s = await api("/api/settings"); apInput.value = s.autoPauseMinutes ?? 60; } catch {}
  $("#autoPauseSave").addEventListener("click", async () => {
    const btn = $("#autoPauseSave"); btn.disabled = true; apStatus.textContent = "A guardar…";
    try {
      const s = await api("/api/settings", { method: "POST", body: JSON.stringify({ autoPauseMinutes: apInput.value }) });
      apInput.value = s.autoPauseMinutes; apStatus.textContent = "✅ Guardado"; toast("Tempo de pausa guardado");
      setTimeout(() => (apStatus.textContent = ""), 2500);
    } catch { apStatus.textContent = "❌ Erro"; }
    finally { btn.disabled = false; }
  });
}

/* ================= BOOT ================= */
initTheme();
if (TOKEN) renderApp(); else renderLogin();
