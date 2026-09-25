export function edgeIntent(x: number, width: number) {
  const zone = width * 0.34;
  if (x < zone) return -Math.min(1, Math.max(0, (zone - x) / zone));
  if (x > width - zone) return Math.min(1, Math.max(0, (x - width + zone) / zone));
  return 0;
}
export function edgeRamp(seconds: number) {
  const progress = Math.max(0, Math.min(1, seconds / 0.9));
  return progress * progress * (3 - 2 * progress);
}
export function advanceVelocity(velocity: number, intent: number, seconds: number, engagedSeconds = 0.9) {
  const target = intent * 620 * edgeRamp(engagedSeconds);
  const rate = intent ? 1.15 : 7;
  return velocity + (target - velocity) * (1 - Math.exp(-rate * Math.min(seconds, 0.05)));
}
