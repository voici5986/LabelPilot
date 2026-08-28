import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  prepare,
  releaseDocMarkers,
  verifyConditions,
} from "./semantic-release-update-release-doc.mjs";

const temporaryDirectories = [];

async function createFixture({
  eol = "\n",
  packageVersion = "1.3.1",
  releaseDoc,
} = {}) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "label pilot release doc-"));
  temporaryDirectories.push(cwd);
  await mkdir(path.join(cwd, "docs"));
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ version: packageVersion }),
    "utf8",
  );

  const defaultDoc = [
    "# 发布流程",
    "",
    "示例版本保持为 `1.3.0`。",
    releaseDocMarkers.start,
    "",
    "当前发布标签：`v1.3.1`",
    "`package.json` 版本：`1.3.1`",
    "",
    releaseDocMarkers.end,
    "",
    "后续说明保持不变。",
    "",
  ].join(eol);
  await writeFile(
    path.join(cwd, "docs", "release.md"),
    releaseDoc ?? defaultDoc,
    "utf8",
  );
  return cwd;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("semantic-release release document plugin", () => {
  it("updates only the marked block and is idempotent", async () => {
    const cwd = await createFixture({ packageVersion: "1.3.2" });

    await prepare({}, { cwd, nextRelease: { version: "1.3.2" } });
    const first = await readFile(path.join(cwd, "docs", "release.md"), "utf8");
    await prepare({}, { cwd, nextRelease: { version: "1.3.2" } });
    const second = await readFile(path.join(cwd, "docs", "release.md"), "utf8");

    expect(first).toContain("当前发布标签：`v1.3.2`");
    expect(first).toContain("`package.json` 版本：`1.3.2`");
    expect(first).toContain("示例版本保持为 `1.3.0`。");
    expect(first).toContain("后续说明保持不变。");
    expect(second).toBe(first);
  });

  it("preserves BOM and CRLF outside and inside the marked block", async () => {
    const eol = "\r\n";
    const releaseDoc =
      "\uFEFF" +
      [
        "# 发布流程",
        releaseDocMarkers.start,
        "",
        "当前发布标签：`v1.3.1`",
        "`package.json` 版本：`1.3.1`",
        "",
        releaseDocMarkers.end,
        "尾部内容",
        "",
      ].join(eol);
    const cwd = await createFixture({
      eol,
      packageVersion: "1.4.0",
      releaseDoc,
    });

    await prepare({}, { cwd, nextRelease: { version: "1.4.0" } });
    const updated = await readFile(
      path.join(cwd, "docs", "release.md"),
      "utf8",
    );

    expect(updated.startsWith("\uFEFF# 发布流程\r\n")).toBe(true);
    expect(updated).toContain(`${releaseDocMarkers.start}\r\n\r\n当前发布标签`);
    expect(updated).toContain("当前发布标签：`v1.4.0`\r\n");
    expect(updated).toContain("`package.json` 版本：`1.4.0`\r\n\r\n");
    expect(updated.endsWith("尾部内容\r\n")).toBe(true);
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("rejects a package version that npm prepare has not updated", async () => {
    const cwd = await createFixture();
    const releaseDocPath = path.join(cwd, "docs", "release.md");
    const before = await readFile(releaseDocPath, "utf8");

    await expect(
      prepare({}, { cwd, nextRelease: { version: "1.3.2" } }),
    ).rejects.toThrow("预期 npm prepare 已更新为 1.3.2");
    await expect(readFile(releaseDocPath, "utf8")).resolves.toBe(before);
  });

  it.each([
    ["missing start marker", "只有普通内容\n"],
    [
      "duplicate start marker",
      [
        releaseDocMarkers.start,
        releaseDocMarkers.start,
        releaseDocMarkers.end,
        "",
      ].join("\n"),
    ],
    [
      "reversed markers",
      [releaseDocMarkers.end, releaseDocMarkers.start, ""].join("\n"),
    ],
    [
      "non-exclusive marker",
      [`prefix ${releaseDocMarkers.start}`, releaseDocMarkers.end, ""].join(
        "\n",
      ),
    ],
  ])("rejects %s", async (_name, releaseDoc) => {
    const cwd = await createFixture({ releaseDoc });

    await expect(verifyConditions({}, { cwd })).rejects.toThrow("release-doc");
  });

  it("validates the current document without writing it", async () => {
    const cwd = await createFixture();
    const releaseDocPath = path.join(cwd, "docs", "release.md");
    const before = await readFile(releaseDocPath, "utf8");

    await verifyConditions({}, { cwd });

    await expect(readFile(releaseDocPath, "utf8")).resolves.toBe(before);
  });

  it("rejects a stale release block before prepare", async () => {
    const cwd = await createFixture({ packageVersion: "1.3.2" });

    await expect(verifyConditions({}, { cwd })).rejects.toThrow(
      "发布区块必须与 package.json 版本 1.3.2 一致",
    );
  });
});
