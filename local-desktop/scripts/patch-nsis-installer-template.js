/**
 * 在 app-builder-lib 的 installer.nsi 里，于 MUI2.nsh 之后、assistedInstaller（MUI_PAGE_*）之前插入 Icon。
 * electron-builder 自带的 include 跑在整份 installer.nsi 之前，Icon 会被 MUI2 默认绿盾覆盖。
 *
 * 必须内联 NSIS 代码，禁止 !include 指向项目路径：Windows 上 BUILD_RESOURCES_DIR 为反斜杠，
 * 与 /file.nsh 拼接后 makensis 无法打开文件（混合路径）。
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const installerNsi = path.join(
  rootDir,
  "node_modules",
  "app-builder-lib",
  "templates",
  "nsis",
  "installer.nsi"
);
const srcNsh = path.join(rootDir, "scripts", "nsis", "after-mui2-icon.nsh");

const NEEDLE = '!include "MUI2.nsh"';
const MARKER_START = "; BEGIN_CLAWHEART_AFTER_MUI2_ICON";
const MARKER_END = "; END_CLAWHEART_AFTER_MUI2_ICON";

function buildInlineBlock() {
  const snippet = fs.readFileSync(srcNsh, "utf8").trim();
  return `${MARKER_START}\n${snippet}\n${MARKER_END}`;
}

function stripOldPatch(s) {
  let out = s.replace(
    /\r?\n; BEGIN_CLAWHEART_AFTER_MUI2_ICON[\s\S]*?; END_CLAWHEART_AFTER_MUI2_ICON/g,
    ""
  );
  out = out
    .split(/\r?\n/)
    .filter((line) => !line.includes("after-mui2-icon.nsh"))
    .join("\n");
  return out;
}

function main() {
  if (!fs.existsSync(installerNsi)) {
    console.warn("[patch-nsis] 未找到 installer.nsi，跳过");
    process.exit(0);
  }
  if (!fs.existsSync(srcNsh)) {
    console.warn("[patch-nsis] 未找到 scripts/nsis/after-mui2-icon.nsh，跳过");
    process.exit(0);
  }

  const INLINE_BLOCK = buildInlineBlock();

  let s = fs.readFileSync(installerNsi, "utf8");
  s = stripOldPatch(s);

  if (!s.includes(NEEDLE)) {
    console.warn("[patch-nsis] 未找到 MUI2 行，请核对 electron-builder / app-builder-lib 版本");
    process.exit(0);
  }

  if (s.includes(MARKER_START)) {
    fs.writeFileSync(installerNsi, s, "utf8");
    console.log("[patch-nsis] NSIS 模板已含内联 Icon 补丁");
    process.exit(0);
  }

  s = s.replace(NEEDLE, `${NEEDLE}\n${INLINE_BLOCK}`);
  fs.writeFileSync(installerNsi, s, "utf8");
  console.log("[patch-nsis] 已内联 MUI2 后的 Icon 补丁（无 !include 路径）");
}

main();
