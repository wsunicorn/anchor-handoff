/** Tính chuỗi ngày ôn (G4.8) — thuần, không đụng DB. Ngày lấy theo giờ máy, không theo UTC. */

export function localDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Số ngày liên tiếp có ôn tính đến hôm nay; hôm nay chưa ôn thì chuỗi đếm từ hôm qua (chưa đứt). */
export function streakOf(days: Set<string>, now: Date): number {
  let d = new Date(now);
  if (!days.has(localDay(d))) d = new Date(d.getTime() - 86_400_000);
  let n = 0;
  while (days.has(localDay(d))) {
    n += 1;
    d = new Date(d.getTime() - 86_400_000);
  }
  return n;
}
