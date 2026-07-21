export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getNextPeriod(periodName: string): string {
  const [monthName, yearStr] = periodName.split(" ");
  const idx = MONTH_NAMES.indexOf(monthName);
  const yr = parseInt(yearStr);
  const nextIdx = idx === 11 ? 0 : idx + 1;
  const nextYr = idx === 11 ? yr + 1 : yr;
  return `${MONTH_NAMES[nextIdx]} ${nextYr}`;
}

export function getNextPeriodWithDates(periodName: string): {
  nextPeriod: string;
  periodAfterNext: string;
  startDate: string;
  endDate: string;
} {
  const [monthName, yearStr] = periodName.split(" ");
  const idx = MONTH_NAMES.indexOf(monthName);
  const yr = parseInt(yearStr);
  const nextIdx = idx === 11 ? 0 : idx + 1;
  const nextYr = idx === 11 ? yr + 1 : yr;
  const nextPeriod = `${MONTH_NAMES[nextIdx]} ${nextYr}`;
  
  const periodAfterNextIdx = nextIdx === 11 ? 0 : nextIdx + 1;
  const periodAfterNextYr = nextIdx === 11 ? nextYr + 1 : nextYr;
  const periodAfterNext = `${MONTH_NAMES[periodAfterNextIdx]} ${periodAfterNextYr}`;
  
  const startDate = `${nextYr}-${String(nextIdx + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(nextYr, nextIdx + 1, 0).getDate();
  const endDate = `${nextYr}-${String(nextIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { nextPeriod, periodAfterNext, startDate, endDate };
}
