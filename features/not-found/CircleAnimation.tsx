"use client";

import { useEffect, useRef } from "react";

interface Circulo {
  x: number;
  y: number;
  size: number;
}

export default function CircleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number | undefined>(undefined);
  const timerRef = useRef(0);
  const circulosRef = useRef<Circulo[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetCanvas: HTMLCanvasElement = canvas;

    function initArr() {
      circulosRef.current = [];

      for (let index = 0; index < 300; index++) {
        const randomX = Math.floor(
          Math.random() * ((targetCanvas.width * 3) - (targetCanvas.width * 1.2) + 1),
        ) + (targetCanvas.width * 1.2);

        const randomY = Math.floor(
          Math.random() * (targetCanvas.height - (targetCanvas.height * -0.2 + 1)),
        ) + (targetCanvas.height * -0.2);

        const size = targetCanvas.width / 1000;
        circulosRef.current.push({ x: randomX, y: randomY, size });
      }
    }

    function draw() {
      const context = targetCanvas.getContext("2d");
      if (!context) return;

      timerRef.current++;
      context.setTransform(1, 0, 0, 1, 0, 0);

      const distanceX = targetCanvas.width / 80;
      const growthRate = targetCanvas.width / 1000;

      context.fillStyle = "white";
      context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

      circulosRef.current.forEach((circulo) => {
        context.beginPath();

        if (timerRef.current < 65) {
          circulo.x -= distanceX;
          circulo.size += growthRate;
        }

        if (timerRef.current > 65 && timerRef.current < 500) {
          circulo.x -= distanceX * 0.02;
          circulo.size += growthRate * 0.2;
        }

        context.arc(circulo.x, circulo.y, circulo.size, 0, 360);
        context.fill();
      });

      if (timerRef.current > 500) {
        if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        return;
      }

      requestIdRef.current = requestAnimationFrame(draw);
    }

    function restart() {
      targetCanvas.width = window.innerWidth;
      targetCanvas.height = window.innerHeight;
      timerRef.current = 0;

      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);

      const context = targetCanvas.getContext("2d");
      context?.reset();

      initArr();
      draw();
    }

    restart();
    window.addEventListener("resize", restart);

    return () => {
      window.removeEventListener("resize", restart);
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
