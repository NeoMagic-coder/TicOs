import type { WallpaperId } from './types';

/** Shared fullscreen triangle — no buffer needed. */
export const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_HEADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_click; /* xy position, z = seconds since click (negative = idle) */

vec2 uv() {
  return gl_FragCoord.xy / u_resolution;
}

vec2 aspect(vec2 p) {
  vec2 r = u_resolution;
  float aspect = r.x / r.y;
  return vec2(p.x * aspect, p.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
`;

const NEURAL_GRID = `
${FRAG_HEADER}
float gridLine(vec2 p, float scale) {
  vec2 g = abs(fract(p * scale - 0.5) - 0.5) / fwidth(p * scale);
  return 1.0 - min(min(g.x, g.y), 1.0);
}

void main() {
  vec2 u = uv();
  vec2 p = aspect(u - 0.5);
  vec2 m = aspect(u_mouse - 0.5);
  vec2 toM = p - m;
  float distM = length(toM);

  float warp = exp(-distM * 3.2) * 0.35;
  vec2 wob = normalize(toM + 0.001) * warp * sin(u_time * 2.0 + distM * 8.0);
  p += wob;

  float z = 1.0 / (1.0 + length(p) * 1.8);
  vec2 gp = p * (4.0 + z * 6.0);
  float g = gridLine(gp, 1.0) * 0.55 + gridLine(gp, 4.0) * 0.25;

  float pulse = 0.0;
  if (u_click.z >= 0.0) {
    vec2 cp = aspect(u_click.xy - 0.5);
    float ring = abs(length(p - cp) - u_click.z * 0.45);
    pulse = exp(-ring * 28.0) * exp(-u_click.z * 1.2);
  }

  vec3 base = vec3(0.04, 0.06, 0.10);
  vec3 acid = vec3(0.78, 1.0, 0.24);
  vec3 violet = vec3(0.61, 0.48, 1.0);
  float glow = exp(-distM * 2.5) * 0.9;
  vec3 col = base + acid * g * (0.35 + glow * 0.65) + violet * g * 0.15;
  col += acid * pulse * 1.2;
  col += vec3(0.02, 0.04, 0.08) * z;
  gl_FragColor = vec4(col, 1.0);
}
`;

const PLASMA_VOID = `
${FRAG_HEADER}
void main() {
  vec2 u = uv();
  vec2 p = aspect(u);
  vec2 m = aspect(u_mouse);
  vec2 d = p - m;
  float dist = length(d);

  float t = u_time * 0.35;
  float v = 0.0;
  v += sin(p.x * 3.0 + t);
  v += sin(p.y * 4.0 + t * 1.3);
  v += sin((p.x + p.y) * 2.5 - t * 0.8);
  v += sin(length(p - m) * 12.0 - t * 4.0) * exp(-dist * 2.0);
  v += sin(dist * 18.0 - t * 5.0) * exp(-dist * 1.5) * 1.5;

  if (u_click.z >= 0.0) {
    vec2 cp = aspect(u_click.xy);
    float burst = exp(-length(p - cp) * 3.0) * sin(u_click.z * 20.0) * exp(-u_click.z * 2.0);
    v += burst * 2.5;
  }

  float n = v * 0.25 + 0.5;
  vec3 c1 = vec3(0.08, 0.12, 0.22);
  vec3 c2 = vec3(0.61, 0.48, 1.0);
  vec3 c3 = vec3(0.78, 1.0, 0.24);
  vec3 c4 = vec3(0.26, 0.83, 1.0);
  vec3 col = mix(c1, c2, smoothstep(0.2, 0.55, n));
  col = mix(col, c3, smoothstep(0.45, 0.75, n) * (0.5 + exp(-dist * 1.8) * 0.5));
  col = mix(col, c4, smoothstep(0.7, 1.0, n) * 0.4);
  col *= 0.85 + exp(-dist * 2.2) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

const PARTICLE_SWARM = `
${FRAG_HEADER}
void main() {
  vec2 u = uv();
  vec2 p = aspect(u);
  vec2 m = aspect(u_mouse);
  vec3 col = vec3(0.03, 0.05, 0.09);

  for (int i = 0; i < 48; i++) {
    float fi = float(i);
    vec2 seed = vec2(hash(vec2(fi, 1.7)), hash(vec2(fi, 9.2)));
    vec2 pos = seed;
    pos += 0.15 * sin(u_time * 0.4 + fi * 1.3 + seed * 6.0);
    vec2 toM = m - pos;
    pos += normalize(toM + 0.01) * exp(-length(toM) * 2.0) * 0.12;

    if (u_click.z >= 0.0) {
      vec2 cp = aspect(u_click.xy);
      vec2 fromBurst = pos - cp;
      float burst = exp(-u_click.z * 2.5);
      pos += normalize(fromBurst + 0.01) * burst * 0.35 * sin(fi + u_click.z * 10.0);
    }

    float d = length(p - pos);
    float sz = 0.003 + hash(seed) * 0.004;
    float b = smoothstep(sz, 0.0, d);
    vec3 pc = mix(vec3(0.61, 0.48, 1.0), vec3(0.78, 1.0, 0.24), hash(seed + 0.5));
    col += pc * b * (0.35 + hash(fi) * 0.4);
  }

  float glow = exp(-length(p - m) * 4.0);
  col += vec3(0.78, 1.0, 0.24) * glow * 0.25;
  col = min(col, vec3(1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const HEX_LATTICE = `
${FRAG_HEADER}
vec2 hexCoord(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 h = vec2(p.x + p.y * 0.5, p.y) / s;
  vec2 i = floor(h);
  vec2 f = fract(h);
  float o = step(f.y, f.x);
  vec2 a = vec2(o, 1.0 - o);
  vec2 b = vec2(1.0 - o, o);
  vec2 g = mix(vec2(i.x, i.y), vec2(i.x + o, i.y + 1.0 - o), o);
  vec2 c = mix(f, f - a, o);
  return g + c;
}

void main() {
  vec2 u = uv();
  vec2 p = aspect(u - 0.5) * 5.0;
  vec2 m = aspect(u_mouse - 0.5) * 5.0;
  vec2 hc = hexCoord(p);
  vec2 cell = hexCoord(p) - hexCoord(p + 0.01);
  float edge = length(cell) * 40.0;
  float cellId = hash(floor(hc * 3.0));

  float distM = length(p - m);
  float near = exp(-distM * 0.8);
  float pulse = 0.0;
  if (u_click.z >= 0.0) {
    vec2 cp = aspect(u_click.xy - 0.5) * 5.0;
    pulse = exp(-length(p - cp) * 0.6) * sin(u_click.z * 15.0) * exp(-u_click.z * 1.8);
  }

  float edgeGlow = smoothstep(0.85, 0.2, edge);
  vec3 base = vec3(0.05, 0.07, 0.11);
  vec3 acid = vec3(0.78, 1.0, 0.24);
  vec3 cyan = vec3(0.26, 0.83, 1.0);
  vec3 col = base;
  col += acid * edgeGlow * (0.15 + near * 0.85 + cellId * 0.1);
  col += cyan * edgeGlow * near * 0.35;
  col += acid * pulse * 0.5;
  col += vec3(0.61, 0.48, 1.0) * near * 0.08;
  gl_FragColor = vec4(col, 1.0);
}
`;

const AURORA_FLOW = `
${FRAG_HEADER}
float wave(vec2 p, float t, float freq, float speed) {
  return sin(p.x * freq + t * speed + sin(p.y * 2.0 + t)) * 0.5 + 0.5;
}

void main() {
  vec2 u = uv();
  vec2 p = aspect(u);
  vec2 m = aspect(u_mouse);
  vec2 d = p - m;
  float dist = length(d);
  float t = u_time * 0.25;

  float bend = exp(-dist * 2.5) * 0.15;
  p += normalize(d + 0.001) * bend * sin(t * 3.0);

  float a1 = wave(p + vec2(0.0, sin(t) * 0.1), t, 4.0, 1.2);
  float a2 = wave(p + vec2(sin(t * 0.7) * 0.1, 0.0), t * 1.1, 5.5, -0.9);
  float a3 = wave(p * 1.2, t * 0.8, 3.2, 1.5);

  if (u_click.z >= 0.0) {
    vec2 cp = aspect(u_click.xy);
    float ripple = sin(length(p - cp) * 25.0 - u_click.z * 12.0) * exp(-length(p - cp) * 2.0) * exp(-u_click.z * 1.5);
    a1 += ripple * 0.6;
    a2 += ripple * 0.4;
  }

  vec3 c0 = vec3(0.04, 0.06, 0.12);
  vec3 c1 = vec3(0.61, 0.48, 1.0);
  vec3 c2 = vec3(0.26, 0.83, 1.0);
  vec3 c3 = vec3(0.78, 1.0, 0.24);
  vec3 col = c0;
  col = mix(col, c1, smoothstep(0.3, 0.7, a1) * 0.7);
  col = mix(col, c2, smoothstep(0.35, 0.75, a2) * 0.6);
  col = mix(col, c3, smoothstep(0.5, 0.9, a3) * (0.35 + exp(-dist * 2.0) * 0.4));
  col *= 0.9 + sin(t + p.y * 3.0) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

const SOURCES: Record<WallpaperId, string> = {
  'neural-grid': NEURAL_GRID,
  'plasma-void': PLASMA_VOID,
  'particle-swarm': PARTICLE_SWARM,
  'hex-lattice': HEX_LATTICE,
  'aurora-flow': AURORA_FLOW,
};

export function getFragmentShader(id: WallpaperId): string {
  return SOURCES[id];
}
