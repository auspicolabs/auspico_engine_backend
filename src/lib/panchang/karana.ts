/** Karaṇa = 6° of tithi elongation (half a tithi). `step` is elongation/6°, mod 60. */
export function karanaIndexFromStep(step: number): number {
  const k = ((step % 60) + 60) % 60;
  if (k === 0) return 10; // Kimstughna
  if (k === 57) return 7; // Śakuni
  if (k === 58) return 8; // Catuṣpāda
  if (k === 59) return 9; // Nāga
  return (k - 1) % 7; // Bava..Viṣṭi, repeating
}
