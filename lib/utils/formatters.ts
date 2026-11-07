// ============================================================================
// lib/utils/formatters.ts — Formatting helpers for Currency and Preparation Times
// ============================================================================

/**
 * Formats a monetary amount in Colombian Pesos (COP).
 * Example: 28500 -> "$ 28.500"
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$ 0';
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export type SemaphoroTier = 'green' | 'orange' | 'red';

export interface ElapsedInfo {
  minutes: number;
  seconds: number;
  label: string;
  tier: SemaphoroTier;
}

/**
 * Calculates preparation elapsed time and assigns the KDS semáforo tier:
 * - Green (< 10 minutes)
 * - Orange (10 to 20 minutes)
 * - Red (> 20 minutes)
 */
export function getElapsedInfo(createdAt: string | Date): ElapsedInfo {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  let tier: SemaphoroTier = 'green';
  if (minutes >= 20) {
    tier = 'red';
  } else if (minutes >= 10) {
    tier = 'orange';
  }

  const label = minutes === 0 ? `${seconds}s` : `${minutes}m`;

  return {
    minutes,
    seconds,
    label,
    tier,
  };
}

/**
 * Formats an ISO date into local 24h clock time (e.g. "14:32:05")
 */
export function formatClockTime(isoString: string | Date): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}
