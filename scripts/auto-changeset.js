import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const changesetDir = join(process.cwd(), ".changeset");

// 1. 检查是否有未发布的 changeset 文件
const files = readdirSync(changesetDir).filter(
  (f) => f.endsWith(".md") && f !== "README.md",
);

if (files.length === 0) {
  console.log("🦋 No unreleased changesets found, creating a default patch...");

  // 2. 获取最近一次 git commit 信息作为默认日志内容
  let commitMsg = "Routine update";
  try {
    commitMsg = execSync("git log -1 --pretty=%B")
      .toString()
      .trim()
      .split("\n")[0];
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
