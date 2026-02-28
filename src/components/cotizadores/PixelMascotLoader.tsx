'use client';

import { useEffect, useRef } from 'react';

const pSize = 12;
const cGreen = '#8aaa19';
const cBlue = '#1a2a6c';
const cBlack = '#111';
const cRed = '#d63031';

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * pSize, y * pSize, w * pSize, h * pSize);
}

function drawMascota(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  armPos: 'head' | 'up' | 'mid' | 'down' | 'reach',
  color: string,
  isTired = false
) {
  // Cuerpo (8x7)
  drawRect(ctx, x, y, 8, 7, color);
  // Ojos
  const eyeY = isTired ? y + 4 : y + 3;
  drawRect(ctx, x + 1, eyeY, 1, 1, cBlack);
  drawRect(ctx, x + 6, eyeY, 1, 1, cBlack);
  // Boca (small)
  if (armPos === 'reach') {
    // Determined face — small mouth open
    drawRect(ctx, x + 3, y + 5, 2, 1, cBlack);
  } else if (isTired) {
    // Tired wavy mouth
    drawRect(ctx, x + 3, y + 5, 2, 1, '#666');
  }
  // Patas
  drawRect(ctx, x + 1, y + 7, 2, 2, color);
  drawRect(ctx, x + 5, y + 7, 2, 2, color);
  // Brazos
  if (armPos === 'head') {
    drawRect(ctx, x - 2, y + 1, 2, 2, color);
    drawRect(ctx, x + 8, y + 1, 2, 2, color);
  } else if (armPos === 'up') {
    drawRect(ctx, x - 2, y - 2, 2, 2, color);
    drawRect(ctx, x + 8, y - 2, 2, 2, color);
  } else if (armPos === 'mid') {
    drawRect(ctx, x - 3, y + 2, 3, 2, color);
    drawRect(ctx, x + 8, y + 2, 3, 2, color);
  } else if (armPos === 'down') {
    drawRect(ctx, x - 2, y + 4, 2, 3, color);
    drawRect(ctx, x + 8, y + 4, 2, 3, color);
  } else if (armPos === 'reach') {
    // Arms reaching up and wide for the big weight
    drawRect(ctx, x - 3, y - 3, 3, 2, color);
    drawRect(ctx, x + 8, y - 3, 3, 2, color);
    // Hands gripping up
    drawRect(ctx, x - 4, y - 4, 2, 2, color);
    drawRect(ctx, x + 10, y - 4, 2, 2, color);
  }
}

function drawBanda(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x, y + 1, 8, 1, cBlue);
}

function drawPesasPequenas(ctx: CanvasRenderingContext2D, x: number, y: number, up: boolean) {
  const py = up ? y - 3 : y + 1;
  drawRect(ctx, x - 4, py, 2, 3, cBlack);
  drawRect(ctx, x + 10, py, 2, 3, cBlack);
}

function drawPesaGrande(ctx: CanvasRenderingContext2D, x: number, y: number, liftY: number) {
  const py = y + liftY;
  // Barra
  drawRect(ctx, x - 6, py + 1, 20, 1, '#444');
  // Discos grandes
  drawRect(ctx, x - 8, py - 1, 3, 5, cBlack);
  drawRect(ctx, x + 13, py - 1, 3, 5, cBlack);
}

interface PixelMascotLoaderProps {
  statusText?: string;
  onStatusChange?: (status: string) => void;
  size?: number;
}

export default function PixelMascotLoader({ onStatusChange, size = 256 }: PixelMascotLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const loop = 600;
      const cycle = frameRef.current % loop;
      const mx = 7;
      const my = 10;
      let shake = 0;

      if (cycle < 100) {
        // FASE 1: Poniéndose la banda
        onStatusChange?.('PREPARANDO...');
        const jump = (frameRef.current % 36 < 18) ? -0.5 : 0;
        drawMascota(ctx, mx, my + jump, 'head', cGreen);
        if (cycle > 50) drawBanda(ctx, mx, my + jump);
      } else if (cycle < 240) {
        // FASE 2: Pesas livianas
        onStatusChange?.('CALENTANDO...');
        const isUp = (frameRef.current % 64 < 32);
        drawMascota(ctx, mx, my, isUp ? 'up' : 'mid', cGreen);
        drawBanda(ctx, mx, my);
        drawPesasPequenas(ctx, mx, my, isUp);
      } else if (cycle < 310) {
        // FASE 2.5: Walk toward big weight + reach for it
        onStatusChange?.('¡VAMOS POR LA GRANDE!');
        const reachProgress = (cycle - 240) / 70;
        // Mascot crouches slightly and reaches arms up
        const crouch = Math.sin(reachProgress * Math.PI) * 0.5;
        drawMascota(ctx, mx, my + crouch, 'reach', cGreen);
        drawBanda(ctx, mx, my + crouch);
        // Big weight sitting on ground, mascot getting under it
        const preGrab = Math.max(0, reachProgress - 0.6) * 2.5;
        drawPesaGrande(ctx, mx, my, 8 - preGrab * 2);
      } else if (cycle < 500) {
        // FASE 3: El Gran Reto (lifting)
        onStatusChange?.('¡DALO TODO!');
        const progress = (cycle - 310) / 190;
        const lift = Math.sin(progress * Math.PI) * -5;

        if (progress > 0.2) {
          shake = (frameRef.current % 4 < 2) ? 0.3 : -0.3;
        }

        const isFailing = progress > 0.6;
        const activeColor = (isFailing && frameRef.current % 10 < 5) ? cRed : cGreen;

        drawMascota(ctx, mx + shake, my, 'up', activeColor, isFailing);
        drawBanda(ctx, mx + shake, my);
        drawPesaGrande(ctx, mx + shake, my, lift - 2);

        // Sweat drops when struggling
        if (progress > 0.4 && frameRef.current % 22 < 11) {
          drawRect(ctx, mx - 1, my + 2, 1, 1, '#3498db');
        }
        if (progress > 0.7 && frameRef.current % 16 < 8) {
          drawRect(ctx, mx + 8, my + 3, 1, 1, '#3498db');
        }
      } else {
        // FASE 4: Agotado
        onStatusChange?.('DESCANSANDO...');
        drawMascota(ctx, mx, my + 1, 'down', cGreen, true);
        drawBanda(ctx, mx, my + 1);
        drawPesaGrande(ctx, mx, my, 8);
        // Sweat drop
        if (frameRef.current % 32 < 16) drawRect(ctx, mx + 7, my + 4, 1, 1, '#3498db');
        // Breathing animation
        if (frameRef.current % 48 < 24) drawRect(ctx, mx + 3, my + 7, 2, 1, '#79961a');
      }

      frameRef.current++;
      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [onStatusChange]);

  const scale = size / 256;

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={256}
      style={{
        imageRendering: 'pixelated',
        width: size,
        height: size,
        transform: `scale(${scale >= 1 ? 1 : scale})`,
        transformOrigin: 'center center',
      }}
    />
  );
}
