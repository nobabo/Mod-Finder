export function edgeIntent(x: number, width: number) {
  const zone = width * 0.34;
  if (x < zone) return -Math.min(1, Math.max(0, (zone - x) / zone));
  if (x > width - zone) return Math.min(1, Math.max(0, (x - width + zone) / zone));
  return 0;
}
export type RailMotion = { rampSeconds: number; responseRate: number };
export const GAME_RAIL_MOTION: RailMotion = { rampSeconds: 0.6, responseRate: 3 };

export function edgeRamp(seconds: number, duration = 0.9) {
  const progress = Math.max(0, Math.min(1, seconds / duration));
  return progress * progress * (3 - 2 * progress);
}
export function advanceVelocity(velocity: number, intent: number, seconds: number, engagedSeconds = 0.9, motion?: RailMotion) {
  const target = intent * 620 * edgeRamp(engagedSeconds, motion?.rampSeconds);
  const rate = intent ? motion?.responseRate ?? 1.15 : 7;
  return velocity + (target - velocity) * (1 - Math.exp(-rate * Math.min(seconds, 0.05)));
}
