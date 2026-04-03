import sharp from "sharp";
import { mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const ICON_SVG = "public/icons/icon-512.svg";
const MASKABLE_SVG = "public/icons/icon-maskable-512.svg";
const RES_DIR = "android/app/src/main/res";

const DENSITIES = [
  { name: "mdpi", size: 48 },
  { name: "hdpi", size: 72 },
  { name: "xhdpi", size: 96 },
  { name: "xxhdpi", size: 144 },
  { name: "xxxhdpi", size: 192 },
];

const FOREGROUND_DENSITIES = [
  { name: "mdpi", size: 108 },
  { name: "hdpi", size: 162 },
  { name: "xhdpi", size: 216 },
  { name: "xxhdpi", size: 324 },
  { name: "xxxhdpi", size: 432 },
];

async function generate() {
  // Read SVGs as buffers to avoid potential file path issues with sharp
  const iconBuffer = readFileSync(ICON_SVG);
  const maskableBuffer = readFileSync(MASKABLE_SVG);

  for (const { name, size } of DENSITIES) {
    const dir = join(RES_DIR, `mipmap-${name}`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(join(dir, "ic_launcher.png"));

    await sharp(maskableBuffer)
      .resize(size, size)
      .png()
      .toFile(join(dir, "ic_launcher_round.png"));
  }

  for (const { name, size } of FOREGROUND_DENSITIES) {
    const dir = join(RES_DIR, `mipmap-${name}`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await sharp(maskableBuffer)
      .resize(size, size)
      .png()
      .toFile(join(dir, "ic_launcher_foreground.png"));
  }

  console.log("Android icons generated successfully.");
}

generate().catch(console.error);
