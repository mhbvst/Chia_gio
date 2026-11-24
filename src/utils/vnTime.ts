export const VN_TZ = 'Asia/Ho_Chi_Minh';

export interface VNTimeParts {
  dd: number;
  mm: number;
  yy: number;
  hh: number;
  mi: number;
  ss: number;
}

export function getVNNowParts(date: Date = new Date()): VNTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  return {
    dd: parseInt(map.day || '1', 10),
    mm: parseInt(map.month || '1', 10),
    yy: parseInt(map.year || '2026', 10),
    hh: parseInt(map.hour || '0', 10) % 24,
    mi: parseInt(map.minute || '0', 10),
    ss: parseInt(map.second || '0', 10),
  };
}

export function getTodayKeyVN(date: Date = new Date()): string {
  const p = getVNNowParts(date);
  return `${p.yy}-${String(p.mm).padStart(2, '0')}-${String(p.dd).padStart(2, '0')}`;
}

export function formatTimeVN(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: VN_TZ,
  }).format(date);
}

export function formatDateDisplayVN(dateKey: string): string {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatSolarDateVN(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    timeZone: VN_TZ,
  }).format(date);
  const dmy = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VN_TZ,
  }).format(date);
  const w = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${w}, ${dmy}`;
}

// ===== Âm lịch VN (Thuật toán Hồ Ngọc Đức, TZ = UTC+7) =====
const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

function INT(d: number): number {
  return Math.floor(d);
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;

  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  const C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M) -
    0.4068 * Math.sin(Mpr * dr) +
    0.0161 * Math.sin(dr * 2 * Mpr) -
    0.0004 * Math.sin(dr * 3 * Mpr) +
    0.0104 * Math.sin(dr * 2 * F) -
    0.0051 * Math.sin(dr * (M + Mpr)) -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M)) -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr)) +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));

  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;

  const JdNew = Jd1 + C1 - deltaT;
  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;

  const DL =
    (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);

  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT((L / Math.PI) * 6);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export function convertSolar2Lunar(dd: number, mm: number, yy: number, timeZone = 7): [number, number, number, number] {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);

  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }

  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;

  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarMonth = diff + 11;
  let lunarLeap = 0;

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }

  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

export function canChiYear(lunarYear: number): string {
  const can = CAN[(lunarYear + 6) % 10];
  const chi = CHI[(lunarYear + 8) % 12];
  return `${can} ${chi}`;
}

export function formatSolarPlusLunarVN(date: Date = new Date()): string {
  const solar = formatSolarDateVN(date);
  const p = getVNNowParts(date);
  const [ld, lm, ly, leap] = convertSolar2Lunar(p.dd, p.mm, p.yy, 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  const leapTxt = leap ? ' (nhuận)' : '';
  return `${solar} · ÂL ${pad(ld)}/${pad(lm)}/${ly}${leapTxt} · Năm ${canChiYear(ly)}`;
}

export interface LunarDisplayInfo {
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  isLeap: boolean;
  canChi: string;
  compactDate: string;
  fullText: string;
}

export function getLunarInfoVN(dd: number, mm: number, yy: number): LunarDisplayInfo {
  const [lunarDay, lunarMonth, lunarYear, leap] = convertSolar2Lunar(dd, mm, yy, 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isLeap = leap === 1;
  const canChi = canChiYear(lunarYear);
  const compactDate = lunarDay === 1 ? `${pad(lunarDay)}/${pad(lunarMonth)}${isLeap ? 'N' : ''}` : String(lunarDay);
  const fullText = `ÂL ${pad(lunarDay)}/${pad(lunarMonth)}/${lunarYear}${isLeap ? ' (nhuận)' : ''} · ${canChi}`;
  return {
    lunarDay,
    lunarMonth,
    lunarYear,
    isLeap,
    canChi,
    compactDate,
    fullText,
  };
}

export function parseHHMM(s: string): number | null {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function nowMinutesVN(date: Date = new Date()): number {
  const p = getVNNowParts(date);
  return p.hh * 60 + p.mi;
}

export function nowSecondsVN(date: Date = new Date()): number {
  const p = getVNNowParts(date);
  return p.hh * 3600 + p.mi * 60 + p.ss;
}

export function compareDateWithToday(dateKey: string, todayKey: string): 'today' | 'past' | 'future' {
  if (!dateKey || !todayKey || dateKey === todayKey) return 'today';
  return dateKey < todayKey ? 'past' : 'future';
}
