import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE_DOC_PATH = "docs/release.md";
const PACKAGE_PATH = "package.json";
const START_MARKER = "<!-- semantic-release:current-release:start -->";
const END_MARKER = "<!-- semantic-release:current-release:end -->";

function fail(message) {
  throw new Error(`[release-doc] ${message}`);
}

function findMarker(content, marker) {
  const matches = [];
  let searchFrom = 0;

  while (searchFrom <= content.length) {
    const markerIndex = content.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const lineStart = content.lastIndexOf("\n", markerIndex - 1) + 1;
    const lineBreak = content.indexOf("\n", markerIndex + marker.length);
    const lineEnd = lineBreak === -1 ? content.length : lineBreak;
    const rawLine = content.slice(lineStart, lineEnd);
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (line !== marker) {
      fail(`${RELEASE_DOC_PATH} 中的 marker 必须独占一行：${marker}`);
    }

    matches.push({ lineStart, lineBreak });
    searchFrom = markerIndex + marker.length;
  }

  if (matches.length !== 1) {
    fail(`${RELEASE_DOC_PATH} 中必须恰好存在一个 marker：${marker}`);
  }

  return matches[0];
}

function inspectReleaseBlock(content) {
  const start = findMarker(content, START_MARKER);
  const end = findMarker(content, END_MARKER);

  if (start.lineBreak === -1) {
    fail(`${RELEASE_DOC_PATH} 的起始 marker 后必须换行`);
  }
  if (start.lineBreak >= end.lineStart) {
    fail(`${RELEASE_DOC_PATH} 的 release marker 顺序无效`);
  }

  const eol = content[start.lineBreak - 1] === "\r" ? "\r\n" : "\n";
  return {
    bodyStart: start.lineBreak + 1,
    bodyEnd: end.lineStart,
    eol,
  };
}

function assertVersion(version) {
  if (
    typeof version !== "string" ||
    version.length === 0 ||
    version.trim() !== version ||
    /[\r\n]/u.test(version)
  ) {
    fail("semantic-release 未提供有效的 nextRelease.version");
  }
}

function renderReleaseBody(version, eol) {
  return [
    "",
    `当前发布标签：\`v${version}\``,
    `\`${PACKAGE_PATH}\` 版本：\`${version}\``,
    "",
    "",
  ].join(eol);
}

async function loadReleaseFiles(cwd) {
  if (typeof cwd !== "string" || cwd.length === 0) {
    fail("semantic-release 未提供有效的 cwd");
  }

  const releaseDocPath = path.resolve(cwd, RELEASE_DOC_PATH);
  const packagePath = path.resolve(cwd, PACKAGE_PATH);
  let releaseDoc;
  let packageText;

  try {
    [releaseDoc, packageText] = await Promise.all([
      readFile(releaseDocPath, "utf8"),
      readFile(packagePath, "utf8"),
    ]);
  } catch (error) {
    fail(`无法读取 ${RELEASE_DOC_PATH} 或 ${PACKAGE_PATH}：${error.message}`);
  }

  let packageJson;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    fail(`${PACKAGE_PATH} 不是有效 JSON：${error.message}`);
  }

  const block = inspectReleaseBlock(releaseDoc);
  return { releaseDocPath, releaseDoc, packageJson, block };
}

export async function verifyConditions(_pluginConfig, context) {
  const { releaseDoc, packageJson, block } = await loadReleaseFiles(
    context?.cwd,
  );
  const version = packageJson.version;
  assertVersion(version);

  const currentBody = releaseDoc.slice(block.bodyStart, block.bodyEnd);
  if (currentBody !== renderReleaseBody(version, block.eol)) {
    fail(
      `${RELEASE_DOC_PATH} 的发布区块必须与 ${PACKAGE_PATH} 版本 ${version} 一致`,
    );
  }
}

export async function prepare(_pluginConfig, context) {
  const version = context?.nextRelease?.version;
  assertVersion(version);

  const { releaseDocPath, releaseDoc, packageJson, block } =
    await loadReleaseFiles(context?.cwd);
  if (packageJson.version !== version) {
    fail(
      `${PACKAGE_PATH} 版本为 ${String(packageJson.version)}，预期 npm prepare 已更新为 ${version}`,
    );
  }

  const body = renderReleaseBody(version, block.eol);
  const updated =
    releaseDoc.slice(0, block.bodyStart) +
    body +
    releaseDoc.slice(block.bodyEnd);

  if (updated !== releaseDoc) {
    await writeFile(releaseDocPath, updated, "utf8");
  }
}

export const releaseDocMarkers = {
  start: START_MARKER,
  end: END_MARKER,
};
