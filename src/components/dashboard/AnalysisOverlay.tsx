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
      className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex w-80 flex-col items-center border border-[#E2E8F0] bg-white px-8 py-10"
      >
        {/* Spinner */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 border-2 border-[#E2E8F0]" />
          <div className="absolute inset-0 animate-spin border-2 border-transparent border-t-[#B8960C]" />
        </div>

        <p className="mt-6 text-center font-serif text-base font-light text-[#0A1628]">
          Analyzing your portfolio
        </p>

        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-2 text-center text-xs text-[#4A5568]"
        >
          {STEPS[stepIndex]}
        </motion.p>

        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 bg-[#B8960C]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
