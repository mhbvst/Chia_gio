import type { MachineConfig, MachineKey, ScheduleRow } from '../data/schedules';

export interface MachineMetaConfig {
  key: MachineKey;
  name: string;
  supervisor: string;
}

export interface ScheduleSettings {
  machines: MachineMetaConfig[];
  firstMachine: MachineKey;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  scanDuration: number;
  primaryInterval: number;
  useSecondaryInterval: boolean;
  secondaryInterval: number;
  secondaryFrequency: number;
}

export interface SlotOccurrence {
  machineKey: MachineKey;
  machineName: string;
  session: 'm' | 'a';
  sessionLabel: string;
  stt: number;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
}

export interface ScheduleCollision {
  timeMin: number;
  time: string;
  type: 'start' | 'end';
  slots: SlotOccurrence[];
}

export interface StartEndCollision {
  timeMin: number;
  time: string;
  session: 'm' | 'a' | 'ma';
  sessionLabel: string;
  startSlots: SlotOccurrence[];
  endSlots: SlotOccurrence[];
  pairCount: number;
  crossMachine: boolean;
}

export interface OverlapCategoryMetrics {
  timeCount: number;
  pairCount: number;
  sameMachineTimeCount: number;
  sameMachinePairCount: number;
  diffMachineTimeCount: number;
  diffMachinePairCount: number;
}

export interface OverlapAuditItem {
  timeMin: number;
  time: string;
  session: 'm' | 'a' | 'ma';
  sessionLabel: string;
  hasStartStart: boolean;
  hasStartStartSame: boolean;
  hasStartStartDiff: boolean;
  hasEndEnd: boolean;
  hasEndEndSame: boolean;
  hasEndEndDiff: boolean;
  hasStartEnd: boolean;
  hasStartEndSame: boolean;
  hasStartEndDiff: boolean;
  startSlots: SlotOccurrence[];
  endSlots: SlotOccurrence[];
  startStartSamePairCount: number;
  startStartDiffPairCount: number;
  endEndSamePairCount: number;
  endEndDiffPairCount: number;
  startEndSamePairCount: number;
  startEndDiffPairCount: number;
}

export interface OverlapAuditSummary {
  uniqueOverlapTimes: number;
  morningOverlapTimes: number;
  afternoonOverlapTimes: number;
  totalOverlapPairs: number;
  startStart: OverlapCategoryMetrics;
  endEnd: OverlapCategoryMetrics;
  startEnd: OverlapCategoryMetrics;
  items: OverlapAuditItem[];
}

export interface MachineScheduleSummary {
  machineKey: MachineKey;
  machineName: string;
  isFirst: boolean;
  offsetMin: number;
  morningCount: number;
  afternoonCount: number;
  totalSelectable: number;
  firstMorning: string | null;
  lastMorning: string | null;
  firstAfternoon: string | null;
  lastAfternoon: string | null;
  sampleMorningStarts: string[];
}

export interface ScheduleAnalysis {
  settings: ScheduleSettings;
  rowsByMachine: Record<MachineKey, ScheduleRow[]>;
  titanRows: ScheduleRow[];
  gemRows: ScheduleRow[];
  errors: string[];
  startCollisions: ScheduleCollision[];
  endCollisions: ScheduleCollision[];
  startEndCollisions: StartEndCollision[];
  overlapAudit: OverlapAuditSummary;
  hasConflict: boolean;
  summaries: Record<MachineKey, MachineScheduleSummary>;
  summaryList: MachineScheduleSummary[];
}

export const DEFAULT_MACHINES_META: MachineMetaConfig[] = [
  { key: 'TITAN2000', name: 'TITAN 2000', supervisor: 'Nguyễn Văn Hải' },
  { key: 'DR_GEM', name: 'DR GEM', supervisor: 'Trần Văn Huấn' },
];

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  machines: DEFAULT_MACHINES_META.map((m) => ({ ...m })),
  firstMachine: 'TITAN2000',
  morningStart: '07:30',
  morningEnd: '11:36',
  afternoonStart: '13:00',
  afternoonEnd: '17:06',
  scanDuration: 6,
  primaryInterval: 2,
  useSecondaryInterval: true,
  secondaryInterval: 3,
  secondaryFrequency: 3,
};

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const MACHINE_KEY_RE = /^[A-Z0-9_]{2,24}$/;

export function generateMachineKeyFromName(name: string, existingKeys: Set<string>): string {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);

  const base = normalized.length >= 2 ? normalized : 'MAY_XQ';
  if (!existingKeys.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 20)}_${i}`;
    if (!existingKeys.has(candidate)) return candidate;
  }
  return `MAY_${Date.now().toString().slice(-6)}`;
}

export function parseMinutesHHMM(value: string): number | null {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function formatMinutesHHMM(totalMinutes: number): string {
  const clamped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function sanitizeScheduleSettings(raw: unknown): ScheduleSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  let machines: MachineMetaConfig[] = [];
  if (obj.machines !== undefined) {
    if (!Array.isArray(obj.machines) || obj.machines.length === 0) return null;
    const seen = new Set<string>();
    for (const item of obj.machines.slice(0, 6)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const rec = item as Record<string, unknown>;
      const rawKey = typeof rec.key === 'string' ? rec.key.trim().toUpperCase() : '';
      const rawName = typeof rec.name === 'string' ? rec.name.trim() : '';
      const rawSup = typeof rec.supervisor === 'string' ? rec.supervisor.trim() : '';
      if (!MACHINE_KEY_RE.test(rawKey) || seen.has(rawKey)) return null;
      if (rawName.length < 1 || rawName.length > 40) return null;
      seen.add(rawKey);
      machines.push({
        key: rawKey,
        name: rawName,
        supervisor: rawSup.slice(0, 60),
      });
    }
    if (machines.length === 0) return null;
  } else {
    machines = DEFAULT_MACHINES_META.map((m) => ({ ...m }));
  }

  const rawFirst = typeof obj.firstMachine === 'string' ? obj.firstMachine.trim().toUpperCase() : '';
  const firstMachine: MachineKey = machines.some((m) => m.key === rawFirst)
    ? rawFirst
    : machines[0].key;

  const normalizeTime = (val: unknown, fallback: string): string | null => {
    if (typeof val !== 'string') return fallback;
    const s = val.trim();
    if (!HHMM_RE.test(s)) return null;
    return s;
  };

  const morningStart = normalizeTime(obj.morningStart, DEFAULT_SCHEDULE_SETTINGS.morningStart);
  const morningEnd = normalizeTime(obj.morningEnd, DEFAULT_SCHEDULE_SETTINGS.morningEnd);
  const afternoonStart = normalizeTime(obj.afternoonStart, DEFAULT_SCHEDULE_SETTINGS.afternoonStart);
  const afternoonEnd = normalizeTime(obj.afternoonEnd, DEFAULT_SCHEDULE_SETTINGS.afternoonEnd);

  if (!morningStart || !morningEnd || !afternoonStart || !afternoonEnd) {
    return null;
  }

  const toInt = (val: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    machines,
    firstMachine,
    morningStart,
    morningEnd,
    afternoonStart,
    afternoonEnd,
    scanDuration: toInt(obj.scanDuration, 1, 120, DEFAULT_SCHEDULE_SETTINGS.scanDuration),
    primaryInterval: toInt(obj.primaryInterval, 1, 120, DEFAULT_SCHEDULE_SETTINGS.primaryInterval),
    useSecondaryInterval:
      typeof obj.useSecondaryInterval === 'boolean'
        ? obj.useSecondaryInterval
        : DEFAULT_SCHEDULE_SETTINGS.useSecondaryInterval,
    secondaryInterval: toInt(
      obj.secondaryInterval,
      1,
      120,
      DEFAULT_SCHEDULE_SETTINGS.secondaryInterval
    ),
    secondaryFrequency: toInt(
      obj.secondaryFrequency,
      2,
      50,
      DEFAULT_SCHEDULE_SETTINGS.secondaryFrequency
    ),
  };
}

interface SessionSlot {
  stt: number;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
}

function generateSessionSlots(
  workStartMin: number,
  workEndMin: number,
  offsetMin: number,
  settings: ScheduleSettings
): SessionSlot[] {
  const slots: SessionSlot[] = [];
  if (workEndMin <= workStartMin) return slots;
  if (settings.scanDuration < 1 || settings.primaryInterval < 1) return slots;

  let curStart = workStartMin + offsetMin;
  const maxSlots = 1440;

  for (let k = 1; k <= maxSlots; k++) {
    const curEnd = curStart + settings.scanDuration;
    if (curEnd > workEndMin) break;

    slots.push({
      stt: k,
      startMin: curStart,
      endMin: curEnd,
      start: formatMinutesHHMM(curStart),
      end: formatMinutesHHMM(curEnd),
    });

    const useSec =
      settings.useSecondaryInterval &&
      settings.secondaryFrequency >= 2 &&
      k % settings.secondaryFrequency === 0;
    const gap = useSec ? settings.secondaryInterval : settings.primaryInterval;
    curStart += Math.max(1, gap);
  }

  return slots;
}

function mergeSessionSlots(morning: SessionSlot[], afternoon: SessionSlot[]): ScheduleRow[] {
  const count = Math.max(morning.length, afternoon.length);
  const rows: ScheduleRow[] = [];
  for (let i = 0; i < count; i++) {
    const m = morning[i];
    const a = afternoon[i];
    rows.push({
      stt: i + 1,
      morningStart: m ? m.start : '',
      morningEnd: m ? m.end : '',
      afternoonStart: a ? a.start : '',
      afternoonEnd: a ? a.end : '',
    });
  }
  return rows;
}

export function countTotalSlots(rows: ScheduleRow[]): number {
  let count = 0;
  for (const r of rows) {
    if (r.morningStart) count++;
    if (r.afternoonStart) count++;
  }
  return count;
}

export function countCheckedSlotsInRows(
  rows: ScheduleRow[],
  slots: Record<string, boolean>
): { totalChecked: number; morningChecked: number; afternoonChecked: number } {
  let morningChecked = 0;
  let afternoonChecked = 0;
  for (const r of rows) {
    if (r.morningStart && slots[`m:${r.stt}`]) morningChecked++;
    if (r.afternoonStart && slots[`a:${r.stt}`]) afternoonChecked++;
  }
  return {
    totalChecked: morningChecked + afternoonChecked,
    morningChecked,
    afternoonChecked,
  };
}

export function analyzeScheduleSettings(settings: ScheduleSettings): ScheduleAnalysis {
  const errors: string[] = [];
  const machineList =
    settings.machines && settings.machines.length > 0
      ? settings.machines
      : DEFAULT_MACHINES_META;

  for (const m of machineList) {
    if (!m.name || !m.name.trim()) {
      errors.push('Tên máy chụp không được để trống.');
      break;
    }
  }

  const mStart = parseMinutesHHMM(settings.morningStart);
  const mEnd = parseMinutesHHMM(settings.morningEnd);
  const aStart = parseMinutesHHMM(settings.afternoonStart);
  const aEnd = parseMinutesHHMM(settings.afternoonEnd);

  if (mStart === null || mEnd === null) {
    errors.push('Định dạng giờ làm việc buổi sáng không hợp lệ (HH:MM).');
  } else if (mStart >= mEnd) {
    errors.push('Giờ kết thúc ca làm việc buổi sáng phải lớn hơn giờ bắt đầu.');
  }

  if (aStart === null || aEnd === null) {
    errors.push('Định dạng giờ làm việc buổi chiều không hợp lệ (HH:MM).');
  } else if (aStart >= aEnd) {
    errors.push('Giờ kết thúc ca làm việc buổi chiều phải lớn hơn giờ bắt đầu.');
  }

  if (mEnd !== null && aStart !== null && mEnd > aStart) {
    errors.push('Giờ kết thúc buổi sáng không được vượt quá giờ bắt đầu buổi chiều.');
  }

  if (!Number.isFinite(settings.scanDuration) || settings.scanDuration < 1) {
    errors.push('Thời gian thực hiện ca chụp phải tối thiểu 1 phút.');
  }

  if (!Number.isFinite(settings.primaryInterval) || settings.primaryInterval < 1) {
    errors.push('Khoảng cách chính giữa hai ca phải tối thiểu 1 phút.');
  }

  if (settings.useSecondaryInterval) {
    if (!Number.isFinite(settings.secondaryInterval) || settings.secondaryInterval < 1) {
      errors.push('Khoảng cách phụ phải tối thiểu 1 phút.');
    }
    if (!Number.isFinite(settings.secondaryFrequency) || settings.secondaryFrequency < 2) {
      errors.push('Tần suất khoảng phụ phải từ 2 ca trở lên.');
    }
  }

  const firstKey = machineList.some((m) => m.key === settings.firstMachine)
    ? settings.firstMachine
    : machineList[0].key;

  const offsetsByKey: Record<string, number> = {};
  offsetsByKey[firstKey] = 1;
  let nextOffset = 2;
  for (const m of machineList) {
    if (m.key !== firstKey) {
      offsetsByKey[m.key] = nextOffset++;
    }
  }

  const allOccurrences: SlotOccurrence[] = [];
  const pushAll = (
    machineKey: MachineKey,
    machineName: string,
    session: 'm' | 'a',
    sessionLabel: string,
    list: SessionSlot[]
  ) => {
    for (const s of list) {
      allOccurrences.push({
        machineKey,
        machineName,
        session,
        sessionLabel,
        stt: s.stt,
        startMin: s.startMin,
        endMin: s.endMin,
        start: s.start,
        end: s.end,
      });
    }
  };

  const rowsByMachine: Record<MachineKey, ScheduleRow[]> = {};
  const summaries: Record<MachineKey, MachineScheduleSummary> = {};
  const summaryList: MachineScheduleSummary[] = [];
  let missingMorning = false;
  let missingAfternoon = false;

  for (const m of machineList) {
    const off = offsetsByKey[m.key] ?? 1;
    const mSlots =
      mStart !== null && mEnd !== null ? generateSessionSlots(mStart, mEnd, off, settings) : [];
    const aSlots =
      aStart !== null && aEnd !== null ? generateSessionSlots(aStart, aEnd, off, settings) : [];

    if (mStart !== null && mEnd !== null && mStart < mEnd && mSlots.length === 0) {
      missingMorning = true;
    }
    if (aStart !== null && aEnd !== null && aStart < aEnd && aSlots.length === 0) {
      missingAfternoon = true;
    }

    const displayName = m.name.trim() || m.key;
    pushAll(m.key, displayName, 'm', 'Sáng', mSlots);
    pushAll(m.key, displayName, 'a', 'Chiều', aSlots);

    rowsByMachine[m.key] = mergeSessionSlots(mSlots, aSlots);
    const sum: MachineScheduleSummary = {
      machineKey: m.key,
      machineName: displayName,
      isFirst: m.key === firstKey,
      offsetMin: off,
      morningCount: mSlots.length,
      afternoonCount: aSlots.length,
      totalSelectable: mSlots.length + aSlots.length,
      firstMorning: mSlots.length ? `${mSlots[0].start} – ${mSlots[0].end}` : null,
      lastMorning: mSlots.length
        ? `${mSlots[mSlots.length - 1].start} – ${mSlots[mSlots.length - 1].end}`
        : null,
      firstAfternoon: aSlots.length ? `${aSlots[0].start} – ${aSlots[0].end}` : null,
      lastAfternoon: aSlots.length
        ? `${aSlots[aSlots.length - 1].start} – ${aSlots[aSlots.length - 1].end}`
        : null,
      sampleMorningStarts: mSlots.slice(0, 5).map((s) => s.start),
    };
    summaries[m.key] = sum;
    summaryList.push(sum);
  }

  if (missingMorning) {
    errors.push(
      'Buổi sáng không đủ thời gian xếp ít nhất 1 ca chụp cho các máy đã cấu hình (giờ kết thúc vượt quá giờ kết thúc làm việc).'
    );
  }
  if (missingAfternoon) {
    errors.push(
      'Buổi chiều không đủ thời gian xếp ít nhất 1 ca chụp cho các máy đã cấu hình (giờ kết thúc vượt quá giờ kết thúc làm việc).'
    );
  }

  const byStart = new Map<number, SlotOccurrence[]>();
  const byEnd = new Map<number, SlotOccurrence[]>();

  for (const occ of allOccurrences) {
    const sList = byStart.get(occ.startMin) || [];
    sList.push(occ);
    byStart.set(occ.startMin, sList);

    const eList = byEnd.get(occ.endMin) || [];
    eList.push(occ);
    byEnd.set(occ.endMin, eList);
  }

  const startCollisions: ScheduleCollision[] = [];
  for (const [timeMin, list] of byStart.entries()) {
    if (list.length > 1) {
      startCollisions.push({
        timeMin,
        time: formatMinutesHHMM(timeMin),
        type: 'start',
        slots: list,
      });
    }
  }
  startCollisions.sort((a, b) => a.timeMin - b.timeMin);

  const endCollisions: ScheduleCollision[] = [];
  for (const [timeMin, list] of byEnd.entries()) {
    if (list.length > 1) {
      endCollisions.push({
        timeMin,
        time: formatMinutesHHMM(timeMin),
        type: 'end',
        slots: list,
      });
    }
  }
  endCollisions.sort((a, b) => a.timeMin - b.timeMin);

  const startEndCollisions: StartEndCollision[] = [];
  const overlapItems: OverlapAuditItem[] = [];
  const allAuditTimes = Array.from(new Set([...byStart.keys(), ...byEnd.keys()])).sort(
    (a, b) => a - b
  );

  const emptyMetrics = (): OverlapCategoryMetrics => ({
    timeCount: 0,
    pairCount: 0,
    sameMachineTimeCount: 0,
    sameMachinePairCount: 0,
    diffMachineTimeCount: 0,
    diffMachinePairCount: 0,
  });

  const startStartMetrics = emptyMetrics();
  const endEndMetrics = emptyMetrics();
  const startEndMetrics = emptyMetrics();
  let morningOverlapTimes = 0;
  let afternoonOverlapTimes = 0;

  for (const timeMin of allAuditTimes) {
    const startSlots = byStart.get(timeMin) || [];
    const endSlots = byEnd.get(timeMin) || [];

    let startStartSamePairCount = 0;
    let startStartDiffPairCount = 0;
    for (let i = 0; i < startSlots.length; i++) {
      for (let j = i + 1; j < startSlots.length; j++) {
        if (startSlots[i].machineKey === startSlots[j].machineKey) startStartSamePairCount++;
        else startStartDiffPairCount++;
      }
    }

    let endEndSamePairCount = 0;
    let endEndDiffPairCount = 0;
    for (let i = 0; i < endSlots.length; i++) {
      for (let j = i + 1; j < endSlots.length; j++) {
        if (endSlots[i].machineKey === endSlots[j].machineKey) endEndSamePairCount++;
        else endEndDiffPairCount++;
      }
    }

    let startEndSamePairCount = 0;
    let startEndDiffPairCount = 0;
    for (const ss of startSlots) {
      for (const es of endSlots) {
        if (ss.machineKey === es.machineKey) startEndSamePairCount++;
        else startEndDiffPairCount++;
      }
    }

    const hasStartStartSame = startStartSamePairCount > 0;
    const hasStartStartDiff = startStartDiffPairCount > 0;
    const hasStartStart = hasStartStartSame || hasStartStartDiff;

    const hasEndEndSame = endEndSamePairCount > 0;
    const hasEndEndDiff = endEndDiffPairCount > 0;
    const hasEndEnd = hasEndEndSame || hasEndEndDiff;

    const hasStartEndSame = startEndSamePairCount > 0;
    const hasStartEndDiff = startEndDiffPairCount > 0;
    const hasStartEnd = hasStartEndSame || hasStartEndDiff;

    if (!hasStartStart && !hasEndEnd && !hasStartEnd) continue;

    const involved = [...startSlots, ...endSlots];
    const hasM = involved.some((s) => s.session === 'm');
    const hasA = involved.some((s) => s.session === 'a');
    const session: 'm' | 'a' | 'ma' = hasM && hasA ? 'ma' : hasA ? 'a' : 'm';
    const sessionLabel = session === 'ma' ? 'Sáng & Chiều' : session === 'a' ? 'Chiều' : 'Sáng';
    const time = formatMinutesHHMM(timeMin);

    if (hasStartEnd) {
      startEndCollisions.push({
        timeMin,
        time,
        session,
        sessionLabel,
        startSlots,
        endSlots,
        pairCount: startEndSamePairCount + startEndDiffPairCount,
        crossMachine: hasStartEndDiff,
      });
    }

    if (hasStartStart) {
      startStartMetrics.timeCount++;
      startStartMetrics.pairCount += startStartSamePairCount + startStartDiffPairCount;
      if (hasStartStartSame) {
        startStartMetrics.sameMachineTimeCount++;
        startStartMetrics.sameMachinePairCount += startStartSamePairCount;
      }
      if (hasStartStartDiff) {
        startStartMetrics.diffMachineTimeCount++;
        startStartMetrics.diffMachinePairCount += startStartDiffPairCount;
      }
    }

    if (hasEndEnd) {
      endEndMetrics.timeCount++;
      endEndMetrics.pairCount += endEndSamePairCount + endEndDiffPairCount;
      if (hasEndEndSame) {
        endEndMetrics.sameMachineTimeCount++;
        endEndMetrics.sameMachinePairCount += endEndSamePairCount;
      }
      if (hasEndEndDiff) {
        endEndMetrics.diffMachineTimeCount++;
        endEndMetrics.diffMachinePairCount += endEndDiffPairCount;
      }
    }

    if (hasStartEnd) {
      startEndMetrics.timeCount++;
      startEndMetrics.pairCount += startEndSamePairCount + startEndDiffPairCount;
      if (hasStartEndSame) {
        startEndMetrics.sameMachineTimeCount++;
        startEndMetrics.sameMachinePairCount += startEndSamePairCount;
      }
      if (hasStartEndDiff) {
        startEndMetrics.diffMachineTimeCount++;
        startEndMetrics.diffMachinePairCount += startEndDiffPairCount;
      }
    }

    if (hasM) morningOverlapTimes++;
    if (hasA) afternoonOverlapTimes++;

    overlapItems.push({
      timeMin,
      time,
      session,
      sessionLabel,
      hasStartStart,
      hasStartStartSame,
      hasStartStartDiff,
      hasEndEnd,
      hasEndEndSame,
      hasEndEndDiff,
      hasStartEnd,
      hasStartEndSame,
      hasStartEndDiff,
      startSlots,
      endSlots,
      startStartSamePairCount,
      startStartDiffPairCount,
      endEndSamePairCount,
      endEndDiffPairCount,
      startEndSamePairCount,
      startEndDiffPairCount,
    });
  }

  const overlapAudit: OverlapAuditSummary = {
    uniqueOverlapTimes: overlapItems.length,
    morningOverlapTimes,
    afternoonOverlapTimes,
    totalOverlapPairs:
      startStartMetrics.pairCount + endEndMetrics.pairCount + startEndMetrics.pairCount,
    startStart: startStartMetrics,
    endEnd: endEndMetrics,
    startEnd: startEndMetrics,
    items: overlapItems,
  };

  return {
    settings,
    rowsByMachine,
    titanRows: rowsByMachine.TITAN2000 || [],
    gemRows: rowsByMachine.DR_GEM || [],
    errors,
    startCollisions,
    endCollisions,
    startEndCollisions,
    overlapAudit,
    hasConflict: errors.length > 0 || startCollisions.length > 0 || endCollisions.length > 0,
    summaries,
    summaryList,
  };
}

export function buildMachinesFromSettings(
  baseMachines: MachineConfig[],
  settings: ScheduleSettings
): { machines: MachineConfig[]; machineMap: Record<MachineKey, MachineConfig> } {
  const analysis = analyzeScheduleSettings(settings);
  const machineMeta =
    settings.machines && settings.machines.length > 0
      ? settings.machines
      : DEFAULT_MACHINES_META;

  const baseByKey = new Map(baseMachines.map((m) => [m.key, m]));
  const machines: MachineConfig[] = machineMeta.map((meta) => {
    const base = baseByKey.get(meta.key);
    const rows = analysis.rowsByMachine[meta.key] || [];
    const cleanName = meta.name.trim() || meta.key;
    const cleanSup = meta.supervisor.trim() || 'Chưa phân công';
    return {
      key: meta.key,
      id: base?.id || meta.key.toLowerCase().replace(/_/g, '-'),
      name: cleanName,
      fullTitle: `MÁY CHỤP X QUANG ${cleanName.toUpperCase()}`,
      supervisor: cleanSup,
      totalRows: rows.length,
      defaultTheme: base?.defaultTheme || 'light',
      rows,
    };
  });

  const machineMap: Record<MachineKey, MachineConfig> = {};
  for (const m of machines) {
    machineMap[m.key] = m;
  }

  return {
    machines,
    machineMap,
  };
}
