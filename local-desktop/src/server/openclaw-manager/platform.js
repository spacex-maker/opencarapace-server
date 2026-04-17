/**
 * openclaw-manager 平台调度：按 process.platform 加载对应实现。
 *
 * Windows → openclaw-manager-win.js
 * macOS / Linux → openclaw-manager-darwin.js
 */
module.exports = process.platform === "win32"
  ? require("./win.js")
  : require("./darwin.js");
