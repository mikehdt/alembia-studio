/** Common LR presets mapped to human-readable labels */
const LR_PRESETS = [
  { value: 1e-6, label: 'Very Slow', position: 0 },
  { value: 5e-5, label: 'Slower', position: 25 },
  { value: 1e-4, label: 'Standard', position: 50 },
  { value: 2e-4, label: 'Faster', position: 62 },
  { value: 5e-4, label: 'Very Fast', position: 75 },
  { value: 1e-3, label: 'Aggressive', position: 100 },
] as const;

/** Map a slider position (0-100) to a learning rate value */
export function sliderToLr(position: number): number {
  // Find the two presets we're between and interpolate
  for (let i = 0; i < LR_PRESETS.length - 1; i++) {
    const curr = LR_PRESETS[i];
    const next = LR_PRESETS[i + 1];
    if (position <= next.position) {
      const t = (position - curr.position) / (next.position - curr.position);
      // Logarithmic interpolation for better feel
      const logCurr = Math.log10(curr.value);
      const logNext = Math.log10(next.value);
      return parseFloat(
        Math.pow(10, logCurr + t * (logNext - logCurr)).toPrecision(2),
      );
    }
  }
  return LR_PRESETS[LR_PRESETS.length - 1].value;
}

/** Map a learning rate value to a slider position (0-100) */
export function lrToSlider(lr: number): number {
  if (lr <= LR_PRESETS[0].value) return 0;
  if (lr >= LR_PRESETS[LR_PRESETS.length - 1].value) return 100;

  for (let i = 0; i < LR_PRESETS.length - 1; i++) {
    const curr = LR_PRESETS[i];
    const next = LR_PRESETS[i + 1];
    if (lr <= next.value) {
      const logCurr = Math.log10(curr.value);
      const logNext = Math.log10(next.value);
      const logLr = Math.log10(lr);
      const t = (logLr - logCurr) / (logNext - logCurr);
      return curr.position + t * (next.position - curr.position);
    }
  }
  return 100;
}

/** Find the closest preset label for a given LR */
export function getLrLabel(lr: number): string {
  let closestLabel = LR_PRESETS[0].label as string;
  let closestDist = Infinity;
  for (const preset of LR_PRESETS) {
    const dist = Math.abs(Math.log10(lr) - Math.log10(preset.value));
    if (dist < closestDist) {
      closestDist = dist;
      closestLabel = preset.label;
    }
  }
  return closestLabel;
}
