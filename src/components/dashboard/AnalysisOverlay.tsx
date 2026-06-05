'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  'Fetching live portfolio data…',
  'Reading market snapshots…',
  'Running AI portfolio analysis…',
  'Applying risk guard…',
  'Generating recommendations…',
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
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm dark:bg-gray-950/80"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex w-80 flex-col items-center rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Spinner ring */}
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/40" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-indigo-600" />
          {/* Inner pulse dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 animate-pulse rounded-full bg-indigo-600" />
          </div>
        </div>

        {/* Heading */}
        <p className="mt-6 text-center text-base font-semibold text-gray-900 dark:text-white">
          Tavola AI is analyzing
          <br />
          your portfolio…
        </p>

        {/* Step text */}
        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {STEPS[stepIndex]}
        </motion.p>

        {/* Animated dots */}
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-600"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
