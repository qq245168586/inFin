export function stationCode(value: string | number | null | undefined): string {
  return String(value ?? "").trim();
}

export function stationInputValue(value: string | number | null | undefined): string {
  return String(value ?? "");
}
