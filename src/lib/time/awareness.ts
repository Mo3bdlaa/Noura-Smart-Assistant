import { formatInTimeZone } from "date-fns-tz";

export type TimeOfDay = "dawn" | "morning" | "afternoon" | "evening" | "night" | "lateNight";

export type TimeContext = {
  localTime: string; // HH:mm
  hour: number;
  timeOfDay: TimeOfDay;
  isLateNight: boolean;
  weekday: string;
};

const WEEKDAYS_AR = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

export function timeContext(timezone: string, now = new Date()): TimeContext {
  const hourStr = formatInTimeZone(now, timezone, "H");
  const hour = Number(hourStr);
  const localTime = formatInTimeZone(now, timezone, "HH:mm");
  const dow = Number(formatInTimeZone(now, timezone, "i")) % 7; // 1..7 (Mon..Sun) → index
  const weekday = WEEKDAYS_AR[dow] ?? "";

  let timeOfDay: TimeOfDay;
  if (hour >= 0 && hour < 4) timeOfDay = "lateNight";
  else if (hour < 7) timeOfDay = "dawn";
  else if (hour < 12) timeOfDay = "morning";
  else if (hour < 17) timeOfDay = "afternoon";
  else if (hour < 21) timeOfDay = "evening";
  else timeOfDay = "night";

  return {
    localTime,
    hour,
    timeOfDay,
    isLateNight: hour >= 0 && hour < 4,
    weekday,
  };
}

/** The time block injected into the prompt. */
export function describeTime(t: TimeContext): string {
  const labels: Record<TimeOfDay, string> = {
    dawn: "فجر/بدري قوي",
    morning: "الصبح",
    afternoon: "بعد الضهر",
    evening: "بالليل بدري",
    night: "بالليل",
    lateNight: "آخر الليل (متأخر قوي)",
  };
  let s = `الوقت دلوقتي ${t.localTime} (${labels[t.timeOfDay]})، يوم ${t.weekday}.`;
  if (t.isLateNight) s += " هو سهران لوقت متأخر — تقدري تعلّقي على كده بحنية.";
  return s;
}
