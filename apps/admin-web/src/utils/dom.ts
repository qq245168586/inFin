export function triggerFileInput(inputId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  input?.click();
}
