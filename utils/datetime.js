// Date/time formatting and duration utilities

/**
 * Returns today's date key in YYYY-MM-DD format
 */
function todayKey() {
  return dateToKey(new Date());
}

/**
 * Converts a Date object to YYYY-MM-DD key
 */
function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns current time as "HH:MM" string
 */
function currentTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formats a unix ms timestamp to "HH:MM"
 */
function formatTime(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formats a unix ms timestamp to "M月D日"
 */
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * Formats a unix ms timestamp to "M月D日 HH:MM"
 */
function formatDateTime(ts) {
  if (!ts) return '';
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

/**
 * Converts a dateKey "YYYY-MM-DD" to display format "M月D日 周X"
 */
function dateKeyToDisplay(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[date.getDay()];
  return `${m}月${d}日 周${wd}`;
}

/**
 * Returns a short date label "M/D" from dateKey
 */
function dateKeyToShort(dateKey) {
  if (!dateKey) return '';
  const [, m, d] = dateKey.split('-').map(Number);
  return `${m}/${d}`;
}

/**
 * Computes a Chinese relative time string from a unix ms timestamp
 */
function timeAgo(ts) {
  if (!ts) return '暂无记录';
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (diff < 60000) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}个月前`;
}

/**
 * Computes duration in minutes between two unix ms timestamps
 */
function durationMinutes(startMs, endMs) {
  if (!startMs || !endMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

/**
 * Formats duration in minutes to Chinese string "X小时Y分"
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0分钟';
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}

/**
 * Parses a "HH:MM" time string and a "YYYY-MM-DD" date string into unix ms timestamp
 */
function parseDateTime(dateKey, timeStr) {
  if (!dateKey || !timeStr) return Date.now();
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

/**
 * Calculates baby's age from a birth date key string "YYYY-MM-DD"
 * Returns a Chinese age string like "3个月零12天"
 */
function babyAge(birthDateKey) {
  if (!birthDateKey) return '';
  const [by, bm, bd] = birthDateKey.split('-').map(Number);
  const birth = new Date(by, bm - 1, bd);
  const now = new Date();
  const totalDays = Math.floor((now - birth) / 86400000);

  if (totalDays < 0) return '';
  if (totalDays === 0) return '刚出生';
  if (totalDays < 30) return `${totalDays}天`;

  const months = Math.floor(totalDays / 30);
  const remainDays = totalDays % 30;

  if (months < 12) {
    if (remainDays === 0) return `${months}个月`;
    return `${months}个月${remainDays}天`;
  }

  const years = Math.floor(months / 12);
  const remainMonths = months % 12;
  if (remainMonths === 0) return `${years}岁`;
  return `${years}岁${remainMonths}个月`;
}

/**
 * Returns greeting based on current hour
 */
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '深夜好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/**
 * Returns the last N date keys (including today), sorted descending
 */
function recentDateKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(dateToKey(d));
  }
  return keys;
}

module.exports = {
  todayKey,
  dateToKey,
  currentTime,
  formatTime,
  formatDate,
  formatDateTime,
  dateKeyToDisplay,
  dateKeyToShort,
  timeAgo,
  durationMinutes,
  formatDuration,
  parseDateTime,
  babyAge,
  greeting,
  recentDateKeys
};
