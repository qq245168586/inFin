export function toggleNumberId(list: number[], id: number): number[] {
  const numericId = Number(id);
  return list.includes(numericId) ? list.filter((value) => value !== numericId) : [...list, numericId];
}
