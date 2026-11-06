import sharp from "sharp";
import pngToIco from "png-to-ico";
import {writeFile} from "node:fs/promises";
const source="public/logo-source.png";
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=-1,bottom=-1;
// Locate visible artwork without letting nearly transparent edge noise
// expand the icon canvas. Keep the original pixels within a safety margin.
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
if(right<left)throw new Error("Logo has no visible artwork.");
left=Math.max(0,left-8);top=Math.max(0,top-8);right=Math.min(info.width-1,right+8);bottom=Math.min(info.height-1,bottom+8);
const mark=await sharp(source).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(430,430,{fit:"inside"}).png().toBuffer();
const icon=await sharp({create:{width:512,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:mark,gravity:"centre"}]).png().toBuffer();
await writeFile("public/icon.png",icon);
const sizes=[16,24,32,48,64,128,256];
const frames=await Promise.all(sizes.map(size=>sharp(icon).resize(size,size).png().toBuffer()));
await writeFile("public/icon.ico",await pngToIco(frames));
console.log(`Created 512px transparent icon and Windows ICO frames: ${sizes.join(", ")}.`);
