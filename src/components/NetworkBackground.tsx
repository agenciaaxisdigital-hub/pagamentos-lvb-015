import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
  color: [number, number, number];
}

const PINK: [number, number, number] = [236, 72, 153];
const GOLD: [number, number, number] = [200, 170, 100];
const ROSE: [number, number, number] = [244, 114, 182];

const PALETTE = [PINK, GOLD, ROSE, PINK, GOLD];

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let time = 0;
    const COUNT = 90;
    const MAX_DIST = 170;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      resize();
      particles = Array.from({ length: COUNT }, () => {
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 3 + 1.2,
          alpha: Math.random() * 0.4 + 0.4,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.025 + 0.01,
          color,
        };
      });
    };

    const draw = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx1 = Math.sin(time * 0.004) * canvas.width * 0.35 + canvas.width * 0.35;
      const cy1 = Math.cos(time * 0.003) * canvas.height * 0.25 + canvas.height * 0.35;
      const cx2 = Math.cos(time * 0.005) * canvas.width * 0.3 + canvas.width * 0.65;
      const cy2 = Math.sin(time * 0.004) * canvas.height * 0.25 + canvas.height * 0.65;
      const cx3 = Math.sin(time * 0.003 + 2) * canvas.width * 0.25 + canvas.width * 0.5;
      const cy3 = Math.cos(time * 0.002 + 1) * canvas.height * 0.3 + canvas.height * 0.2;

      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, canvas.width * 0.45);
      g1.addColorStop(0, "rgba(236, 72, 153, 0.12)");
      g1.addColorStop(0.5, "rgba(244, 114, 182, 0.05)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, canvas.width * 0.4);
      g2.addColorStop(0, "rgba(200, 170, 100, 0.1)");
      g2.addColorStop(0.5, "rgba(200, 170, 100, 0.04)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g3 = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, canvas.width * 0.35);
      g3.addColorStop(0, "rgba(244, 114, 182, 0.08)");
      g3.addColorStop(0.6, "rgba(236, 72, 153, 0.03)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.3;
            const [r, g, b] = particles[i].color;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const a = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
        const [r, g, b] = p.color;

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 8);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a * 0.35})`);
        glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${a * 0.1})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.radius * 8, p.y - p.radius * 8, p.radius * 16, p.radius * 16);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.9})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.5})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10 || p.x > canvas.width + 10) p.vx *= -1;
        if (p.y < -10 || p.y > canvas.height + 10) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
