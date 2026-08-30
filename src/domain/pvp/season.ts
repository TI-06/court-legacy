const JST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

interface JstDateParts {
  year: string;
  month: string;
  day: string;
}

function jstDateParts(date: Date): JstDateParts {
  const parts = JST_DATE_FORMATTER.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((entry) => entry.type === type)?.value;
    if (!part) {
      throw new Error(`JST date formatter omitted ${type}`);
    }
    return part;
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

export function pvpSeasonId(date: Date): string {
  const { year, month } = jstDateParts(date);
  return `${year}-${month}`;
}

export function pvpJstDayKey(date: Date): string {
  const { year, month, day } = jstDateParts(date);
  return `${year}-${month}-${day}`;
}
