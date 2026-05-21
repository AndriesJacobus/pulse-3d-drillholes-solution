import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

const DURATION_MS = 700;
const START_RES = 3;
const FADE_AT = 0.65;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function PixelOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const { width: w, height: h } = parent.getBoundingClientRect();
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const sctx = src.getContext('2d')!;
    sctx.fillStyle = '#1a1510';
    sctx.fillRect(0, 0, w, h);

    const imgData = sctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = Math.random();
      if (r < 0.04) {
        px[i] = 180 + Math.floor(Math.random() * 75);
        px[i + 1] = 130 + Math.floor(Math.random() * 67);
        px[i + 2] = Math.floor(Math.random() * 61);
      } else {
        const base = 16 + Math.floor(Math.random() * 22);
        px[i] = base;
        px[i + 1] = Math.max(0, base - 2);
        px[i + 2] = Math.max(0, base - 5);
      }
    }
    sctx.putImageData(imgData, 0, 0);

    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d')!;

    let animId = 0;
    const t0 = performance.now();

    function draw(now: number) {
      const elapsed = now - t0;

      if (elapsed >= DURATION_MS) {
        ctx.clearRect(0, 0, w, h);
        return;
      }

      const raw = elapsed / DURATION_MS;
      const eased = smoothstep(raw);

      const tw = Math.max(START_RES, Math.round(START_RES * Math.pow(w / START_RES, eased)));
      const th = Math.max(START_RES, Math.round(START_RES * Math.pow(h / START_RES, eased)));

      tmp.width = tw;
      tmp.height = th;
      tctx.drawImage(src, 0, 0, tw, th);

      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = raw > FADE_AT ? 1 - smoothstep((raw - FADE_AT) / (1 - FADE_AT)) : 1;
      ctx.drawImage(tmp, 0, 0, tw, th, 0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 10 }}
    />
  );
}

export function PdfViewer() {
  const pdfPage = useStore((s) => s.pdfPage);
  const setPdfPage = useStore((s) => s.setPdfPage);
  const prevPage = useRef(pdfPage);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    if (prevPage.current !== null && pdfPage !== null && pdfPage !== prevPage.current) {
      setTransitionKey((k) => k + 1);
    }
    prevPage.current = pdfPage;
  }, [pdfPage]);

  if (pdfPage === null) return null;

  const url = `/api/source-pdf#page=${pdfPage}&navpanes=0&toolbar=0`;

  return (
    <div
      className="flex flex-1 flex-col border-t border-border-default bg-bg-surface"
      style={{ minHeight: '400px' }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-text-secondary">Source PDF (page {pdfPage})</span>
        <button
          onClick={() => setPdfPage(null)}
          className="rounded px-2 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
        >
          Close
        </button>
      </div>
      <div className="relative flex-1" style={{ minHeight: '350px' }}>
        <object
          key={pdfPage}
          data={url}
          type="application/pdf"
          className="h-full w-full border-0"
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 text-xs text-blue-400 underline"
          >
            Open PDF in new tab (page {pdfPage})
          </a>
        </object>
        {transitionKey > 0 && <PixelOverlay key={transitionKey} />}
      </div>
    </div>
  );
}
