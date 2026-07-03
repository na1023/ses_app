import { DailyReport } from "./constants";

type TechDef = { cat: string; alias: string[] };
const TECH: Record<string, TechDef> = {
  Python: { cat: "言語", alias: ["python", "パイソン"] },
  Java: { cat: "言語", alias: ["java(?!script)"] },
  JavaScript: { cat: "言語", alias: ["javascript", "js"] },
  TypeScript: { cat: "言語", alias: ["typescript", "ts"] },
  "C#": { cat: "言語", alias: ["c#", "csharp"] },
  "C++": { cat: "言語", alias: ["c\\+\\+"] },
  Go: { cat: "言語", alias: ["golang", "go言語"] },
  Ruby: { cat: "言語", alias: ["ruby"] },
  PHP: { cat: "言語", alias: ["php"] },
  Swift: { cat: "言語", alias: ["swift"] },
  Kotlin: { cat: "言語", alias: ["kotlin"] },
  SQL: { cat: "言語", alias: ["sql"] },
  "HTML/CSS": { cat: "言語", alias: ["html", "css"] },
  Django: { cat: "FW", alias: ["django"] },
  Flask: { cat: "FW", alias: ["flask"] },
  FastAPI: { cat: "FW", alias: ["fastapi"] },
  Spring: { cat: "FW", alias: ["spring"] },
  React: { cat: "FW", alias: ["react"] },
  "Vue.js": { cat: "FW", alias: ["vue"] },
  Angular: { cat: "FW", alias: ["angular"] },
  "Next.js": { cat: "FW", alias: ["next\\.?js"] },
  "Node.js": { cat: "FW", alias: ["node\\.?js"] },
  Rails: { cat: "FW", alias: ["rails"] },
  Laravel: { cat: "FW", alias: ["laravel"] },
  ".NET": { cat: "FW", alias: ["\\.net", "dotnet"] },
  MySQL: { cat: "DB", alias: ["mysql"] },
  PostgreSQL: { cat: "DB", alias: ["postgres", "postgresql"] },
  Oracle: { cat: "DB", alias: ["oracle"] },
  "SQL Server": { cat: "DB", alias: ["sql ?server"] },
  MongoDB: { cat: "DB", alias: ["mongo"] },
  Redis: { cat: "DB", alias: ["redis"] },
  AWS: { cat: "インフラ", alias: ["aws", "amazon web"] },
  Azure: { cat: "インフラ", alias: ["azure"] },
  GCP: { cat: "インフラ", alias: ["gcp", "google cloud"] },
  Docker: { cat: "インフラ", alias: ["docker"] },
  Kubernetes: { cat: "インフラ", alias: ["kubernetes", "k8s"] },
  Linux: { cat: "インフラ", alias: ["linux", "centos", "ubuntu"] },
  Git: { cat: "ツール", alias: ["git", "github", "gitlab"] },
  Jira: { cat: "ツール", alias: ["jira"] },
  Backlog: { cat: "ツール", alias: ["backlog"] },
};
const CAT_ORDER = ["言語", "FW", "DB", "インフラ", "ツール"];
const CAT_LABEL: Record<string, string> = {
  言語: "言語", FW: "フレームワーク", DB: "データベース", インフラ: "インフラ・クラウド", ツール: "ツール",
};

const PHASES: [string, string[]][] = [
  ["要件定義", ["要件定義", "要件", "ヒアリング"]],
  ["設計", ["設計", "画面設計", "db設計", "アーキ"]],
  ["実装・開発", ["実装", "開発", "コーディング", "製造", "プログラ"]],
  ["テスト", ["テスト", "試験", "単体", "結合", "検証", "デバッグ", "評価"]],
  ["レビュー", ["レビュー", "指摘"]],
  ["運用・保守", ["運用", "保守", "監視", "障害", "問い合わせ", "対応"]],
  ["調査・分析", ["調査", "分析", "検討", "比較"]],
  ["ドキュメント", ["資料", "ドキュメント", "手順書", "仕様書", "報告書"]],
];

function extractTech(text: string): Record<string, string[]> {
  const low = text.toLowerCase();
  const byCat: Record<string, string[]> = {};
  for (const [name, def] of Object.entries(TECH)) {
    let hit = false;
    for (const pat of def.alias) {
      const core = pat.replace(/\\b/g, "");
      const re = new RegExp(`(?<![a-z0-9])${core}(?![a-z0-9])`, "g");
      try {
        if (re.test(low)) { hit = true; break; }
      } catch {
        if (low.includes(core)) { hit = true; break; }
      }
    }
    if (hit) (byCat[def.cat] ||= []).push(name);
  }
  return byCat;
}

function cleanSentence(t: string): string {
  let s = t.replace(/[\s　]+/g, " ").trim();
  s = s.replace(/^[・\-*●○◇◆\d]+[.)、]?\s*/, "");
  s = s.replace(/\d{1,2}[:：]\d{2}/g, "");
  for (const w of ["を行った", "を行いました", "を実施した", "を実施", "しました", "でした", "など", "について", "に関して"]) {
    s = s.split(w).join("");
  }
  return s.replace(/[。.、,\s　]+$/, "").trim();
}

export type CareerInput = {
  daily: DailyReport[];
  start: string;
  end: string;
  company: string; // "" = すべて
};

export function generateCareer({ daily, start, end, company }: CareerInput) {
  const inRange = daily.filter((d) => {
    const day = String(d.date);
    if (start && day < start) return false;
    if (end && day > end) return false;
    if (company && d.company !== company) return false;
    return d.work_content && d.work_content.trim();
  });

  if (inRange.length === 0) return { md: "対象期間に日報がありません。", text: "対象期間に日報がありません。" };

  const allText = inRange.map((d) => d.work_content).join("\n");
  const tech = extractTech(allText);

  // 工程
  const phaseHit: string[] = [];
  for (const [name, kws] of PHASES) {
    if (kws.some((k) => allText.toLowerCase().includes(k.toLowerCase()))) phaseHit.push(name);
  }

  // 代表業務（重複除去・整形）
  const seen = new Set<string>();
  const acts: string[] = [];
  for (const d of inRange) {
    for (const part of d.work_content.split(/[。\n]/)) {
      const c = cleanSentence(part);
      if (c.length >= 6 && c.length <= 60) {
        const key = c.slice(0, 12);
        if (!seen.has(key)) { seen.add(key); acts.push(c); }
      }
    }
    if (acts.length >= 14) break;
  }

  const days = new Set(inRange.map((d) => d.date)).size;
  const hours = inRange.reduce((s, d) => s + (Number(d.work_hours) || 0), 0);
  const proj = inRange[0]?.project_name || "—";
  const comp = company || inRange[0]?.company || "—";
  const flatTech = CAT_ORDER.flatMap((c) => tech[c] || []).slice(0, 5);

  const summary = `${proj}にて${flatTech.length ? `主に${flatTech.join("、")}を用い、` : ""}${phaseHit.slice(0, 3).join("・") || "開発業務"}を担当。期間中${days}日・約${Math.round(hours)}時間従事。`;

  const mdLines = [
    "## 職務経歴", "",
    `**期間**：${start} 〜 ${end}（${days}日 / 約${Math.round(hours)}h）  `,
    `**案件**：${proj}　**所属/取引先**：${comp}`, "",
    "### 概要", "", summary, "",
    "### 担当工程", "", phaseHit.join(" / ") || "—", "",
    "### 主な担当業務", "",
    ...acts.map((a) => `- ${a}`), "",
    "### 使用技術", "",
  ];
  const techLines: string[] = [];
  for (const c of CAT_ORDER) {
    if (tech[c]?.length) {
      mdLines.push(`- **${CAT_LABEL[c]}**：${tech[c].join("、")}`);
      techLines.push(`  ${CAT_LABEL[c]}：${tech[c].join("、")}`);
    }
  }
  if (techLines.length === 0) mdLines.push("- （技術名を検出できませんでした）");

  const text = [
    `■ 期間\n  ${start} 〜 ${end}（${days}日 / 約${Math.round(hours)}h）`, "",
    `■ 案件\n  ${proj}（${comp}）`, "",
    `■ 概要\n  ${summary}`, "",
    `■ 担当工程\n  ${phaseHit.join(" / ") || "—"}`, "",
    `■ 主な担当業務\n${acts.map((a) => `  ・${a}`).join("\n") || "  ・—"}`, "",
    `■ 使用技術\n${techLines.join("\n") || "  —"}`,
  ].join("\n");

  return { md: mdLines.join("\n"), text };
}
