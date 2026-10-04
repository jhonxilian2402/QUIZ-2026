"use client";

import { useEffect, useRef, useState } from "react";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./orbShader";
import styles from "./WelcomeOrb.module.css";

type WelcomeOrbProps = {
  /** Diameter in CSS pixels. Kept small so the orb stays an accent. */
  size?: number;
  label?: string;
};

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Small refractive orb used as the focal accent above the greeting.
 *
 * Rendered as a single fragment-shader quad: soft studio lighting, saturated
 * internal flow, restrained specular highlight and contact shadow. Falls back
 * to layered CSS gradients whenever WebGL is unavailable or the user asked
 * for reduced motion.
 */
export function WelcomeOrb({ size = 84, label = "AI Assistant" }: WelcomeOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });

    if (!gl) {
      setGlFailed(true);
      return;
    }

    const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) {
      setGlFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setGlFailed(true);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setGlFailed(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let frame = 0;
    let disposed = false;
    let start = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = (now: number) => {
      if (disposed) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduceMotion) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    if (reduceMotion) {
      start = performance.now();
      draw(start);
    } else {
      frame = window.requestAnimationFrame(draw);
    }

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else if (!reduceMotion) {
        start = performance.now();
        frame = window.requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={styles.orb} style={{ width: size + 10, height: size + 10 }}>
      {glFailed ? (
        <div className={styles.layer} style={{ width: size, height: size }} aria-hidden>
          <div className={styles.sheen} />
          <div className={styles.rim} />
          <div className={styles.volume} />
          <div className={styles.edge} />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ width: size + 10, height: size + 10 }}
          aria-hidden
        />
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}