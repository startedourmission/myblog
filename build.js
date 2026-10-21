// content/ 의 마크다운을 읽어 index.html 안의 데이터 영역을 갱신합니다.
// 사용: node build.js
const fs = require("fs");
const path = require("path");

const root = __dirname;
const postsDir = path.join(root, "content", "posts");
const aboutFile = path.join(root, "content", "about.md");

function parseFrontmatter(raw) {
  const m = raw.replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.replace(/\r/g, "") };
  const meta = {};
  let listKey = null;
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) { meta[listKey].push(strip(item[1])); continue; }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "") { meta[k] = []; listKey = k; continue; }
    listKey = null;
    meta[k] = /^\[.*\]$/.test(v)
      ? v.slice(1, -1).split(",").map(s => strip(s)).filter(Boolean)
      : strip(v);
  }
  return { meta, body: m[2] };
}
const strip = s => s.trim().replace(/^["']|["']$/g, "");
const toDate = v => {
  const d = String(v || "").match(/\d{4}-\d{2}-\d{2}/);
  return d ? d[0] : new Date().toISOString().slice(0, 10);
};

// 한국 시간 기준 오늘. `node build.js --all` 은 예약 글도 포함(미리보기용).
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const showAll = process.argv.includes("--all");

const files = fs.existsSync(postsDir)
  ? fs.readdirSync(postsDir).filter(f => f.endsWith(".md")) : [];
const posts = [];
for (const f of files) {
  const name = f.replace(/\.md$/, "");
  const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(postsDir, f), "utf8"));
  if (meta.draft === "true" || meta.draft === true) continue;
  if (!showAll && toDate(meta.date) > today) continue; // 예약 발행: 날짜가 미래인 글은 제외
  const tags = (Array.isArray(meta.tags) ? meta.tags : String(meta.tags || "").split(","))
    .map(t => t.trim().replace(/^#/, "")).filter(Boolean);
  posts.push({ id: name, title: meta.title || name, date: toDate(meta.date),
    tags, summary: meta.summary || "", content: body });
}
const byName = Object.fromEntries(posts.map(p => [p.id, p]));

// 옵시디언 문법 변환: ![[img]] / [[노트]] / [[노트|표시]] / images/ 경로
function obsidian(md) {
  return md
    .replace(/!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g, (_, f) => `![${f}](content/images/${encodeURI(f.trim())})`)
    .replace(/\]\((?:\.\/)?(?:\.\.\/)?images\//g, "](content/images/")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, alias) => {
      const p = byName[t.trim()];
      const label = alias || t;
      return p ? `[${label}](#/post/${encodeURIComponent(p.id)})` : label;
    })
    .replace(/%%[\s\S]*?%%/g, "");
}
posts.forEach(p => { p.content = obsidian(p.content); });

const about = fs.existsSync(aboutFile)
  ? obsidian(parseFrontmatter(fs.readFileSync(aboutFile, "utf8")).body) : "";

const safe = s => s.replace(/<\/script/gi, "<\\/script").replace(/[\u2028\u2029]/g, "");
const data = `/*DATA_START*/\nwindow.POSTS = ${safe(JSON.stringify(posts, null, 2))};\nwindow.ABOUT = ${safe(JSON.stringify(about))};\n/*DATA_END*/`;

const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
if (!html.includes("/*DATA_START*/")) throw new Error("index.html 에서 DATA 영역을 찾지 못했습니다.");
fs.writeFileSync(htmlPath, html.replace(/\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//, () => data));
console.log(`글 ${posts.length}개를 index.html 에 반영했습니다.`);
