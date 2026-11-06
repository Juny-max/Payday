import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
await sharp("public/icon.svg").resize(512, 512).png().toFile("public/icon.png");
await writeFile("public/icon.ico", await pngToIco("public/icon.png"));
