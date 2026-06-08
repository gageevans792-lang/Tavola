'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  'Fetching live portfolio data...',
  'Reading market snapshots...',
  'Running AI portfolio analysis...',
  'Applying risk guard...',
  'Generating recommendations...',
];

export function AnalysisOverlay() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-label="AI Analysis in progress"
      className="absolute inset-0 z-50 flex items-center justify-center bg-white/95"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex w-80 flex-col items-center border border-[#E2E8F0] bg-white px-8 py-10"
      >
        {/* TAVOLA wordmark */}
        <p className="font-serif text-xl tracking-widest text-[#0A1628]">TAVOLA</p>

        {/* Gold pulsing line */}
        <motion.div
          className="mt-4 h-px w-24 bg-[#B8960C]"
          animate={{ scaleX: [0.3, 1, 0.3], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
          className="mt-6 text-center text-[11px] tracking-[0.12em] uppercase text-[#4A5568]"
        >
          {STEPS[stepIndex]}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
