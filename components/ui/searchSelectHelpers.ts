/** Next highlighted row for arrow keys: wraps around; -1 when there are no rows. */
export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/** Keep the highlighted row inside the list after the rows changed. */
export function clampActive(index: number, count: number): number {
  if (count <= 0) return -1;
  return Math.min(Math.max(index, 0), count - 1);
}
