"use client";

import React from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "@/components/Providers";

export function ParticleBackground() {
  const { resolvedTheme } = useTheme();

  const particlesInit = async (engine: any) => {
    await loadSlim(engine);
  };

  const particleColor = resolvedTheme === "light" ? "#3b82f6" : "#6366f1";
  const lineColor = resolvedTheme === "light" ? "#93c5fd" : "#312e81";

  return (
    <ParticlesProvider init={particlesInit}>
      <Particles
        id="tsparticles"
        className="absolute inset-0 -z-10 transition-opacity duration-500"
        options={{
          background: {
            color: {
              value: "transparent",
            },
          },
          fpsLimit: 60,
          interactivity: {
            events: {
              onClick: {
                enable: false,
                action: "push",
              },
              onHover: {
                enable: true,
                mode: "grab",
              },
            },
            modes: {
              grab: {
                distance: 140,
                links: {
                  opacity: 0.5,
                },
              },
            },
          },
          particles: {
            color: {
              value: particleColor,
            },
            links: {
              color: lineColor,
              distance: 120,
              enable: true,
              opacity: 0.3,
              width: 1,
            },
            move: {
              direction: "none",
              enable: true,
              outModes: {
                default: "bounce",
              },
              random: false,
              speed: 1.2,
              straight: false,
            },
            number: {
              density: {
                enable: true,
                width: 800,
                height: 800,
              },
              value: 65,
            },
            opacity: {
              value: 0.4,
            },
            shape: {
              type: "circle",
            },
            size: {
              value: { min: 1, max: 3 },
            },
          },
          detectRetina: true,
        }}
      />
    </ParticlesProvider>
  );
}
