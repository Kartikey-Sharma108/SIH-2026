// ============================================================================
// RiskBadge — Color-coded risk score pill
// ============================================================================
// Green (< 40), Yellow (40-70), Red (> 70)
// Displays numeric score inside the pill
// ============================================================================

import React from 'react';

export default function RiskBadge({ score }) {
  const numScore = typeof score === 'number' ? score : parseInt(score, 10) || 0;

  let bgColor, textColor, borderColor, glowClass;

  if (numScore < 40) {
    bgColor = 'bg-emerald-500/15';
    textColor = 'text-emerald-400';
    borderColor = 'border-emerald-500/30';
    glowClass = '';
  } else if (numScore <= 70) {
    bgColor = 'bg-amber-500/15';
    textColor = 'text-amber-400';
    borderColor = 'border-amber-500/30';
    glowClass = '';
  } else {
    bgColor = 'bg-red-500/15';
    textColor = 'text-red-400';
    borderColor = 'border-red-500/30';
    glowClass = 'glow-red';
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1
        rounded-full text-xs font-semibold font-mono
        border ${bgColor} ${textColor} ${borderColor} ${glowClass}
        transition-all duration-200
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          numScore < 40
            ? 'bg-emerald-400'
            : numScore <= 70
            ? 'bg-amber-400'
            : 'bg-red-400'
        }`}
      />
      {numScore}
    </span>
  );
}
