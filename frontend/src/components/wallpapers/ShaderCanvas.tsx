import { useEffect, useRef } from 'react';
import type { WallpaperId } from './types';
import { VERTEX_SHADER, getFragmentShader } from './shaderSources';

type ShaderCanvasProps = {
  shaderId: WallpaperId;
  className?: string;
  /** Track pointer on this element (gallery). When false, listens on document. */
  interactiveTarget?: 'self' | 'document';
  dprCap?: number;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('Shader compile:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('Program link:', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export function ShaderCanvas({
  shaderId,
  className,
  interactiveTarget = 'self',
  dprCap = 2,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    mouse: { x: 0.5, y: 0.5 },
    clickTime: -1,
    clickPos: { x: 0.5, y: 0.5 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, getFragmentShader(shaderId));
    if (!vs || !fs) return;
    const prog = linkProgram(gl, vs, fs);
    if (!prog) return;

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uClick = gl.getUniformLocation(prog, 'u_click');

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const pw = Math.max(1, Math.floor(w * dpr));
      const ph = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      gl.viewport(0, 0, pw, ph);
    };

    const onMove = (clientX: number, clientY: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      stateRef.current.mouse = {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      };
    };

    const onClick = (clientX: number, clientY: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      const s = stateRef.current;
      s.clickPos = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
      s.clickTime = performance.now() / 1000;
    };

    const trackEl = interactiveTarget === 'document' ? document.documentElement : canvas;
    const moveHandler = (e: MouseEvent) => onMove(e.clientX, e.clientY, canvas);
    const clickHandler = (e: MouseEvent) => onClick(e.clientX, e.clientY, canvas);

    trackEl.addEventListener('mousemove', moveHandler);
    trackEl.addEventListener('click', clickHandler);
    window.addEventListener('resize', resize);
    resize();

    let raf = 0;
    const start = performance.now();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = (performance.now() - start) / 1000;
      const s = stateRef.current;
      const clickAge = s.clickTime < 0 ? -1 : t - s.clickTime;
      if (clickAge > 4) s.clickTime = -1;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, s.mouse.x, s.mouse.y);
      gl.uniform3f(
        uClick,
        s.clickPos.x,
        s.clickPos.y,
        clickAge < 0 ? -1 : clickAge,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      trackEl.removeEventListener('mousemove', moveHandler);
      trackEl.removeEventListener('click', clickHandler);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [shaderId, interactiveTarget, dprCap]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
