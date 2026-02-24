import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const changesetDir = join(process.cwd(), ".changeset");

// 1. 检查是否有未发布的 changeset 文件
const files = readdirSync(changesetDir).filter(
  (f) => f.endsWith(".md") && f !== "README.md",
);

if (files.length === 0) {
  console.log("🦋 No unreleased changesets found, creating a default patch...");

  // 2. 获取当前暂存区或者工作区的改动概要作为日志内容
  let commitMsg = "Routine update and version bump";
  try {
    // 优先获取暂存区的改动文件名
    const status = execSync("git status --short").toString().trim();
    if (!status) {
      console.log(
        "⚠️ No changes detected in the repository. Skipping changeset creation.",
      );
      process.exit(0);
    }
    commitMsg = `Automated release for changes:\n${status}`;
  } catch (e) {
    // ignore
  }

  // 3. 获取 package.json 中的项目名
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );
  const pkgName = pkg.name;

  // 4. 生成一个随机文件名的 changeset
  const randomId = Math.random().toString(36).substring(2, 8);
  const content = `---
"${pkgName}": patch
---

${commitMsg}
`;

  writeFileSync(join(changesetDir, `auto-${randomId}.md`), content);
  console.log(`✅ Created automatic changeset: auto-${randomId}.md`);
} else {
  console.log("🦋 Unreleased changesets found, proceeding...");
}
