export function ruthuvuIndexFromSunsign(sunsign: number): number {
  const s = ((sunsign % 12) + 12) % 12;
  // Vasanta ṛtu spans Mīna (11) + Meṣa (0), not Meṣa + Vṛṣabha — hence the
  // +1 shift before pairing. See docs/PANCHANG_LOGIC.md §5.
  return Math.floor(((s + 1) % 12) / 2);
}

export function ruthuvuIndexFromPanchang(sunsign: number, lunarMonthIndex: number): number {
  if (lunarMonthIndex === 0) return 0;
  return ruthuvuIndexFromSunsign(sunsign);
}
