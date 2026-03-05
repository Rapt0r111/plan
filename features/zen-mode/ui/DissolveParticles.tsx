"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
    active: boolean;
}

const COLORS = [
    "#8b5cf6",
    "#a78bfa",
    "#c4b5fd",
    "#34d399",
    "#ffffff",
    "#38bdf8",
];

function makeParticles() {
    return Array.from({ length: 36 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.8;
        const dist = 40 + Math.random() * 120;

        return {
            id: i,
            angle,
            dist,
            size: 2 + Math.random() * 5,
            delay: Math.random() * 0.15,
            dur: 0.5 + Math.random() * 0.6,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
    });
}

export function DissolveParticles({ active }: Props) {
    // Генерируем один раз
    const particles = useMemo(() => {
        if (!active) return [];
        return makeParticles();
    }, [active]);

    return (
        <AnimatePresence>
            {active &&
                particles.map((p) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0, x: "50%", y: "50%" }}
                        animate={{ opacity: p.size / 7, scale: 1, x: "50%", y: "50%" }}
                        exit={{
                            opacity: 0,
                            scale: 0,
                            x: `calc(50% + ${Math.cos(p.angle) * p.dist}px)`,
                            y: `calc(50% + ${Math.sin(p.angle) * p.dist}px)`,
                            transition: {
                                duration: p.dur,
                                delay: p.delay,
                                ease: [0.2, 0, 0.8, 1],
                            },
                        }}
                        style={{
                            position: "absolute",
                            width: p.size,
                            height: p.size,
                            borderRadius: "50%",
                            backgroundColor: p.color,
                            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                            willChange: "transform",
                            pointerEvents: "none",
                            zIndex: 20,
                        }}
                    />
                ))}
        </AnimatePresence>
    );
}