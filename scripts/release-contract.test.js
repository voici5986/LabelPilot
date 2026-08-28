import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const expectedReleaseFiles = [
  "CHANGELOG.md",
  "docs/release.md",
  "package.json",
];

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("release contracts", () => {
  it("orders prepare plugins and commits exactly the release assets", async () => {
    const config = JSON.parse(await readRepositoryFile(".releaserc.json"));
    const pluginNames = config.plugins.map((entry) =>
      Array.isArray(entry) ? entry[0] : entry,
    );
    const npmIndex = pluginNames.indexOf("@semantic-release/npm");
    const docIndex = pluginNames.indexOf(
      "./scripts/semantic-release-update-release-doc.mjs",
    );
    const gitIndex = pluginNames.indexOf("@semantic-release/git");
    const gitPlugin = config.plugins[gitIndex];

    expect(config.tagFormat).toBe("v${version}");
    expect(npmIndex).toBeGreaterThan(-1);
    expect(docIndex).toBeGreaterThan(npmIndex);
    expect(gitIndex).toBeGreaterThan(docIndex);
    expect([...gitPlugin[1].assets].sort()).toEqual(
      [...expectedReleaseFiles].sort(),
    );
  });

  it("keeps CI concurrency and timeout safeguards", async () => {
    const workflow = await readRepositoryFile(".github/workflows/ci.yml");

    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toMatch(/verify:\r?\n(?:.|\r?\n)*?timeout-minutes: 20/u);
  });

  it("keeps the release document aligned with package.json", async () => {
    const [releaseDoc, packageText] = await Promise.all([
      readRepositoryFile("docs/release.md"),
      readRepositoryFile("package.json"),
    ]);
    const packageJson = JSON.parse(packageText);

    expect(releaseDoc).toContain(`当前发布标签：\`v${packageJson.version}\``);
    expect(releaseDoc).toContain(
      `\`package.json\` 版本：\`${packageJson.version}\``,
    );
    expect(releaseDoc).not.toContain("对应提交");
  });

  it("uses one strict release file list in release.ps1", async () => {
    const releaseScript = await readRepositoryFile("release.ps1");

    expect(releaseScript).toContain("$ExpectedReleaseCommitFiles = @(");
    for (const path of expectedReleaseFiles) {
      expect(releaseScript).toContain(`"${path}"`);
    }
    expect(releaseScript).toContain("Assert-ReleaseConfiguration");
    expect(releaseScript).toContain("Get-ReleaseDocVersion");
    expect(releaseScript).toContain(
      "$ExpectedReleaseCommitFiles | Sort-Object",
    );
  });
});
