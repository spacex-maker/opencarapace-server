/**
 * 从唯一素材 build/icon.png 生成 build/icon.ico（NSIS / 部分 Windows 链路透传 ICO 时用）。
 */
const fs = require("fs");
const png2icons = require("png2icons");
const { absPng, absIco, relPng, relIco } = require("./brand-icon-paths");

if (!fs.existsSync(absPng)) {
  console.error(`[brand-icon] 缺少 ${relPng}，请只维护这一张图`);
  process.exit(1);
}

const png = fs.readFileSync(absPng);
const ico = png2icons.createICO(png, png2icons.BICUBIC2, false);
if (!Buffer.isBuffer(ico) || ico.length === 0) {
  console.error("[brand-icon] PNG → ICO 失败");
  process.exit(1);
}

fs.writeFileSync(absIco, ico);
console.log(`[brand-icon] ${relPng} → ${relIco}`);
