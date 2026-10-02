/**
 * Throw ballistics: converts a slingshot drag into a launch velocity and
 * simulates the trajectory under gravity for the aim guide.
 */

export interface LaunchResult {
  vx: number;
  vy: number;
  power: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
}

export function computeLaunch(
  homeX: number,
  homeY: number,
  pointerX: number,
  pointerY: number,
  maxDrag: number,
  maxVelocity: number,
): LaunchResult {
  const dx = homeX - pointerX;
  const dy = homeY - pointerY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return { vx: 0, vy: 0, power: 0 };
  }
  const pull = Math.min(dist, maxDrag);
  const power = (pull / maxDrag) * maxVelocity;
  return {
    vx: (dx / dist) * power,
    vy: (dy / dist) * power,
    power,
  };
}

export function simulateTrajectory(
  homeX: number,
  homeY: number,
  vx: number,
  vy: number,
  gravity: number,
  maxTime: number,
  dt: number,
  maxPoints: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  let t = 0;
  for (let i = 0; i < maxPoints && t <= maxTime; i += 1) {
    t += dt;
    points.push({
      x: homeX + vx * t,
      y: homeY + vy * t + 0.5 * gravity * t * t,
    });
  }
  return points;
}