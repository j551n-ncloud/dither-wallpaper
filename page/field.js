// Dither field from j551n.com (site/components/DitherField.tsx), framework-free
const TRAIL = 16;
const FPS = 15;
const PERIOD = 12;
const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uGridY;
uniform float uCell;
uniform float uDot;
uniform vec4 uT;
uniform float uWob;
uniform float uBase;
uniform vec3 uTint;
uniform vec2 uAngle;
uniform vec3 uCursor;
uniform float uRadius;
uniform vec3 uTrail[${TRAIL}];
uniform int uTrailCount;

out vec4 outColor;

// accent ramp, blue to teal
const vec3 STOPS[5] = vec3[5](
  vec3(0.000, 0.278, 0.702),
  vec3(0.122, 0.435, 0.820),
  vec3(0.231, 0.608, 0.878),
  vec3(0.298, 0.780, 0.847),
  vec3(0.369, 0.918, 0.831)
);

float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(a * 0.5) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(a * 0.5) * 0.25 + bayer2(a); }
float hash2(vec2 p) { return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453); }
float gauss(vec2 d, float r) { return exp(-dot(d, d) / (r * r)); }

// domain-warped sine stack; time terms are integer harmonics of the period so the loop is seamless
float fieldAt(vec2 ic) {
  vec2 g = ic / uGridY;
  float nx = g.x * uAngle.x - g.y * uAngle.y;
  float ny = g.x * uAngle.y + g.y * uAngle.x;
  float wx = nx + 0.16 * sin(ny * 5.1 + uT.y) + 0.09 * cos(ny * 9.4 - uT.x);
  float wy = ny + 0.13 * cos(nx * 4.3 - uT.z) + 0.07 * sin(nx * 8.1 + uT.y);
  float n = 0.5 + (
    0.5 * sin(wx * 5.8 + wy * 3.2 + uT.x) +
    0.3 * sin(wx * 11.9 - wy * 7.4 - uT.y + 1.7) +
    0.2 * sin(wx * 21.3 + wy * 16.7 + uT.w + 0.9)
  ) * 0.5;
  return (n - 0.44 + (hash2(ic) - 0.5) * 0.16) * 2.0;
}

// premultiplied "over": the canvas is transparent so the hero photo shows between the dots
void over(inout vec4 acc, vec3 c, float a) { acc = vec4(c * a, a) + acc * (1.0 - a); }

bool inSquare(vec2 inCell, float size) {
  float off = (uCell - size) * 0.5;
  return all(greaterThanEqual(inCell, vec2(off))) && all(lessThan(inCell, vec2(off + size)));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 ic = floor(frag / uCell);
  vec2 inCell = frag - ic * uCell;
  vec2 center = ic * uCell + uCell * 0.5;
  float bayer = bayer8(ic) + 0.0078125;
  float amp = uCursor.z;

  vec4 col = vec4(0.0);

  float v = fieldAt(ic);
  if (v > bayer && inSquare(inCell, uDot)) {
    float bucket = v < 0.3 ? 0.34 : (v < 0.62 ? 0.66 : 1.0);
    over(col, uTint, clamp(uBase * bucket, 0.0, 1.0));
  }

  if (amp > 0.01) {
    float glow = length(frag - uCursor.xy) / (uRadius * 1.6);
    over(col, STOPS[1], clamp(1.0 - glow / 0.72, 0.0, 1.0) * 0.12 * amp);

    for (int i = 0; i < ${TRAIL}; i++) {
      if (i >= uTrailCount) break;
      vec3 mk = uTrail[i];
      float ta = mk.z * mk.z * amp;
      if (ta < 0.04) continue;
      float rr = uRadius * 0.42 * (0.45 + 0.55 * mk.z) * (1.0 + (1.0 - mk.z) * 0.8);
      vec2 d = (center - mk.xy) / rr;
      if (dot(d, d) > 4.0) continue;
      float m = gauss(d, 0.7) * ta;
      float hh = hash2(ic + vec2(float(i) * 37.0, 3.0));
      if (m <= 0.02 || m <= bayer * 1.25 + (hh - 0.5) * 0.4 || !inSquare(inCell, uDot)) continue;
      int bi = int(clamp(floor((0.35 + d.y * 0.4 + (hh - 0.5) * 0.5) * 5.0), 0.0, 4.0));
      over(col, STOPS[bi], 0.5 * amp);
    }

    vec2 p = (center - uCursor.xy) / uRadius;
    float wobble = 0.84 + 0.3 * sin(p.x * 6.5 + p.y * 5.2 + uWob) * cos(p.y * 4.1 - uWob * 0.6);
    float m = clamp((gauss(vec2(p.x * 0.92, p.y), 0.66) * wobble - 0.3) * 1.7, 0.0, 1.0) * amp;
    float hh = hash2(ic + vec2(13.0, 29.0));
    if (m > 0.02 && m > bayer * 1.15 + (hh - 0.5) * 0.3) {
      float size = uDot + (uCell - uDot) * 0.25 * clamp((m - 0.55) / 0.45, 0.0, 1.0);
      if (inSquare(inCell, size)) {
        float q = clamp((p.y + 0.95 + p.x * 0.16) / 1.9 + (hh - 0.5) * 0.26, 0.0, 1.0);
        over(col, STOPS[int(min(floor(q * 5.0), 4.0))], 0.8 * amp);
      }
    }
  }

  outColor = col;
}`;
export const hex = (h) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
function compile(gl, type, src) {
    const s = gl.createShader(type);
    if (!s)
        return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS))
        return s;
    console.error("[DitherField]", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
}
export function createField(canvas, o) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl)
        return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !prog)
        return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        return null;
    const u = (n) => gl.getUniformLocation(prog, n);
    const U = {
        res: u("uRes"), gridY: u("uGridY"), cell: u("uCell"), dot: u("uDot"), t: u("uT"), wob: u("uWob"),
        base: u("uBase"), tint: u("uTint"), angle: u("uAngle"),
        cursor: u("uCursor"), radius: u("uRadius"), trail: u("uTrail"), trailCount: u("uTrailCount"),
    };
    const vao = gl.createVertexArray();
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform3fv(U.tint, o.tint);
    const a = o.angle * Math.PI / 180;
    gl.uniform2f(U.angle, Math.cos(a), Math.sin(a));
    const w = Math.PI * 2 / PERIOD;
    const wave = (t, ph) => .5 + .5 * Math.sin(t * w + ph);
    const trailBuf = new Float32Array(TRAIL * 3);
    const c = { x: 0, y: 0, tx: 0, ty: 0, amp: 0, speed: 0, inside: false, trail: [] };
    let size = [0, 0], dpr = 1, raf = 0, start = 0, elapsed = 0, last = 0, lastFrame = -1, running = false, dead = false;
    const draw = (t) => {
        t %= PERIOD;
        gl.uniform4f(U.t, w * t, 2 * w * t, 3 * w * t, 5 * w * t);
        gl.uniform1f(U.wob, t * 1.4);
        gl.uniform1f(U.base, o.intensity * (.82 + .18 * wave(t, -.6)));
        gl.uniform3f(U.cursor, c.x * dpr, c.y * dpr, c.amp);
        const n = Math.min(c.trail.length, TRAIL);
        for (let i = 0; i < n; i++) {
            const p = c.trail[c.trail.length - n + i];
            trailBuf.set([p.x * dpr, p.y * dpr, p.a], i * 3);
        }
        gl.uniform1i(U.trailCount, n);
        gl.uniform3fv(U.trail, trailBuf);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // eases the cursor state; returns true while it still needs redraws
    const step = (dt) => {
        const k = (r) => 1 - Math.exp(-r * dt);
        c.speed *= Math.exp(-7.7 * dt);
        const target = c.inside ? Math.min(1, c.speed / 6) : 0;
        const px = c.x, py = c.y;
        c.x += (c.tx - c.x) * k(7);
        c.y += (c.ty - c.y) * k(7);
        c.amp += (target - c.amp) * k(target > c.amp ? 1.8 : .72);
        const tail = c.trail[c.trail.length - 1];
        if (c.amp > .05 && Math.hypot(c.x - px, c.y - py) > 1.2 && (!tail || Math.hypot(c.x - tail.x, c.y - tail.y) > 9)) {
            c.trail.push({ x: c.x, y: c.y, a: 1 });
            if (c.trail.length > TRAIL)
                c.trail.shift();
        }
        for (let i = c.trail.length - 1; i >= 0; i--) {
            c.trail[i].a -= .45 * dt;
            if (c.trail[i].a <= 0)
                c.trail.splice(i, 1);
        }
        return c.amp > .005 || Math.abs(target - c.amp) > .002;
    };
    const tick = (now) => {
        raf = requestAnimationFrame(tick);
        if (!start)
            start = now;
        const dt = Math.min(.05, (now - (last || now)) / 1000);
        last = now;
        const moving = o.cursor && step(dt);
        const frame = Math.round((elapsed + (now - start) / 1000) * FPS);
        if (frame === lastFrame && !moving)
            return;
        lastFrame = frame;
        draw(frame / FPS);
    };
    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height)
            return;
        const x = e.clientX - r.left, y = e.clientY - r.top;
        c.inside = x >= 0 && x <= r.width && y >= 0 && y <= r.height;
        c.speed = Math.min(30, c.speed * .75 + Math.hypot(x - c.tx, y - c.ty) * .75);
        c.tx = x;
        c.ty = y;
        if (c.amp < .01) {
            c.x = x;
            c.y = y;
        }
    };
    const onLeave = () => { c.inside = false; };
    if (o.cursor) {
        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("mouseleave", onLeave);
    }
    const now = () => start ? elapsed + (performance.now() - start) / 1000 : elapsed;
    return {
        draw,
        resize(wd, ht) {
            if (dead || !wd || !ht)
                return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const cw = Math.round(wd * dpr), ch = Math.round(ht * dpr);
            // compare against our own size, the canvas may be reused from a previous (StrictMode) mount
            if (cw === size[0] && ch === size[1])
                return;
            size = [cw, ch];
            canvas.width = cw;
            canvas.height = ch;
            gl.viewport(0, 0, cw, ch);
            gl.uniform2f(U.res, cw, ch);
            gl.uniform1f(U.gridY, ch / (o.cell * dpr));
            gl.uniform1f(U.cell, o.cell * dpr);
            gl.uniform1f(U.dot, o.dot * dpr);
            gl.uniform1f(U.radius, o.radius * dpr);
            lastFrame = -1;
            draw(now());
        },
        setRunning(on) {
            if (dead || on === running)
                return;
            running = on;
            if (on) {
                last = 0;
                start = 0;
                raf = requestAnimationFrame(tick);
            }
            else {
                cancelAnimationFrame(raf);
                elapsed = now();
                start = 0;
                lastFrame = -1;
            }
        },
        destroy() {
            this.setRunning(false);
            dead = true;
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("mouseleave", onLeave);
            gl.deleteVertexArray(vao);
            gl.deleteProgram(prog);
        },
    };
}
