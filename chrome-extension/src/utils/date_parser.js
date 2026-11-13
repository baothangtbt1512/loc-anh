(function (root) {
  'use strict';

  const EN_MONTHS = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function makeDateResult(year, month, day, hasDay, hour = 12, minute = 0) {
    if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    const safeDay = hasDay && Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
    const date = new Date(year, month - 1, safeDay, hour, minute, 0, 0);
    if (date.getMonth() !== month - 1) return null;
    return {
      year,
      month,
      day: hasDay ? safeDay : null,
      hasDay: Boolean(hasDay),
      monthKey: `${year}-${pad2(month)}`,
      timestampMs: date.getTime()
    };
  }

  function inferYear(month, day, refNow) {
    const curYear = refNow.getFullYear();
    const candidate = new Date(curYear, month - 1, day || 1, 23, 59, 59);
    // If omitting year places it more than 1 day in the future, it belongs to previous year.
    if (candidate.getTime() - refNow.getTime() > 86400000) {
      return curYear - 1;
    }
    return curYear;
  }

  function extractTime(text) {
    // Matches "14:22", "14:22:10", or "2:22 PM"
    const ampm = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|SA|CH)\b/i);
    if (ampm) {
      let h = Number(ampm[1]);
      const m = Number(ampm[2]);
      const mer = ampm[3].toUpperCase();
      if ((mer === 'PM' || mer === 'CH') && h < 12) h += 12;
      if ((mer === 'AM' || mer === 'SA') && h === 12) h = 0;
      return { hour: h, minute: m };
    }
    const hm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
    if (hm) {
      return { hour: Number(hm[1]), minute: Number(hm[2]) };
    }
    return { hour: 12, minute: 0 };
  }

  /**
   * Convert an epoch timestamp (ms or seconds) into month metadata.
   */
  function timestampToMonthInfo(rawTs) {
    const num = Number(rawTs);
    if (!Number.isFinite(num) || num <= 0) return null;
    const ms = num < 1e12 ? num * 1000 : num;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2100) {
      return null;
    }
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hasDay: true,
      monthKey: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      timestampMs: ms
    };
  }

  /**
   * Parse Google Photos localized date headers and aria-labels (Vietnamese, English, ISO).
   */
  function parseGooglePhotosDate(rawText, referenceNow) {
    if (!rawText || typeof rawText !== 'string') return null;
    const text = rawText.trim();
    if (!text) return null;

    const ref = referenceNow instanceof Date ? referenceNow : new Date();
    const { hour, minute } = extractTime(text);

    // 1. Relative words
    if (/\b(hôm nay|today)\b/i.test(text)) {
      return makeDateResult(ref.getFullYear(), ref.getMonth() + 1, ref.getDate(), true, hour, minute);
    }
    if (/\b(hôm qua|yesterday)\b/i.test(text)) {
      const yest = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
      return makeDateResult(yest.getFullYear(), yest.getMonth() + 1, yest.getDate(), true, hour, minute);
    }

    // 2. ISO YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (isoMatch) {
      return makeDateResult(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]), true, hour, minute);
    }

    // 3. Vietnamese: "12 thg 11, 2026", "12 tháng 11 năm 2026", "12 thg 11"
    const viDayMonth = text.match(/\b(\d{1,2})\s+(?:thg|tháng)\s+(\d{1,2})(?:\s*(?:,|năm)?\s*(\d{4}))?/i);
    if (viDayMonth) {
      const day = Number(viDayMonth[1]);
      const month = Number(viDayMonth[2]);
      const year = viDayMonth[3] ? Number(viDayMonth[3]) : inferYear(month, day, ref);
      return makeDateResult(year, month, day, true, hour, minute);
    }

    // 4. Vietnamese month header only: "Tháng 11 năm 2026", "Tháng 11, 2026", "thg 11 2026", "Tháng 11"
    const viMonthOnly = text.match(/\b(?:tháng|thg)\s+(\d{1,2})(?:\s*(?:,|năm)?\s*(\d{4}))?\b/i);
    if (viMonthOnly) {
      const month = Number(viMonthOnly[1]);
      const year = viMonthOnly[2] ? Number(viMonthOnly[2]) : inferYear(month, 1, ref);
      return makeDateResult(year, month, null, false, hour, minute);
    }

    // 5. English Month Day[, Year]: "Nov 12, 2026", "November 12, 2026", "Nov 12"
    const enMonthDay = text.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i
    );
    if (enMonthDay) {
      const month = EN_MONTHS[enMonthDay[1].toLowerCase()];
      const day = Number(enMonthDay[2]);
      const year = enMonthDay[3] ? Number(enMonthDay[3]) : inferYear(month, day, ref);
      return makeDateResult(year, month, day, true, hour, minute);
    }

    // 6. English Day Month Year: "12 Nov 2026", "12 November"
    const enDayMonth = text.match(
      /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i
    );
    if (enDayMonth) {
      const day = Number(enDayMonth[1]);
      const month = EN_MONTHS[enDayMonth[2].toLowerCase()];
      const year = enDayMonth[3] ? Number(enDayMonth[3]) : inferYear(month, day, ref);
      return makeDateResult(year, month, day, true, hour, minute);
    }

    // 7. English Month Year only: "November 2026", "Nov 2026"
    const enMonthYear = text.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i
    );
    if (enMonthYear) {
      const month = EN_MONTHS[enMonthYear[1].toLowerCase()];
      const year = Number(enMonthYear[2]);
      return makeDateResult(year, month, null, false, hour, minute);
    }

    // 8. DD/MM/YYYY numeric fallback (common in Vietnamese locales)
    const dmy = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (dmy) {
      const first = Number(dmy[1]);
      const second = Number(dmy[2]);
      const year = Number(dmy[3]);
      // Prefer DD/MM when first > 12 or default DD/MM if both <= 12 unless clearly invalid
      const asDmy = makeDateResult(year, second, first, true, hour, minute);
      if (asDmy) return asDmy;
      return makeDateResult(year, first, second, true, hour, minute);
    }

    return null;
  }

  const api = {
    parseGooglePhotosDate,
    timestampToMonthInfo
  };

  root.SPCDateParser = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
