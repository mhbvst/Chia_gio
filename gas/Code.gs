/**
 * Hospital Pro – Quản lý lịch giờ chụp X-quang
 * Backend Google Apps Script (Production-Ready)
 */

const TZ = 'Asia/Ho_Chi_Minh';
const MACHINE_KEY_RE = /^[A-Z0-9_]{2,24}$/;
const SLOT_KEY_RE = /^(m|a):([1-9]\d{0,2})$/;

const PROP_PWD_SALT = 'ADMIN_PWD_SALT';
const PROP_PWD_HASH = 'ADMIN_PWD_HASH';
const PROP_AUTH_FAIL_COUNT = 'ADMIN_AUTH_FAIL_COUNT';
const PROP_AUTH_LOCK_UNTIL = 'ADMIN_AUTH_LOCK_UNTIL';
const PROP_SCHEDULE_SETTINGS = 'SCHEDULE_SETTINGS_V1';

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Hospital Pro – Quản lý lịch giờ chụp X-quang')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== Concurrency Lock Helper ===== */
function withScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(10000);
  if (!acquired) {
    throw new Error('Hệ thống đang xử lý đồng thời nhiều yêu cầu. Vui lòng thử lại sau vài giây.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ===== Date & Validation Helpers (Asia/Ho_Chi_Minh) ===== */
function todayKey() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function isValidDateKey_(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const s = dateStr.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function normDateKey(dateStr) {
  if (dateStr === undefined || dateStr === null || String(dateStr).trim() === '') {
    return todayKey();
  }
  const s = String(dateStr).trim();
  if (!isValidDateKey_(s)) {
    throw new Error('Định dạng ngày không hợp lệ (yêu cầu yyyy-MM-dd).');
  }
  return s;
}

function assertValidMachine_(machineKey, settingsOpt) {
  const mk = String(machineKey || '').trim().toUpperCase();
  if (!MACHINE_KEY_RE.test(mk)) {
    throw new Error('Mã máy chụp không hợp lệ.');
  }
  const settings = settingsOpt || readScheduleSettings_();
  let found = false;
  for (let i = 0; i < settings.machines.length; i++) {
    if (settings.machines[i].key === mk) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error('Mã máy chụp không tồn tại trong danh sách cấu hình.');
  }
  return mk;
}

function buildKey(machineKey, dateKey, settingsOpt) {
  const mk = assertValidMachine_(machineKey, settingsOpt);
  const dk = normDateKey(dateKey);
  return 'STATE_' + dk + '_' + mk;
}

function sanitizeSlots_(rawObj) {
  const cleaned = {};
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return cleaned;
  }
  const keys = Object.keys(rawObj);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (SLOT_KEY_RE.test(k) && rawObj[k] === true) {
      cleaned[k] = true;
    }
  }
  return cleaned;
}

function parseStateJson_(jsonStr) {
  if (!jsonStr) return {};
  try {
    const parsed = JSON.parse(jsonStr);
    return sanitizeSlots_(parsed);
  } catch (e) {
    return {};
  }
}

/* ===== Security & Salted SHA-256 Auth Helpers ===== */
function bytesToHex_(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const v = (bytes[i] & 0xff).toString(16);
    hex += v.length === 1 ? '0' + v : v;
  }
  return hex;
}

function hashPassword_(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(digest);
}

function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function checkAndVerifyPasswordLocked_(props, password) {
  const now = Date.now();
  const lockUntil = Number(props.getProperty(PROP_AUTH_LOCK_UNTIL) || '0');
  if (lockUntil > now) {
    const waitSec = Math.ceil((lockUntil - now) / 1000);
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: 'Thử sai quá nhiều lần. Vui lòng thử lại sau ' + waitSec + ' giây.',
    };
  }

  const salt = props.getProperty(PROP_PWD_SALT);
  const expectedHash = props.getProperty(PROP_PWD_HASH);
  if (!salt || !expectedHash) {
    return {
      ok: false,
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Chưa thiết lập mật khẩu quản trị trên máy chủ.',
    };
  }

  const pwd = typeof password === 'string' ? password : '';
  const candidateHash = hashPassword_(pwd, salt);
  if (!pwd || !constantTimeEqual_(candidateHash, expectedHash)) {
    const prevCount = Number(props.getProperty(PROP_AUTH_FAIL_COUNT) || '0') + 1;
    if (prevCount >= 5) {
      props.setProperties({
        [PROP_AUTH_FAIL_COUNT]: '0',
        [PROP_AUTH_LOCK_UNTIL]: String(now + 60000),
      });
    } else {
      props.setProperty(PROP_AUTH_FAIL_COUNT, String(prevCount));
    }
    return {
      ok: false,
      code: 'INVALID_PASSWORD',
      message: 'Mật khẩu quản trị không đúng.',
    };
  }

  props.deleteProperty(PROP_AUTH_FAIL_COUNT);
  props.deleteProperty(PROP_AUTH_LOCK_UNTIL);
  return { ok: true };
}

/* ===== Exposed Client Functions ===== */
function getToday() {
  return todayKey();
}

function getAuthStatus() {
  const props = PropertiesService.getScriptProperties();
  const configured = Boolean(props.getProperty(PROP_PWD_SALT) && props.getProperty(PROP_PWD_HASH));
  return {
    ok: true,
    configured: configured,
  };
}

function setupAdminPassword(newPassword) {
  const pwd = typeof newPassword === 'string' ? newPassword : '';
  if (pwd.length < 6) {
    return { ok: false, message: 'Mật khẩu quản trị phải có tối thiểu 6 ký tự.' };
  }
  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(PROP_PWD_SALT) && props.getProperty(PROP_PWD_HASH)) {
      return { ok: false, message: 'Mật khẩu quản trị đã được thiết lập trước đó.' };
    }
    const salt = Utilities.getUuid();
    const hash = hashPassword_(pwd, salt);
    props.setProperties({
      [PROP_PWD_SALT]: salt,
      [PROP_PWD_HASH]: hash,
    });
    return { ok: true, message: 'Đã thiết lập mật khẩu quản trị máy chủ.' };
  });
}

function verifyAdminPassword(password) {
  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    return checkAndVerifyPasswordLocked_(props, password);
  });
}

function changeAdminPassword(currentPassword, newPassword) {
  const nextPwd = typeof newPassword === 'string' ? newPassword : '';
  if (nextPwd.length < 6) {
    return { ok: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const auth = checkAndVerifyPasswordLocked_(props, currentPassword);
    if (!auth.ok) {
      return auth;
    }
    const salt = Utilities.getUuid();
    const hash = hashPassword_(nextPwd, salt);
    props.setProperties({
      [PROP_PWD_SALT]: salt,
      [PROP_PWD_HASH]: hash,
    });
    return { ok: true, message: 'Đã cập nhật mật khẩu quản trị thành công.' };
  });
}

function getState(machineKey, dateKey) {
  const key = buildKey(machineKey, dateKey);
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(key) || '';
  if (!raw) return '';
  const cleaned = parseStateJson_(raw);
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : '';
}

function defaultMachinesMeta_() {
  return [
    { key: 'TITAN2000', name: 'TITAN 2000', supervisor: 'Nguyễn Văn Hải' },
    { key: 'DR_GEM', name: 'DR GEM', supervisor: 'Trần Văn Huấn' },
  ];
}

function defaultScheduleSettings_() {
  return {
    machines: defaultMachinesMeta_(),
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
}

function parseMinutesHHMM_(s) {
  const m = String(s || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function sanitizeScheduleSettings_(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const def = defaultScheduleSettings_();

  const machines = [];
  if (raw.machines !== undefined) {
    if (!Array.isArray(raw.machines) || raw.machines.length === 0) return null;
    const seen = {};
    const limit = Math.min(6, raw.machines.length);
    for (let i = 0; i < limit; i++) {
      const item = raw.machines[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const rawKey = typeof item.key === 'string' ? item.key.trim().toUpperCase() : '';
      const rawName = typeof item.name === 'string' ? item.name.trim() : '';
      const rawSup = typeof item.supervisor === 'string' ? item.supervisor.trim() : '';
      if (!MACHINE_KEY_RE.test(rawKey) || seen[rawKey]) return null;
      if (rawName.length < 1 || rawName.length > 40) return null;
      seen[rawKey] = true;
      machines.push({
        key: rawKey,
        name: rawName,
        supervisor: rawSup.slice(0, 60),
      });
    }
    if (machines.length === 0) return null;
  } else {
    const defs = defaultMachinesMeta_();
    for (let i = 0; i < defs.length; i++) machines.push(defs[i]);
  }

  const rawFirst = typeof raw.firstMachine === 'string' ? raw.firstMachine.trim().toUpperCase() : '';
  let firstMachine = machines[0].key;
  for (let i = 0; i < machines.length; i++) {
    if (machines[i].key === rawFirst) {
      firstMachine = rawFirst;
      break;
    }
  }

  const hhmmRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const normTime = function (v, fb) {
    if (typeof v !== 'string') return fb;
    const t = v.trim();
    return hhmmRe.test(t) ? t : null;
  };
  const morningStart = normTime(raw.morningStart, def.morningStart);
  const morningEnd = normTime(raw.morningEnd, def.morningEnd);
  const afternoonStart = normTime(raw.afternoonStart, def.afternoonStart);
  const afternoonEnd = normTime(raw.afternoonEnd, def.afternoonEnd);
  if (!morningStart || !morningEnd || !afternoonStart || !afternoonEnd) return null;
  const clampInt = function (v, min, max, fb) {
    const n = Number(v);
    if (!isFinite(n)) return fb;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  return {
    machines: machines,
    firstMachine: firstMachine,
    morningStart: morningStart,
    morningEnd: morningEnd,
    afternoonStart: afternoonStart,
    afternoonEnd: afternoonEnd,
    scanDuration: clampInt(raw.scanDuration, 1, 120, def.scanDuration),
    primaryInterval: clampInt(raw.primaryInterval, 1, 120, def.primaryInterval),
    useSecondaryInterval: typeof raw.useSecondaryInterval === 'boolean' ? raw.useSecondaryInterval : def.useSecondaryInterval,
    secondaryInterval: clampInt(raw.secondaryInterval, 1, 120, def.secondaryInterval),
    secondaryFrequency: clampInt(raw.secondaryFrequency, 2, 50, def.secondaryFrequency),
  };
}

function validateScheduleSettingsConflict_(cfg) {
  const mS = parseMinutesHHMM_(cfg.morningStart);
  const mE = parseMinutesHHMM_(cfg.morningEnd);
  const aS = parseMinutesHHMM_(cfg.afternoonStart);
  const aE = parseMinutesHHMM_(cfg.afternoonEnd);
  if (mS === null || mE === null || mS >= mE) {
    return 'Giờ kết thúc ca làm việc buổi sáng phải lớn hơn giờ bắt đầu.';
  }
  if (aS === null || aE === null || aS >= aE) {
    return 'Giờ kết thúc ca làm việc buổi chiều phải lớn hơn giờ bắt đầu.';
  }
  if (mE > aS) {
    return 'Giờ kết thúc buổi sáng không được vượt quá giờ bắt đầu buổi chiều.';
  }

  const genSession = function (wStart, wEnd, offset) {
    const list = [];
    let cur = wStart + offset;
    for (let k = 1; k <= 500; k++) {
      const end = cur + cfg.scanDuration;
      if (end > wEnd) break;
      list.push({ startMin: cur, endMin: end });
      const useSec = cfg.useSecondaryInterval && cfg.secondaryFrequency >= 2 && (k % cfg.secondaryFrequency === 0);
      cur += Math.max(1, useSec ? cfg.secondaryInterval : cfg.primaryInterval);
    }
    return list;
  };

  const ordered = [];
  for (let i = 0; i < cfg.machines.length; i++) {
    if (cfg.machines[i].key === cfg.firstMachine) ordered.push(cfg.machines[i]);
  }
  for (let i = 0; i < cfg.machines.length; i++) {
    if (cfg.machines[i].key !== cfg.firstMachine) ordered.push(cfg.machines[i]);
  }

  const all = [];
  for (let i = 0; i < ordered.length; i++) {
    const off = i + 1;
    const mSlots = genSession(mS, mE, off);
    const aSlots = genSession(aS, aE, off);
    if (mSlots.length === 0 || aSlots.length === 0) {
      return 'Không đủ thời gian để xếp ít nhất 1 ca chụp cho máy ' + ordered[i].name + '.';
    }
    for (let j = 0; j < mSlots.length; j++) all.push(mSlots[j]);
    for (let j = 0; j < aSlots.length; j++) all.push(aSlots[j]);
  }

  const seenStart = {};
  const seenEnd = {};
  for (let i = 0; i < all.length; i++) {
    if (seenStart[all[i].startMin]) {
      return 'Cảnh báo: Phát hiện các ca giữa các máy trùng thời gian bắt đầu.';
    }
    seenStart[all[i].startMin] = true;
    if (seenEnd[all[i].endMin]) {
      return 'Cảnh báo: Phát hiện các ca giữa các máy trùng thời gian kết thúc.';
    }
    seenEnd[all[i].endMin] = true;
  }
  return null;
}

function readScheduleSettings_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PROP_SCHEDULE_SETTINGS) || '';
  if (!raw) return defaultScheduleSettings_();
  try {
    const parsed = JSON.parse(raw);
    return sanitizeScheduleSettings_(parsed) || defaultScheduleSettings_();
  } catch (e) {
    return defaultScheduleSettings_();
  }
}

function getScheduleSettings() {
  return {
    ok: true,
    settings: readScheduleSettings_(),
  };
}

function saveScheduleSettings(rawSettings, password) {
  const clean = sanitizeScheduleSettings_(rawSettings);
  if (!clean) {
    return { ok: false, message: 'Dữ liệu cài đặt lịch chụp hoặc thông tin máy không hợp lệ.' };
  }
  const err = validateScheduleSettingsConflict_(clean);
  if (err) {
    return { ok: false, message: err };
  }
  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const auth = checkAndVerifyPasswordLocked_(props, password);
    if (!auth.ok) {
      return auth;
    }
    props.setProperty(PROP_SCHEDULE_SETTINGS, JSON.stringify(clean));
    return { ok: true, settings: clean };
  });
}

function getStatesForDate(dateKey) {
  const dk = normDateKey(dateKey);
  const today = todayKey();
  const props = PropertiesService.getScriptProperties();
  const settings = readScheduleSettings_();
  const machinesOut = {};

  for (let i = 0; i < settings.machines.length; i++) {
    const m = settings.machines[i];
    const st = parseStateJson_(props.getProperty(buildKey(m.key, dk, settings)) || '');
    machinesOut[m.key] = {
      state: st,
      count: Object.keys(st).length,
    };
  }

  return {
    ok: true,
    dateKey: dk,
    today: today,
    isToday: dk === today,
    machines: machinesOut,
    settings: settings,
  };
}

function toggleSlot(machineKey, dateKey, slotId, checked) {
  const mk = assertValidMachine_(machineKey);
  const dk = normDateKey(dateKey);
  const today = todayKey();

  if (dk !== today) {
    return {
      ok: false,
      message: 'Chỉ được phép cập nhật ca chụp cho ngày hôm nay. Ngày khác đang ở chế độ chỉ xem.',
    };
  }
  if (typeof slotId !== 'string' || !SLOT_KEY_RE.test(slotId)) {
    return { ok: false, message: 'Mã ca chụp không hợp lệ.' };
  }
  if (typeof checked !== 'boolean') {
    return { ok: false, message: 'Trạng thái chọn ca không hợp lệ.' };
  }

  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const key = 'STATE_' + dk + '_' + mk;
    const current = parseStateJson_(props.getProperty(key) || '');

    if (checked) {
      current[slotId] = true;
    } else {
      delete current[slotId];
    }

    const keysCount = Object.keys(current).length;
    if (keysCount === 0) {
      props.deleteProperty(key);
    } else {
      props.setProperty(key, JSON.stringify(current));
    }

    return {
      ok: true,
      machineKey: mk,
      dateKey: dk,
      state: current,
      count: keysCount,
    };
  });
}

function saveState(machineKey, jsonStr, dateKey) {
  const mk = assertValidMachine_(machineKey);
  const dk = normDateKey(dateKey);
  const today = todayKey();

  if (dk !== today) {
    throw new Error('Không thể lưu đè lịch của ngày khác. Chỉ ngày hôm nay được phép chỉnh sửa.');
  }

  const cleaned = parseStateJson_(jsonStr || '{}');
  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const key = 'STATE_' + dk + '_' + mk;
    if (Object.keys(cleaned).length === 0) {
      props.deleteProperty(key);
    } else {
      props.setProperty(key, JSON.stringify(cleaned));
    }
    return true;
  });
}

function resetState(machineKey, password, dateKey) {
  const mk = assertValidMachine_(machineKey);
  const dk = normDateKey(dateKey);

  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const auth = checkAndVerifyPasswordLocked_(props, password);
    if (!auth.ok) {
      return auth;
    }

    const key = 'STATE_' + dk + '_' + mk;
    props.deleteProperty(key);
    return {
      ok: true,
      machineKey: mk,
      dateKey: dk,
    };
  });
}

/**
 * Tiện ích bảo trì PropertiesService (tránh vượt hạn mức 500KB):
 * Xóa dữ liệu lịch quá cũ hơn retentionDays (mặc định 180 ngày).
 * Có thể gắn Trigger theo tuần/tháng trong Apps Script.
 */
function pruneOldStates(retentionDays) {
  const days = Number(retentionDays) > 0 ? Number(retentionDays) : 180;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffKey = Utilities.formatDate(new Date(cutoffMs), TZ, 'yyyy-MM-dd');

  return withScriptLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    const allKeys = Object.keys(all);
    let deleted = 0;

    for (let i = 0; i < allKeys.length; i++) {
      const k = allKeys[i];
      const match = k.match(/^STATE_(\d{4}-\d{2}-\d{2})_([A-Z0-9_]{2,24})$/);
      if (match && match[1] < cutoffKey) {
        props.deleteProperty(k);
        deleted++;
      }
    }
    return { ok: true, cutoffDate: cutoffKey, deletedCount: deleted };
  });
}
