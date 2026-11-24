function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Bảng phân giờ chụp X-quang')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== Date helpers (Asia/Ho_Chi_Minh) ===== */
const TZ = 'Asia/Ho_Chi_Minh';
function todayKey() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}
function normDateKey(dateStr) {
  if (!dateStr) return todayKey();
  const s = String(dateStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return todayKey();
  return s;
}
function buildKey(machineKey, dateKey) {
  return `STATE_${normDateKey(dateKey)}_${machineKey}`;
}

/* ===== Exposed to client ===== */
function getToday() {
  return todayKey();
}

function getState(machineKey, dateKey) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(buildKey(machineKey, dateKey)) || '';
}

function saveState(machineKey, jsonStr, dateKey) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(buildKey(machineKey, dateKey), jsonStr || '');
  return true;
}

// Reset for a date (default today) with password 123456
function resetState(machineKey, password, dateKey) {
  const pwd = String(password || '');
  if (pwd !== '123456') return { ok: false, message: 'Mật khẩu không đúng' };
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(buildKey(machineKey, dateKey));
  return { ok: true };
}
