import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const expectedReleaseFiles = [
  "CHANGELOG.md",
  "docs/release.md",
  "package.json",
];

/** @param {string} relativePath */
async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("release contracts", () => {
  it("includes strict JavaScript tooling checks in the build project graph", async () => {
    const rootConfig = JSON.parse(await readRepositoryFile("tsconfig.json"));
    const scriptsConfig = JSON.parse(
      await readRepositoryFile("tsconfig.scripts.json"),
    );
    expect(rootConfig.references).toContainEqual({
      path: "./tsconfig.scripts.json",
    });
    expect(scriptsConfig.compilerOptions).toMatchObject({
      allowJs: true,
      checkJs: true,
      strict: true,
      noEmit: true,
    });
    expect(scriptsConfig.include).toEqual([
      "scripts/**/*.mjs",
      "scripts/**/*.js",
    ]);
  });

  it("revalidates mutable PWA entry points while caching hashed assets", async () => {
    const config = JSON.parse(await readRepositoryFile("vercel.json"));
    expect(config.headers).toEqual(
      expect.arrayContaining([
        ...["/sw.js", "/manifest.webmanifest", "/index.html", "/"].map(
          (source) => ({
            source,
            headers: [
              { key: "Cache-Control", value: "max-age=0, must-revalidate" },
            ],
          }),
        ),
        ...["/assets/(.*)", "/workbox-([a-f0-9]+).js"].map((source) => ({
          source,
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        })),
      ]),
    );
  });
  it("runs docs and offline build validation before browser release acceptance", async () => {
    const releaseScript = await readRepositoryFile("release.ps1");
    const gates = releaseScript
      .split("function Invoke-QualityGates {")[1]
      .split("function Invoke-SemanticReleasePreview")[0];
    const packageJson = JSON.parse(await readRepositoryFile("package.json"));
    expect(gates).toContain('"4/8 文档链接检查"');
    expect(gates).toContain('@("run", "check:docs")');
    expect(gates.indexOf('"check:docs"')).toBeLessThan(
      gates.indexOf('"build"'),
    );
    expect(gates.indexOf('"build"')).toBeLessThan(
      gates.indexOf("Invoke-PlaywrightGate"),
    );
    expect(releaseScript).toContain("8/8 Playwright");
    expect(packageJson.scripts.build).toBe(
      "tsc -b && vite build && node scripts/check-precache.mjs",
    );
  });

  it("runs the same optional-renderer browser check in CI and local release gates", async () => {
    const [workflow, releaseScript, packageText] = await Promise.all([
      readRepositoryFile(".github/workflows/ci.yml"),
      readRepositoryFile("release.ps1"),
      readRepositoryFile("package.json"),
    ]);
    const packageJson = JSON.parse(packageText);
    expect(packageJson.scripts["check:pdf-optional"]).toBe(
      "node scripts/check-pdf-optional-browser.mjs",
    );
    const browserInstall = workflow.indexOf("pnpm exec playwright install");
    const optionalCheck = workflow.indexOf("pnpm run check:pdf-optional");
    const browserTests = workflow.indexOf("pnpm exec playwright test");
    expect(browserInstall).toBeGreaterThan(-1);
    expect(optionalCheck).toBeGreaterThan(browserInstall);
    expect(browserTests).toBeGreaterThan(optionalCheck);
    const releaseGate = releaseScript
      .split("function Invoke-PlaywrightGate {")[1]
      .split("function Invoke-QualityGates")[0];
    expect(releaseGate).toContain('@("run", "check:pdf-optional")');
    expect(releaseGate.indexOf('"check:pdf-optional"')).toBeLessThan(
      releaseGate.indexOf('"node_modules/@playwright/test/cli.js"'),
    );
  });

  it("orders prepare plugins and commits exactly the release assets", async () => {
    /** @type {{plugins: (string | [string, {assets: string[]}])[], tagFormat: string}} */
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
    if (!Array.isArray(gitPlugin))
      throw new Error("Missing Git release plugin config");
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
