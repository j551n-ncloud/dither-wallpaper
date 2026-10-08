# dither-wallpaper

The animated dither field from the [j551n.com](https://j551n.com) hero as a seamless looping video for macOS: as desktop wallpaper, lock screen and screen saver.

## Render

```sh
npm install
npm run setup                 # downloads Playwright's Chromium, once
npm run render                # 1920x1080 @2x = 3840x2160
node render.mjs --width 1280 --height 832 --scale 2   # e.g. MacBook Air 13" (2560x1664)
```

Output in `out/`:

| File | Format | Use |
|---|---|---|
| `wallpaper.mov` | HEVC, 30 fps, 12 s loop | wallpaper apps |
| `aerial.mov` | HEVC Main 10, bt709, 240 fps, 5 min | lock screen / screen saver |

Rendering runs on the GPU (Chrome with `--use-angle=metal`) at low priority with short breaks, about 3 minutes for 4K. The software renderer (swiftshader) gets the CPU very hot, so check the `renderer:` line says Metal.

The field loops every 12 s, so 180 frames at 15 fps make one seamless loop.

## Lock screen and screen saver

macOS has no setting for your own video, only Apple's aerials move on the lock screen. `set-lockscreen-video.sh` swaps the **Golden Gate Sunset** aerial for `out/aerial.mov`:

1. System Settings → Wallpaper → pick **Golden Gate Sunset** and let it download.
2. `./set-lockscreen-video.sh` (or pass another video path).
3. Pick another wallpaper and Golden Gate Sunset again, or log out and in.

Undo with `./set-lockscreen-video.sh restore` (Apple's original is kept in `~/Downloads/aerial-backup/`). Run it again if a macOS update brings the bridge back.

Two things that break it:

- **Replacing the file.** Apple's aerials carry `LastETag`/`SourceURL` extended attributes. A new file without them counts as missing and gets re-downloaded within seconds, so the script writes into the existing file instead.
- **Wrong format.** The screen saver shows black unless the video matches Apple's aerials (HEVC Main 10, bt709, 240 fps, 5 minutes). `aerial.mov` is encoded that way.

Tested on macOS 27.2, where aerials live in `~/Library/Application Support/com.apple.wallpaper/aerials/videos/`. This is unofficial and may stop working with a macOS update.

## Files

- `page/field.js`: WebGL2 dither field, extracted from `site/components/DitherField.tsx` in the homepage repo
- `page/index.html`: background photo, overlay and field; open it through a local server to watch it live
- `render.mjs`: steps through the loop frame by frame, screenshots and encodes with `hevc_videotoolbox`
- `set-lockscreen-video.sh`: aerial swap

Requires Node 22, ffmpeg with VideoToolbox (`brew install ffmpeg`), macOS on Apple silicon.
