// Renders one seamless 12 s loop of the dither field and encodes it for macOS.
// Usage: node render.mjs [--width 1920] [--height 1080] [--scale 2]   (CHROME=/path overrides the browser)
// Output in out/: wallpaper.mov (30 fps, for wallpaper apps) and aerial.mov (Apple aerial format).
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const { values: a } = parseArgs({
  options: {
    width: { type: "string", default: "1920" },
    height: { type: "string", default: "1080" },
    scale: { type: "string", default: "2" },
  },
});
const W = +a.width, H = +a.height, S = +a.scale;
const FPS = 15, N = 12 * FPS; // the field loops every 12 s at 15 fps, frame N equals frame 0
const root = fileURLToPath(new URL(".", import.meta.url));
const frames = join(root, "out/frames");
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

// module scripts don't load from file://, so serve the page
const types = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  try {
    const path = req.url === "/" ? "/index.html" : req.url;
    const body = await readFile(join(root, "page", path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);

// Metal keeps the rendering on the GPU; the software fallback (swiftshader) runs hot on the CPU
const browser = await chromium.launch({ channel: "chromium", executablePath: process.env.CHROME, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: S });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: "networkidle" });
if (!await page.evaluate(() => window.fieldReady)) throw new Error("WebGL2 field failed to start");
console.log("renderer:", await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  return gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info").UNMASKED_RENDERER_WEBGL);
}));

for (let i = 0; i < N; i++) {
  await page.evaluate((t) => window.drawAt(t), i / FPS);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.png`) });
  if (i % 30 === 29) { process.stdout.write(`${i + 1}/${N}\n`); await new Promise((r) => setTimeout(r, 2000)); }
}
await browser.close();
server.close();

const ff = (...args) => execFileSync("nice", ["-n", "19", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const out = (f) => join(root, "out", f);
const tags = "setparams=range=tv:colorspace=bt709:color_trc=bt709:color_primaries=bt709";
const color = ["-color_range", "tv", "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709"];

ff("-framerate", `${FPS}`, "-i", join(frames, "f%04d.png"), "-vf", `fps=30,format=yuv420p,${tags}`,
  "-c:v", "hevc_videotoolbox", "-b:v", "16M", "-tag:v", "hvc1", ...color, "-movflags", "+faststart+write_colr", out("wallpaper.mov"));

// the lock screen and screen saver only play videos shaped like Apple's aerials:
// HEVC Main 10, bt709, 240 fps, 5 minutes. Encode one loop, then repeat it without re-encoding.
ff("-framerate", `${FPS}`, "-i", join(frames, "f%04d.png"), "-vf", `fps=240,format=p010le,${tags}`,
  "-c:v", "hevc_videotoolbox", "-profile:v", "main10", "-b:v", "6M", "-g", "240", "-tag:v", "hvc1", ...color, out("loop240.mov"));
ff("-stream_loop", "24", "-i", out("loop240.mov"), "-c", "copy", "-tag:v", "hvc1", ...color,
  "-movflags", "+faststart+write_colr", out("aerial.mov"));

await rm(out("loop240.mov"));
await rm(frames, { recursive: true });
console.log("done: out/wallpaper.mov, out/aerial.mov");
