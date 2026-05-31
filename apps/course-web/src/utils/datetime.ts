export function todayValue(): string {
  const now = new Date();
  return formatDateKey(now);
}

export function formatDateKey(value?: string | Date | null): string {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysValue(dateValue: string, days: number): string {
  const base = dateValue ? new Date(`${dateValue}T12:00:00+08:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return todayValue();
  }

  base.setDate(base.getDate() + days);
  return formatDateKey(base);
}

export function weekStartValue(dateValue: string): string {
  const base = dateValue ? new Date(`${dateValue}T12:00:00+08:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return todayValue();
  }

  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta);
  return formatDateKey(base);
}

export function composeCnDateTime(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatDate(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatSecondsLabel(totalSeconds: number): string {
  if (!totalSeconds) {
    return "0s";
  }

  const safeSeconds = Math.max(Number(totalSeconds) || 0, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  if (!minutes) {
    return `${seconds}s`;
  }
  if (!seconds) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}
