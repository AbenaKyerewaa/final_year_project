"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseColor: string;
}

export default function NodeNetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const nodes: Node[] = [];
    const connectionDistance = 110;
    const mouseConnectionDistance = 160;
    const maxNodesCount = Math.min(80, Math.floor((width * height) / 15000));

    // Mouse coordinates tracking
    const mouse = {
      x: null as number | null,
      y: null as number | null,
      active: false,
    };

    // Color choices for nodes (blue, indigo, purple tones)
    const nodeColors = [
      "rgba(59, 130, 246, 0.55)",  // blue-500
      "rgba(99, 102, 241, 0.55)",  // indigo-500
      "rgba(139, 92, 246, 0.55)",  // purple-500
      "rgba(6, 182, 212, 0.55)",   // cyan-500
    ];

    // Initialize nodes
    for (let i = 0; i < maxNodesCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 1.8 + 1,
        baseColor: nodeColors[Math.floor(Math.random() * nodeColors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections first
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        
        // Connection to other nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * 0.15;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }

        // Connection to mouse
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = n1.x - mouse.x;
          const dy = n1.y - mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseConnectionDistance) {
            const alpha = (1 - dist / mouseConnectionDistance) * 0.25;
            // Draw a gradient line from node color to cyan/blue
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();

            // Interactive attraction force: pull nodes slightly towards the mouse
            const force = (mouseConnectionDistance - dist) / mouseConnectionDistance;
            n1.vx += (dx / dist) * force * -0.015;
            n1.vy += (dy / dist) * force * -0.015;
          }
        }
      }

      // Draw and update nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Draw glowing background for nodes
        ctx.fillStyle = node.baseColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Node movement updates
        node.x += node.vx;
        node.y += node.vy;

        // Friction to keep velocity in check
        node.vx *= 0.98;
        node.vy *= 0.98;

        // Restore minimum speed if they slow down too much
        const speed = Math.hypot(node.vx, node.vy);
        if (speed < 0.15) {
          const angle = Math.random() * Math.PI * 2;
          node.vx += Math.cos(angle) * 0.05;
          node.vy += Math.sin(angle) * 0.05;
        }

        // Keep inside bounds (bounce back gently)
        if (node.x < 0) {
          node.x = 0;
          node.vx = -node.vx;
        } else if (node.x > width) {
          node.x = width;
          node.vx = -node.vx;
        }
        if (node.y < 0) {
          node.y = 0;
          node.vy = -node.vy;
        } else if (node.y > height) {
          node.y = height;
          node.vy = -node.vy;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mouseenter", () => {
      mouse.active = true;
    });

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-65 pointer-events-auto"
      />
    </div>
  );
}
