'use client';

// ============================================================================
// app/cocina/SemaphoroBadge.tsx — Dynamic 3-Tier Preparation Timer Semáforo
// ============================================================================

import React, { useEffect, useState } from 'react';
import { getElapsedInfo, ElapsedInfo } from '@/lib/utils/formatters';

interface SemaphoroBadgeProps {
  createdAt: string;
}

export default function SemaphoroBadge({ createdAt }: SemaphoroBadgeProps) {
  const [elapsed, setElapsed] = useState<ElapsedInfo>(() => getElapsedInfo(createdAt));

  // Update elapsed timer periodically
  useEffect(() => {
    const update = () => setElapsed(getElapsedInfo(createdAt));
    update();
    const interval = setInterval(update, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [createdAt]);

  const { label, tier } = elapsed;

  let colorClasses = '';
  let dotColor = '';

  switch (tier) {
    case 'green':
      // < 10 min: Normal
      colorClasses = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
      dotColor = 'bg-emerald-400';
      break;
    case 'orange':
      // 10 - 20 min: Attention
      colorClasses = 'bg-amber-950/80 text-amber-400 border-amber-800/80';
      dotColor = 'bg-amber-400 animate-pulse';
      break;
    case 'red':
      // > 20 min: Urgent
      colorClasses = 'bg-red-950 text-red-300 border-red-700 animate-pulse font-extrabold shadow-lg shadow-red-900/40';
      dotColor = 'bg-red-500 animate-ping';
      break;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${colorClasses}`}
      title={`Tiempo transcurrido desde creación: ${label}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </div>
  );
}
