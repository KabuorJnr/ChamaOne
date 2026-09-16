import { useEffect, useRef } from 'react';

// Renders a word as a cloud of particles that fly in and assemble into the
// text (reactbits-style particle text), then gently shimmer. Pure canvas — no
// dependency. Falls back to plain text when reduced motion is requested.
export default function ParticleText({
  text = 'ChamaOne',
  color = '#F8FAFC',
  height = 58,
  className,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth || 280;
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // 1) Draw the target text off-screen and sample its pixels.
    ctx.clearRect(0, 0, W, H);
    ctx.font = `800 ${Math.floor(H * 0.72)}px -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(text, W / 2, H / 2 + 1);
    const img = ctx.getImageData(0, 0, W * dpr, H * dpr).data;
    ctx.clearRect(0, 0, W, H);

    const gap = 3;
    const targets = [];
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        const idx = (Math.floor(y * dpr) * (W * dpr) + Math.floor(x * dpr)) * 4;
        if (img[idx + 3] > 130) targets.push({ x, y });
      }
    }
    if (!targets.length) { // font not ready / empty — just print text
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, H / 2 + 1);
      return;
    }

    const parts = targets.map((t) => ({
      x: reduce ? t.x : W / 2 + (Math.random() - 0.5) * W,
      y: reduce ? t.y : H / 2 + (Math.random() - 0.5) * H * 3,
      tx: t.x, ty: t.y,
      p: Math.random() * Math.PI * 2, // phase for the idle shimmer
    }));

    let raf;
    let start = performance.now();
    const draw = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      let settled = true;
      for (const pt of parts) {
        pt.x += (pt.tx - pt.x) * 0.09;
        pt.y += (pt.ty - pt.y) * 0.09;
        const d = Math.abs(pt.tx - pt.x) + Math.abs(pt.ty - pt.y);
        if (d > 0.4) settled = false;
        // gentle shimmer once assembled
        const j = settled ? Math.sin(elapsed / 600 + pt.p) * 0.4 : 0;
        ctx.fillRect(pt.x, pt.y + j, 1.7, 1.7);
      }
      // keep a slow shimmer loop after assembly, but stop the heavy easing work
      if (!settled || elapsed < 6000) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [text, color, height]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={text}
      className={className}
      style={{ width: '100%', height, display: 'block' }}
    />
  );
}
