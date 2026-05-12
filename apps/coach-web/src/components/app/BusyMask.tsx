export function BusyMask({ text, standalone, inline }: { text: string; standalone?: boolean; inline?: boolean }) {
  if (!text) {
    return null;
  }
  const className = `coach-busy-mask ${standalone ? "is-standalone" : ""} ${inline ? "is-inline" : ""}`.trim();
  return <div className={className}>{text}</div>;
}

