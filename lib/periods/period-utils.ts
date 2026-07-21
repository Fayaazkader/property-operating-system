// lib/periods/period-utils.ts

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function getNextPeriod(periodName: string): string {
  const parts = periodName.split(' ');
  const month = parts[0];
  const year = parseInt(parts[1]);
  const idx = MONTH_NAMES.indexOf(month);
  if (idx === 11) return `January ${year + 1}`;
  return `${MONTH_NAMES[idx + 1]} ${year}`;
}

export function getNextPeriodWithDates(periodName: string): { nextPeriod: string; startDate: string; endDate: string } {
  const parts = periodName.split(' ');
  const month = parts[0];
  const year = parseInt(parts[1]);
  const idx = MONTH_NAMES.indexOf(month);
  let nextMonthIdx: number;
  let nextYear: number;
  if (idx === 11) { nextMonthIdx = 0; nextYear = year + 1; }
  else { nextMonthIdx = idx + 1; nextYear = year; }
  const nextPeriod = `${MONTH_NAMES[nextMonthIdx]} ${nextYear}`;
  const startDate = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(nextYear, nextMonthIdx + 1, 0).getDate();
  const endDate = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { nextPeriod, startDate, endDate };
}
