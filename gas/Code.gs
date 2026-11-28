/**
 * 兒青門診 看診前調查表 - Google Apps Script 後端
 *
 * 使用方式：
 * 1. 開啟一個新的 Google 試算表 -> 擴充功能 -> Apps Script
 * 2. 將此檔案內容完整貼上並儲存
 * 3. 點選「部署」->「新增部署作業」-> 類型選「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：所有人
 * 4. 複製產生的網頁應用程式網址，貼入網站的 assets/config.js -> GAS_URL
 */

const SHEET_NAME = "門診登記";
const CONFIG_SHEET_NAME = "Config";
const DEFAULT_DOCTOR_PIN = "58100";
const DEFAULT_DOCTOR_TAGS =
  "初診,調藥,行為/情緒長談,證明/鑑定,危機處置,家庭會談";
const GEMINI_MODEL = "gemini-4-hydrogen";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

const HEADERS = [
  "日期",
  "送出時間",
  "看診狀態",
  "就診類型",
  "叫號順序",
  "看診號",
  "姓名",
  "家長",
  "Q1看診狀況",
  "Q2假日服藥",
  "剩餘藥量(天)",
  "近期狀況",
  "勾選問題",
  "其他補充/對話",
  "評估/診斷證明",
  "心理治療紀錄",
  "推薦衛教文章",
  "初診問完時間",
  "開始看診時間",
  "結束看診時間",
  "等待時間(分)",
  "看診時間(分)",
  "測驗暫離(分)",
  "總停留時間(分)",
  "診間屬性",
  "診間備註",
  "計時狀態(系統)",
  "系統ID",
];

const COL = {
  DATE: 1,
  SUBMIT_TIME: 2,
  STATUS: 3,
  VISIT_TYPE: 4,
  QUEUE_ORDER: 5,
  VISIT_NO: 6,
  CHILD_NAME: 7,
  PARENT: 8,
  Q1: 9,
  Q2: 10,
  MED_DAYS: 11,
  RECENT_STATUS: 12,
  ISSUES: 13,
  OTHER_DETAIL: 14,
  CERT_DETAIL: 15,
  THERAPY_NOTE: 16,
  REC_TITLES: 17,
  INTAKE_DONE_TIME: 18,
  START_TIME: 19,
  END_TIME: 20,
  WAIT_MIN: 21,
  CONSULT_MIN: 22,
  PAUSE_MIN: 23,
  TOTAL_MIN: 24,
  DOCTOR_TAGS: 25,
  DOCTOR_NOTE: 26,
  TIMING_JSON: 27,
  ID: 28,
};

const CONFIG_DEFAULTS = [
  [
    "DOCTOR_PIN",
    DEFAULT_DOCTOR_PIN,
    "醫師／護理看板存取密碼（留空則不設密碼，修改後即時生效）",
  ],
  [
    "FIRST_VISIT_CHILD_URL",
    "",
    "初診線上表單網址（兒童青少年版）",
  ],
  [
    "FIRST_VISIT_ADULT_URL",
    "",
    "初診線上表單網址（大人版）",
  ],
  [
    "DOCTOR_TAGS",
    DEFAULT_DOCTOR_TAGS,
    "診間屬性標籤（以半形逗號分隔，看板即時同步）",
  ],
  [
    "MSG_HEADER_DESC",
    "",
    "問卷上方說明文字（留空則使用系統預設）",
  ],
  [
    "MSG_CLOSED_BANNER",
    "",
    "非門診時段暫停填寫提示（留空則使用系統預設）",
  ],
  [
    "MSG_FIRST_VISIT_SELF",
    "",
    "初診「掃碼自填」模式提示語（留空則使用系統預設）",
  ],
  [
    "MSG_FIRST_VISIT_STAFF",
    "",
    "初診「專人詢問」模式提示語（留空則使用系統預設）",
  ],
  [
    "MSG_FIRST_VISIT_DONE",
    "",
    "初診報到完成提示語（留空則使用系統預設）",
  ],
  [
    "MSG_FOLLOWUP_SENT",
    "",
    "複診送出成功頂端提示語（留空則使用系統預設）",
  ],
];

const PUBLIC_CONFIG_KEYS = [
  "FIRST_VISIT_CHILD_URL",
  "FIRST_VISIT_ADULT_URL",
  "MSG_HEADER_DESC",
  "MSG_CLOSED_BANNER",
  "MSG_FIRST_VISIT_SELF",
  "MSG_FIRST_VISIT_STAFF",
  "MSG_FIRST_VISIT_DONE",
  "MSG_FOLLOWUP_SENT",
];

function formatSheetHeader_(sheet) {
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange
    .setBackground("#1f6f78")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  sheet.getRange("B:B").setNumberFormat("@");
  sheet.getRange("F:F").setNumberFormat("@");
  sheet.getRange("R:T").setNumberFormat("@");
  sheet.getRange("AA:AB").setNumberFormat("@");
  sheet.getRange("N:Q").setWrap(true);
  sheet.getRange("Y:Z").setWrap(true);
}

function getSpreadsheet_() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    let ssId = props.getProperty("SPREADSHEET_ID");
    if (ssId) {
      ss = SpreadsheetApp.openById(ssId);
    } else {
      ss = SpreadsheetApp.create("兒青門診登記表");
      props.setProperty("SPREADSHEET_ID", ss.getId());
    }
  }
  return ss;
}

function getOrCreateConfigSheet_(ss) {
  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    configSheet.appendRow(["參數名稱", "參數值", "說明"]);
    configSheet.setFrozenRows(1);
    configSheet
      .getRange(1, 1, 1, 3)
      .setBackground("#1f6f78")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    configSheet.getRange("B:B").setNumberFormat("@");
    CONFIG_DEFAULTS.forEach((row) => configSheet.appendRow(row));
    configSheet.setColumnWidth(1, 210);
    configSheet.setColumnWidth(2, 320);
    configSheet.setColumnWidth(3, 460);
    return configSheet;
  }

  // 自動補齊新版缺少的設定列，不覆蓋既有設定值
  const rows = configSheet.getDataRange().getValues();
  const existingKeys = {};
  for (let i = 1; i < rows.length; i++) {
    const k = String(rows[i][0] || "").trim();
    if (k) existingKeys[k] = true;
  }
  const missing = CONFIG_DEFAULTS.filter((row) => !existingKeys[row[0]]);
  if (missing.length > 0) {
    configSheet.getRange("B:B").setNumberFormat("@");
    missing.forEach((row) => configSheet.appendRow(row));
  }
  return configSheet;
}

function getConfigMap_() {
  const ss = getSpreadsheet_();
  const configSheet = getOrCreateConfigSheet_(ss);
  const rows = configSheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || "").trim();
    if (!key) continue;
    const rawVal = rows[i][1];
    map[key] = rawVal === null || rawVal === undefined ? "" : String(rawVal).trim();
  }
  return map;
}

function getPublicConfig_(configMap) {
  const map = configMap || getConfigMap_();
  const out = {};
  PUBLIC_CONFIG_KEYS.forEach((k) => {
    out[k] = map[k] || "";
  });
  return out;
}

function getDoctorTags_(configMap) {
  const map = configMap || getConfigMap_();
  const raw = map.DOCTOR_TAGS || DEFAULT_DOCTOR_TAGS;
  return raw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getOrCreateSheet_() {
  const ss = getSpreadsheet_();
  getOrCreateConfigSheet_(ss);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet && sheet.getLastRow() > 0) {
    const colCount = sheet.getLastColumn();
    const lastHeader = String(sheet.getRange(1, colCount).getValue() || "");
    const firstHeader = String(sheet.getRange(1, 1).getValue() || "");
    if (
      firstHeader === "ID" ||
      colCount !== HEADERS.length ||
      lastHeader !== "系統ID"
    ) {
      // 舊版欄位格式自動備份，建立新版 28 欄格式
      const baseBackup =
        "門診登記_舊版_" +
        Utilities.formatDate(new Date(), "Asia/Taipei", "MMdd_HHmm");
      let backupName = baseBackup;
      let seq = 2;
      while (ss.getSheetByName(backupName)) {
        backupName = `${baseBackup}_${seq++}`;
      }
      sheet.setName(backupName);
      sheet = null;
    }
  }
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    formatSheetHeader_(sheet);
  } else if (sheet.getLastRow() === 0) {
    formatSheetHeader_(sheet);
  }
  return sheet;
}

function getDoctorPin_() {
  const map = getConfigMap_();
  return map.DOCTOR_PIN !== undefined ? map.DOCTOR_PIN : "";
}

function verifyDoctorPin_(providedPin) {
  const expected = getDoctorPin_();
  if (!expected) return true;
  if (String(providedPin || "").trim() === expected) return true;
  Utilities.sleep(300);
  return false;
}

function requireDoctorAuth_(providedPin) {
  if (!verifyDoctorPin_(providedPin)) {
    return jsonResponse_({
      ok: false,
      unauthorized: true,
      error: "密碼不正確或未授權存取",
    });
  }
  return null;
}

function withSheetLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function isClinicOpen_() {
  const val = PropertiesService.getScriptProperties().getProperty("CLINIC_OPEN");
  return val !== "false";
}

function getFirstVisitMode_() {
  const val = PropertiesService.getScriptProperties().getProperty(
    "FIRST_VISIT_MODE"
  );
  return val === "staff" ? "staff" : "self";
}

function formatHms_(ms) {
  return Utilities.formatDate(new Date(ms), "Asia/Taipei", "HH:mm:ss");
}

function formatCellTime_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Taipei", "HH:mm:ss");
  }
  return String(val || "").trim();
}

function roundMin_(ms) {
  if (!ms || ms <= 0) return "";
  return Math.round((ms / 60000) * 10) / 10;
}

function parseQueueOrder_(visitNo) {
  const m = String(visitNo || "").match(/\d+/);
  return m ? Number(m[0]) : 999999;
}

function parseTiming_(rawJson, dateStr, submitTimeStr) {
  if (rawJson) {
    try {
      const parsed = JSON.parse(String(rawJson));
      if (parsed && typeof parsed === "object") {
        return {
          submitMs: Number(parsed.submitMs) || 0,
          intakeDoneMs: Number(parsed.intakeDoneMs) || 0,
          firstConsultMs: Number(parsed.firstConsultMs) || 0,
          segStartMs: Number(parsed.segStartMs) || 0,
          pauseStartMs: Number(parsed.pauseStartMs) || 0,
          finishedMs: Number(parsed.finishedMs) || 0,
          consultMs: Number(parsed.consultMs) || 0,
          pauseMs: Number(parsed.pauseMs) || 0,
          lang: String(parsed.lang || "zh"),
        };
      }
    } catch (e) {}
  }
  let fallbackSubmit = 0;
  if (dateStr && submitTimeStr) {
    const t = submitTimeStr.length === 5 ? `${submitTimeStr}:00` : submitTimeStr;
    const d = new Date(`${dateStr}T${t}+08:00`);
    if (!isNaN(d.getTime())) fallbackSubmit = d.getTime();
  }
  return {
    submitMs: fallbackSubmit,
    intakeDoneMs: 0,
    firstConsultMs: 0,
    segStartMs: 0,
    pauseStartMs: 0,
    finishedMs: 0,
    consultMs: 0,
    pauseMs: 0,
    lang: "zh",
  };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function buildRecordsList_(sheet, filterDate) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rowDate =
      r[COL.DATE - 1] instanceof Date
        ? Utilities.formatDate(r[COL.DATE - 1], "Asia/Taipei", "yyyy-MM-dd")
        : String(r[COL.DATE - 1] || "");

    if (filterDate !== "all" && rowDate !== filterDate) {
      continue;
    }

    const rowTime = formatCellTime_(r[COL.SUBMIT_TIME - 1]);
    const issuesArr = String(r[COL.ISSUES - 1] || "")
      .split("；")
      .map((s) => s.trim())
      .filter(Boolean);
    const doctorTagsArr = String(r[COL.DOCTOR_TAGS - 1] || "")
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const medRaw = r[COL.MED_DAYS - 1];
    const medDaysStr =
      medRaw === null || medRaw === undefined || String(medRaw).trim() === ""
        ? ""
        : String(medRaw).trim();
    const qOrderRaw = r[COL.QUEUE_ORDER - 1];
    const queueOrder =
      qOrderRaw === null || qOrderRaw === undefined || qOrderRaw === ""
        ? 999999
        : Number(qOrderRaw) || 999999;
    const timing = parseTiming_(r[COL.TIMING_JSON - 1], rowDate, rowTime);

    records.push({
      date: rowDate,
      timestamp: rowTime,
      status: String(r[COL.STATUS - 1] || "待看診"),
      visitType: String(r[COL.VISIT_TYPE - 1] || "複診"),
      queueOrder: queueOrder,
      visitNo: String(r[COL.VISIT_NO - 1] || ""),
      childName: String(r[COL.CHILD_NAME - 1] || ""),
      parent: String(r[COL.PARENT - 1] || ""),
      q1: String(r[COL.Q1 - 1] || ""),
      q2: String(r[COL.Q2 - 1] || ""),
      medDays: medDaysStr,
      recentStatus: String(r[COL.RECENT_STATUS - 1] || ""),
      issues: issuesArr,
      selfHarm: issuesArr.indexOf("傷害自己") !== -1,
      otherDetail: String(r[COL.OTHER_DETAIL - 1] || ""),
      certDetail: String(r[COL.CERT_DETAIL - 1] || ""),
      therapyNote: String(r[COL.THERAPY_NOTE - 1] || ""),
      recommendedTitles: String(r[COL.REC_TITLES - 1] || "")
        .split("；")
        .map((s) => s.trim())
        .filter(Boolean),
      intakeDoneTime: formatCellTime_(r[COL.INTAKE_DONE_TIME - 1]),
      startTime: formatCellTime_(r[COL.START_TIME - 1]),
      endTime: formatCellTime_(r[COL.END_TIME - 1]),
      waitMinutes: r[COL.WAIT_MIN - 1] === "" ? null : Number(r[COL.WAIT_MIN - 1]),
      consultMinutes:
        r[COL.CONSULT_MIN - 1] === "" ? null : Number(r[COL.CONSULT_MIN - 1]),
      pauseMinutes:
        r[COL.PAUSE_MIN - 1] === "" ? null : Number(r[COL.PAUSE_MIN - 1]),
      totalMinutes:
        r[COL.TOTAL_MIN - 1] === "" ? null : Number(r[COL.TOTAL_MIN - 1]),
      doctorTags: doctorTagsArr,
      doctorNote: String(r[COL.DOCTOR_NOTE - 1] || ""),
      timing: timing,
      lang: timing.lang || "zh",
      id: String(r[COL.ID - 1] || ""),
    });
  }

  records.reverse();
  return records;
}

function getRecordsResponse_(requestedDate) {
  const clinicOpen = isClinicOpen_();
  const firstVisitMode = getFirstVisitMode_();
  const configMap = getConfigMap_();
  const sheet = getOrCreateSheet_();
  const todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  const filterDate = requestedDate || todayStr;
  const records = buildRecordsList_(sheet, filterDate);

  return jsonResponse_({
    ok: true,
    date: filterDate,
    clinicOpen: clinicOpen,
    firstVisitMode: firstVisitMode,
    doctorTags: getDoctorTags_(configMap),
    publicConfig: getPublicConfig_(configMap),
    records: records,
  });
}

function doGet(e) {
  const clinicOpen = isClinicOpen_();
  const firstVisitMode = getFirstVisitMode_();
  if (e && e.parameter && e.parameter.action === "status") {
    return jsonResponse_({
      ok: true,
      clinicOpen: clinicOpen,
      firstVisitMode: firstVisitMode,
      publicConfig: getPublicConfig_(),
    });
  }

  const authErr = requireDoctorAuth_(e && e.parameter ? e.parameter.pin : "");
  if (authErr) return authErr;

  return getRecordsResponse_(e && e.parameter ? e.parameter.date : "");
}

function callGeminiJson_(prompt, responseSchema, temperature) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(
    "GEMINI_API_KEY"
  );
  if (!apiKey) return null;

  const modelConfigs = [
    { name: GEMINI_MODEL, thinkingConfig: { thinkingLevel: "low" } },
    { name: GEMINI_FALLBACK_MODEL, thinkingConfig: { thinkingBudget: 0 } },
  ];
  for (let i = 0; i < modelConfigs.length; i++) {
    const modelCfg = modelConfigs[i];
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelCfg.name}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const resp = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: temperature,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            thinkingConfig: modelCfg.thinkingConfig,
          },
        }),
      });

      if (resp.getResponseCode() !== 200) {
        Logger.log(`Gemini ${modelCfg.name} HTTP ${resp.getResponseCode()}: ${resp.getContentText()}`);
        continue;
      }
      const body = JSON.parse(resp.getContentText());
      const parts =
        body &&
        body.candidates &&
        body.candidates[0] &&
        body.candidates[0].content &&
        body.candidates[0].content.parts;
      const textPart = Array.isArray(parts)
        ? parts.find((p) => !p.thought && p.text) || parts[0]
        : null;
      const rawText = textPart && textPart.text;
      if (rawText) {
        return JSON.parse(rawText);
      }
    } catch (err) {
      Logger.log(`Gemini ${modelCfg.name} error: ${err}`);
    }
  }
  return null;
}

function generateBlogGuide_(questionText, candidates, lang) {
  if (!questionText && (!candidates || candidates.length === 0)) {
    return null;
  }

  const isVi = lang === "vi";
  const articlesBlock = (candidates || [])
    .slice(0, 5)
    .map(
      (c, idx) =>
        `【文章 ${idx + 1}】\n標題：${c.title}\n連結：${c.url}\n內容：${c.text}`
    )
    .join("\n\n");

  const prompt = [
    "你是兒童青少年精神科門診的衛教導讀編輯，正在協助候診的家長閱讀林醫師部落格《314風神學院》的文章。",
    isVi
      ? "【語言要求】家長使用越南語（Tiếng Việt），請將 summary 與 followUpQuestion 全部用自然溫暖的「越南語」撰寫；但 therapyNote 與 translatedOtherDetail 必須使用「繁體中文」給醫師看。"
      : "【語言要求】家長使用繁體中文，summary、followUpQuestion 與 therapyNote 皆使用繁體中文。",
    "請根據「家長的問題與狀況」以及「候選文章內容」，嚴格遵守以下規則：",
    "1. 先判斷候選文章是否真的能回答家長的問題。若只是擦邊球、不相關，或家長問的是高度個別化的調藥/劑量問題，請將 suitable 設為 false，不要硬塞文章。",
    isVi
      ? "2. 若 suitable 為 true，請『只根據提供的文章內容』用越南語撰寫一段 200～300 字的導讀，語氣溫暖好讀，禁止自行編造原文以外的醫療建議或劑量指示。結尾請固定加上：「Xem thêm thông tin tại liên kết bên dưới:」"
      : "2. 若 suitable 為 true，請『只根據提供的文章內容』撰寫一段 200～300 字的繁體中文導讀，語氣溫暖好讀，禁止自行編造原文以外的醫療建議或劑量指示。結尾請固定加上：「更多資訊請點選下面連結：」",
    "3. selectedUrls 請填入最相關的 1～2 篇文章連結（必須完全符合上方提供的連結）。",
    "4. 如果家長的問題寫得比較籠統（例如「最近不太好」、「老師說偷東西」、「情緒不好」），或沒有適合的文章，請在 followUpQuestion 提出 1～2 個簡短、好回答的事實釐清問題（例如發生頻率、持續多久、誘發情境），幫醫師先收集脈絡；若問題已很明確且有適合文章，followUpQuestion 可留空字串。",
    "5. 請在 therapyNote 產生一段符合台灣精神科門診病歷記載規範的「支持性／再教育性心理治療紀錄草稿」（必須用繁體中文），嚴格遵守以下原則：",
    "   - 不可出現「衛教」、「看文章」、「部落格」等字眼（健保審查會將純衛教視為一般診察而不予給付），請轉化為心理治療技術用語（如：情緒支持與同理、挫折耐受度引導、認知再架構、行為因應策略訓練、親子溝通界線建立、病識感與治療順從性強化）。",
    "   - 嚴禁虛構尚未發生的診間對話或個案反應！只根據家長已知的主訴與本次心理治療介入方向撰寫。",
    "   - 格式嚴格為：",
    "治療標題：Supportive Psychotherapy（或 Re-educative Psychotherapy） - <具體主題>",
    "相關內容記載：<簡潔個別化的焦點與心理治療介入方向，約 60～120 字>",
    isVi
      ? "6. 若家長的問題中含有越南語文字，請在 translatedOtherDetail 提供精確的繁體中文翻譯；若無則留空字串。"
      : "6. translatedOtherDetail 請留空字串。",
    "",
    `【家長的問題與狀況】\n${questionText || "（無）"}`,
    "",
    articlesBlock ? `【候選文章】\n${articlesBlock}` : "【候選文章】\n（無）",
  ].join("\n");

  const parsed = callGeminiJson_(
    prompt,
    {
      type: "OBJECT",
      properties: {
        suitable: { type: "BOOLEAN" },
        summary: { type: "STRING" },
        followUpQuestion: { type: "STRING" },
        therapyNote: { type: "STRING" },
        translatedOtherDetail: { type: "STRING" },
        selectedUrls: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: [
        "suitable",
        "summary",
        "followUpQuestion",
        "therapyNote",
        "translatedOtherDetail",
        "selectedUrls",
      ],
    },
    0.2
  );

  if (!parsed) return null;
  return {
    suitable: Boolean(parsed.suitable),
    summary: String(parsed.summary || "").trim(),
    followUpQuestion: String(parsed.followUpQuestion || "").trim(),
    therapyNote: formatTherapyNote_(parsed.therapyNote),
    translatedOtherDetail: String(parsed.translatedOtherDetail || "").trim(),
    selectedUrls: Array.isArray(parsed.selectedUrls)
      ? parsed.selectedUrls
      : [],
  };
}

function handleFollowUpChat_(message, history, candidates, lang) {
  const isVi = lang === "vi";
  if (!message) {
    return {
      reply: isVi
        ? "Đã ghi nhận thông tin bổ sung cho bác sĩ. Khi vào khám bác sĩ sẽ trao đổi trực tiếp với bạn."
        : "已幫您把這段補充記錄下來，等一下進診間時醫師會親自為您說明與討論。",
      therapyNote: "",
      translatedMessage: "",
      selectedUrls: [],
    };
  }

  const articlesBlock = (candidates || [])
    .slice(0, 5)
    .map(
      (c, idx) =>
        `【文章 ${idx + 1}】\n標題：${c.title}\n連結：${c.url}\n內容：${c.text}`
    )
    .join("\n\n");

  const historyBlock = (history || [])
    .slice(-6)
    .map((h) => `${h.role === "user" ? "家長" : "小幫手"}：${h.text}`)
    .join("\n");

  const prompt = [
    "你是兒童青少年精神科門診的候診小幫手，正在與候診中的家長對話。",
    isVi
      ? "【語言要求】家長使用越南語（Tiếng Việt），reply 請用自然溫暖的「越南語」回覆；therapyNote 與 translatedMessage 必須使用「繁體中文」給醫師看。"
      : "【語言要求】請使用繁體中文回覆。",
    "家長可能有兩種情況：",
    "A. 回答你剛才的釐清追問（補充孩子狀況的細節）→ 請溫暖簡短地確認已記錄給醫師，若仍有重要脈絡（如頻率、情境）未清楚可再補問最多 1 題。",
    "B. 看完文章後有好奇的延伸問題 → 請『嚴格只根據下方提供的部落格文章』回答（120～220 字）；若文章沒有涵蓋或涉及個別調藥/診斷，絕對不可自行編造，請誠實告知需等進診間由醫師親自依孩子個別狀況評估解答。",
    "",
    "另外：",
    "- 若本輪有從下方文章中挑選並附上連結（selectedUrls 非空），請同時在 therapyNote 產出一段更新後的「支持性／再教育性心理治療紀錄」（繁體中文，不可出現「衛教」、「看文章」、「部落格」等字眼，不腦補尚未發生的會談反應，格式嚴格為：治療標題：Supportive Psychotherapy（或 Re-educative Psychotherapy） - <具體主題>\\n相關內容記載：<約 60～120 字>）。",
    "- 若本輪沒有附上新文章（selectedUrls 為空），therapyNote 請留空字串 \"\"。",
    isVi
      ? "- 若家長最新訊息為越南語，請在 translatedMessage 提供精確的繁體中文翻譯；否則留空字串。"
      : "- translatedMessage 請留空字串。",
    "",
    historyBlock ? `【先前對話】\n${historyBlock}\n` : "",
    `【家長最新訊息】\n${message}\n`,
    articlesBlock ? `【可參考的《314風神學院》文章】\n${articlesBlock}` : "",
  ].join("\n");

  const parsed = callGeminiJson_(
    prompt,
    {
      type: "OBJECT",
      properties: {
        reply: { type: "STRING" },
        therapyNote: { type: "STRING" },
        translatedMessage: { type: "STRING" },
        selectedUrls: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: ["reply", "therapyNote", "translatedMessage", "selectedUrls"],
    },
    0.25
  );

  if (!parsed) {
    return {
      reply: isVi
        ? "Đã ghi nhận thông tin bổ sung! Bác sĩ sẽ trao đổi trực tiếp với bạn khi vào khám."
        : "收到您的補充！我已經幫您記錄下來，等一下進診間時醫師會親自為您說明。",
      therapyNote: "",
      translatedMessage: "",
      selectedUrls: [],
    };
  }

  return {
    reply: String(parsed.reply || "").trim(),
    therapyNote: formatTherapyNote_(parsed.therapyNote),
    translatedMessage: String(parsed.translatedMessage || "").trim(),
    selectedUrls: Array.isArray(parsed.selectedUrls)
      ? parsed.selectedUrls
      : [],
  };
}

function formatTherapyNote_(text) {
  return String(text || "")
    .trim()
    .replace(/\s*(相關內容記載：)/g, "\n$1");
}

function rewriteTherapyNote_(targetType, currentNote, contextText) {
  const isSupportive = targetType === "Supportive";
  const typeLabel = isSupportive
    ? "Supportive Psychotherapy"
    : "Re-educative Psychotherapy";
  const styleGuide = isSupportive
    ? "重點放在：情緒承接與同理、減輕症狀與教養壓力負荷、維繫治療聯盟與疾病適應支持。"
    : "重點放在：病識感建立、認知再架構、具體行為修正與環境／執行功能適應技巧引導。";

  const prompt = [
    `請將以下兒童青少年精神科心理治療紀錄草稿改寫為「${typeLabel}」格式（繁體中文）。`,
    styleGuide,
    "嚴格遵守：",
    "1. 不可出現「衛教」、「看文章」、「部落格」等字眼。",
    "2. 嚴禁虛構尚未發生的診間對話或個案反應，只依據既有事實與臨床切入點撰寫。",
    "3. 格式嚴格為：",
    `治療標題：${typeLabel} - <具體主題>`,
    "相關內容記載：<約 60～120 字>",
    "",
    `【原紀錄】\n${currentNote || "（無）"}`,
    `【個案補充背景】\n${contextText || "（無）"}`,
  ].join("\n");

  const parsed = callGeminiJson_(
    prompt,
    {
      type: "OBJECT",
      properties: {
        therapyNote: { type: "STRING" },
      },
      required: ["therapyNote"],
    },
    0.2
  );

  return parsed && parsed.therapyNote
    ? formatTherapyNote_(parsed.therapyNote)
    : "";
}

function findRowIndexById_(rows, targetId) {
  if (!targetId) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.ID - 1]) === targetId) return i;
  }
  return -1;
}

function writeRowCells_(sheet, rowNum, colValueMap) {
  Object.keys(colValueMap).forEach((colKey) => {
    sheet.getRange(rowNum, Number(colKey)).setValue(colValueMap[colKey]);
  });
}

function finalizeToDone_(sheet, rowIdx0, rowArr, nowMs) {
  const rowDate =
    rowArr[COL.DATE - 1] instanceof Date
      ? Utilities.formatDate(rowArr[COL.DATE - 1], "Asia/Taipei", "yyyy-MM-dd")
      : String(rowArr[COL.DATE - 1] || "");
  const submitTimeStr = formatCellTime_(rowArr[COL.SUBMIT_TIME - 1]);
  const timing = parseTiming_(
    rowArr[COL.TIMING_JSON - 1],
    rowDate,
    submitTimeStr
  );
  if (timing.segStartMs) {
    timing.consultMs += Math.max(0, nowMs - timing.segStartMs);
    timing.segStartMs = 0;
  }
  if (timing.pauseStartMs) {
    timing.pauseMs += Math.max(0, nowMs - timing.pauseStartMs);
    timing.pauseStartMs = 0;
  }
  timing.finishedMs = nowMs;
  const totalMs = timing.submitMs ? Math.max(0, nowMs - timing.submitMs) : 0;

  const updates = {};
  updates[COL.STATUS] = "已看診";
  updates[COL.END_TIME] = formatHms_(nowMs);
  updates[COL.CONSULT_MIN] = roundMin_(timing.consultMs);
  updates[COL.PAUSE_MIN] = roundMin_(timing.pauseMs);
  updates[COL.TOTAL_MIN] = roundMin_(totalMs);
  updates[COL.TIMING_JSON] = JSON.stringify(timing);
  writeRowCells_(sheet, rowIdx0 + 1, updates);
}

function applyTransition_(sheet, rows, rowIdx0, targetStatus, nowMs, autoFinishOther) {
  const rowArr = rows[rowIdx0];
  const rowDate =
    rowArr[COL.DATE - 1] instanceof Date
      ? Utilities.formatDate(rowArr[COL.DATE - 1], "Asia/Taipei", "yyyy-MM-dd")
      : String(rowArr[COL.DATE - 1] || "");
  const submitTimeStr = formatCellTime_(rowArr[COL.SUBMIT_TIME - 1]);
  const timing = parseTiming_(
    rowArr[COL.TIMING_JSON - 1],
    rowDate,
    submitTimeStr
  );
  const updates = {};

  if (targetStatus === "初診已問完") {
    if (!timing.intakeDoneMs) {
      timing.intakeDoneMs = nowMs;
      updates[COL.INTAKE_DONE_TIME] = formatHms_(nowMs);
    }
    updates[COL.STATUS] = "初診已問完";
  } else if (targetStatus === "看診中") {
    if (autoFinishOther !== false) {
      for (let i = 1; i < rows.length; i++) {
        if (i === rowIdx0) continue;
        const otherDate =
          rows[i][COL.DATE - 1] instanceof Date
            ? Utilities.formatDate(
                rows[i][COL.DATE - 1],
                "Asia/Taipei",
                "yyyy-MM-dd"
              )
            : String(rows[i][COL.DATE - 1] || "");
        if (
          otherDate === rowDate &&
          String(rows[i][COL.STATUS - 1] || "") === "看診中"
        ) {
          finalizeToDone_(sheet, i, rows[i], nowMs);
        }
      }
    }
    if (timing.pauseStartMs) {
      timing.pauseMs += Math.max(0, nowMs - timing.pauseStartMs);
      timing.pauseStartMs = 0;
      updates[COL.PAUSE_MIN] = roundMin_(timing.pauseMs);
    }
    if (!timing.firstConsultMs) {
      timing.firstConsultMs = nowMs;
      updates[COL.START_TIME] = formatHms_(nowMs);
      if (timing.submitMs) {
        updates[COL.WAIT_MIN] = roundMin_(
          Math.max(0, nowMs - timing.submitMs)
        );
      }
    }
    timing.segStartMs = nowMs;
    timing.finishedMs = 0;
    updates[COL.END_TIME] = "";
    updates[COL.TOTAL_MIN] = "";
    updates[COL.STATUS] = "看診中";
  } else if (targetStatus === "測驗／問卷中") {
    if (timing.segStartMs) {
      timing.consultMs += Math.max(0, nowMs - timing.segStartMs);
      timing.segStartMs = 0;
      updates[COL.CONSULT_MIN] = roundMin_(timing.consultMs);
    }
    if (!timing.pauseStartMs) {
      timing.pauseStartMs = nowMs;
    }
    updates[COL.STATUS] = "測驗／問卷中";
  } else if (targetStatus === "測驗完成待看") {
    if (timing.pauseStartMs) {
      timing.pauseMs += Math.max(0, nowMs - timing.pauseStartMs);
      timing.pauseStartMs = 0;
      updates[COL.PAUSE_MIN] = roundMin_(timing.pauseMs);
    }
    updates[COL.STATUS] = "測驗完成待看";
  } else if (targetStatus === "已看診") {
    finalizeToDone_(sheet, rowIdx0, rowArr, nowMs);
    return;
  } else {
    // 恢復待看診／初診待問
    if (timing.segStartMs) {
      timing.consultMs += Math.max(0, nowMs - timing.segStartMs);
      timing.segStartMs = 0;
      updates[COL.CONSULT_MIN] = roundMin_(timing.consultMs);
    }
    if (timing.pauseStartMs) {
      timing.pauseMs += Math.max(0, nowMs - timing.pauseStartMs);
      timing.pauseStartMs = 0;
      updates[COL.PAUSE_MIN] = roundMin_(timing.pauseMs);
    }
    timing.finishedMs = 0;
    updates[COL.END_TIME] = "";
    updates[COL.TOTAL_MIN] = "";
    const visitType = String(rowArr[COL.VISIT_TYPE - 1] || "");
    const fallbackStatus =
      visitType.indexOf("初診") === 0 && !timing.intakeDoneMs
        ? "初診待問"
        : "待看診";
    updates[COL.STATUS] =
      targetStatus === "初診待問" ? "初診待問" : fallbackStatus;
  }

  updates[COL.TIMING_JSON] = JSON.stringify(timing);
  writeRowCells_(sheet, rowIdx0 + 1, updates);
}

function updateRowOnFollowUp_(sheet, targetId, noteText, newTherapyNote, newTitles) {
  const rows = sheet.getDataRange().getValues();
  const idx = findRowIndexById_(rows, targetId);
  if (idx === -1) return;

  if (noteText) {
    const existing = String(rows[idx][COL.OTHER_DETAIL - 1] || "").trim();
    const updated = existing
      ? `${existing}\n[對話補充] ${noteText}`
      : `[對話補充] ${noteText}`;
    sheet.getRange(idx + 1, COL.OTHER_DETAIL).setValue(updated);
  }
  if (newTherapyNote) {
    sheet.getRange(idx + 1, COL.THERAPY_NOTE).setValue(newTherapyNote);
  }
  if (newTitles && newTitles.length > 0) {
    const existingTitles = String(rows[idx][COL.REC_TITLES - 1] || "")
      .split("；")
      .map((s) => s.trim())
      .filter(Boolean);
    newTitles.forEach((t) => {
      if (existingTitles.indexOf(t) === -1) existingTitles.push(t);
    });
    sheet.getRange(idx + 1, COL.REC_TITLES).setValue(existingTitles.join("；"));
  }
}

function buildNewRowArray_(params) {
  const nowMs = params.nowMs || Date.now();
  const dateStr = Utilities.formatDate(
    new Date(nowMs),
    "Asia/Taipei",
    "yyyy-MM-dd"
  );
  const submitTimeStr = formatHms_(nowMs);
  const initialStatus = params.status || "待看診";
  const timing = {
    submitMs: nowMs,
    intakeDoneMs: initialStatus === "初診已問完" ? nowMs : 0,
    firstConsultMs: initialStatus === "看診中" ? nowMs : 0,
    segStartMs: initialStatus === "看診中" ? nowMs : 0,
    pauseStartMs: 0,
    finishedMs: 0,
    consultMs: 0,
    pauseMs: 0,
    lang: params.lang || "zh",
  };

  const row = new Array(HEADERS.length).fill("");
  row[COL.DATE - 1] = dateStr;
  row[COL.SUBMIT_TIME - 1] = submitTimeStr;
  row[COL.STATUS - 1] = initialStatus;
  row[COL.VISIT_TYPE - 1] = params.visitType || "複診";
  row[COL.QUEUE_ORDER - 1] = parseQueueOrder_(params.visitNo);
  row[COL.VISIT_NO - 1] = params.visitNo || "";
  row[COL.CHILD_NAME - 1] = params.childName || "";
  row[COL.PARENT - 1] = params.parent || "";
  row[COL.Q1 - 1] = params.q1 || "";
  row[COL.Q2 - 1] = params.q2 || "";
  row[COL.MED_DAYS - 1] = params.medDays || "";
  row[COL.RECENT_STATUS - 1] = params.recentStatus || "";
  row[COL.ISSUES - 1] = params.issuesText || "";
  row[COL.OTHER_DETAIL - 1] = params.otherDetail || "";
  row[COL.CERT_DETAIL - 1] = params.certText || "";
  row[COL.THERAPY_NOTE - 1] = params.therapyNote || "";
  row[COL.REC_TITLES - 1] = params.recommendedTitlesText || "";
  row[COL.INTAKE_DONE_TIME - 1] =
    initialStatus === "初診已問完" ? submitTimeStr : "";
  row[COL.START_TIME - 1] = initialStatus === "看診中" ? submitTimeStr : "";
  row[COL.WAIT_MIN - 1] = initialStatus === "看診中" ? 0 : "";
  row[COL.DOCTOR_TAGS - 1] = params.doctorTags || "";
  row[COL.DOCTOR_NOTE - 1] = params.doctorNote || "";
  row[COL.TIMING_JSON - 1] = JSON.stringify(timing);
  row[COL.ID - 1] = params.id;
  return row;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.action === "checkPinStatus") {
      return jsonResponse_({
        ok: true,
        pinRequired: getDoctorPin_() !== "",
      });
    }

    if (payload.action === "verifyPin") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      return jsonResponse_({
        ok: true,
        pinRequired: getDoctorPin_() !== "",
      });
    }

    if (payload.action === "getRecords") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      return getRecordsResponse_(payload.date);
    }

    if (payload.action === "setClinicOpen") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const nextOpen = Boolean(payload.open);
      PropertiesService.getScriptProperties().setProperty(
        "CLINIC_OPEN",
        nextOpen ? "true" : "false"
      );
      return jsonResponse_({ ok: true, clinicOpen: nextOpen });
    }

    if (payload.action === "setFirstVisitMode") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const nextMode = payload.mode === "staff" ? "staff" : "self";
      PropertiesService.getScriptProperties().setProperty(
        "FIRST_VISIT_MODE",
        nextMode
      );
      return jsonResponse_({ ok: true, firstVisitMode: nextMode });
    }

    if (
      payload.action === "transitionStatus" ||
      payload.action === "markDone"
    ) {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const targetId = String(payload.id || "");
      const nextStatus = String(
        payload.targetStatus || payload.status || "已看診"
      );
      const nowMs = Date.now();
      const found = withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        const rows = sheet.getDataRange().getValues();
        const idx = findRowIndexById_(rows, targetId);
        if (idx === -1) return false;
        applyTransition_(
          sheet,
          rows,
          idx,
          nextStatus,
          nowMs,
          payload.autoFinishOther !== false
        );
        return true;
      });
      if (!found) {
        return jsonResponse_({ ok: false, error: "找不到該筆資料" });
      }
      return getRecordsResponse_(payload.date);
    }

    if (payload.action === "updateDoctorMeta") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const targetId = String(payload.id || "");
      const found = withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        const rows = sheet.getDataRange().getValues();
        const idx = findRowIndexById_(rows, targetId);
        if (idx === -1) return false;
        const updates = {};
        if (Array.isArray(payload.doctorTags)) {
          updates[COL.DOCTOR_TAGS] = payload.doctorTags
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .join(", ");
        }
        if (payload.doctorNote !== undefined) {
          updates[COL.DOCTOR_NOTE] = String(payload.doctorNote || "");
        }
        if (
          payload.queueOrder !== undefined &&
          payload.queueOrder !== null &&
          !isNaN(Number(payload.queueOrder))
        ) {
          updates[COL.QUEUE_ORDER] = Number(payload.queueOrder);
        }
        writeRowCells_(sheet, idx + 1, updates);
        return true;
      });
      if (!found) {
        return jsonResponse_({ ok: false, error: "找不到該筆資料" });
      }
      return jsonResponse_({ ok: true, id: targetId });
    }

    if (payload.action === "quickAddPatient") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const nowMs = Date.now();
      const id =
        Utilities.formatDate(new Date(nowMs), "Asia/Taipei", "HHmmss") +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      const isFirst = payload.isFirstVisit === true;
      const visitType = isFirst ? "初診(快速登錄)" : "複診(快速登錄)";
      const initialStatus = String(
        payload.initialStatus || (isFirst ? "初診已問完" : "待看診")
      );
      const row = buildNewRowArray_({
        nowMs: nowMs,
        id: id,
        status: initialStatus,
        visitType: visitType,
        visitNo: String(payload.visitNo || "").trim(),
        childName: String(payload.childName || "").trim(),
        doctorTags: isFirst ? "初診" : "",
        doctorNote: String(payload.doctorNote || "").trim(),
        lang: "zh",
      });
      withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        if (initialStatus === "看診中") {
          const rows = sheet.getDataRange().getValues();
          const todayStr = Utilities.formatDate(
            new Date(nowMs),
            "Asia/Taipei",
            "yyyy-MM-dd"
          );
          for (let i = 1; i < rows.length; i++) {
            const otherDate =
              rows[i][COL.DATE - 1] instanceof Date
                ? Utilities.formatDate(
                    rows[i][COL.DATE - 1],
                    "Asia/Taipei",
                    "yyyy-MM-dd"
                  )
                : String(rows[i][COL.DATE - 1] || "");
            if (
              otherDate === todayStr &&
              String(rows[i][COL.STATUS - 1] || "") === "看診中"
            ) {
              finalizeToDone_(sheet, i, rows[i], nowMs);
            }
          }
        }
        sheet.appendRow(row);
      });
      return getRecordsResponse_(payload.date);
    }

    if (payload.action === "rewriteTherapyNote") {
      const authErr = requireDoctorAuth_(payload.pin);
      if (authErr) return authErr;
      const targetId = String(payload.id || "");
      const targetType =
        payload.targetType === "Supportive" ? "Supportive" : "Re-educative";
      const newNote = rewriteTherapyNote_(
        targetType,
        String(payload.currentNote || ""),
        String(payload.context || "")
      );
      if (!newNote) {
        return jsonResponse_({ ok: false, error: "改寫失敗，請稍後再試" });
      }
      const updated = withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        const rows = sheet.getDataRange().getValues();
        const idx = findRowIndexById_(rows, targetId);
        if (idx === -1) return false;
        sheet.getRange(idx + 1, COL.THERAPY_NOTE).setValue(newNote);
        return true;
      });
      if (updated) {
        return jsonResponse_({ ok: true, id: targetId, therapyNote: newNote });
      }
      return jsonResponse_({ ok: false, error: "找不到該筆資料" });
    }

    if (!isClinicOpen_()) {
      return jsonResponse_({
        ok: false,
        closed: true,
        error: "目前為非門診時段，已暫停填寫。",
      });
    }

    if (payload.action === "chat") {
      const targetId = String(payload.id || "");
      const message = String(payload.message || "").trim();
      const lang = String(payload.lang || "zh");
      const candidates = payload.candidates || [];
      const chatRes = handleFollowUpChat_(
        message,
        payload.history || [],
        candidates,
        lang
      );
      const hasNewArticles =
        chatRes.selectedUrls && chatRes.selectedUrls.length > 0;
      const newTitles = hasNewArticles
        ? candidates
            .filter((c) => chatRes.selectedUrls.indexOf(c.url) !== -1)
            .map((c) => c.title)
        : [];
      const noteForDoctor =
        lang === "vi" && chatRes.translatedMessage
          ? `${message}（翻譯：${chatRes.translatedMessage}）`
          : message;
      withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        updateRowOnFollowUp_(
          sheet,
          targetId,
          noteForDoctor,
          hasNewArticles ? chatRes.therapyNote : "",
          newTitles
        );
      });
      return jsonResponse_({
        ok: true,
        reply: chatRes.reply,
        selectedUrls: chatRes.selectedUrls,
      });
    }

    // 預設：新增門診登記（支援初診報到 ＆ 複診問卷）
    const d = payload.data || {};
    const lang = String(payload.lang || "zh");
    const nowMs = Date.now();
    const id =
      Utilities.formatDate(new Date(nowMs), "Asia/Taipei", "HHmmss") +
      "-" +
      Math.floor(1000 + Math.random() * 9000);

    const isFirstVisit = d.visitCategory === "first";
    if (isFirstVisit) {
      const firstVisitMode = getFirstVisitMode_();
      const visitType =
        firstVisitMode === "staff"
          ? "初診(專人問)"
          : d.firstVisitTarget === "adult"
          ? "初診(大人/自填)"
          : "初診(兒青/自填)";
      const row = buildNewRowArray_({
        nowMs: nowMs,
        id: id,
        status: "初診待問",
        visitType: visitType,
        visitNo: String(d.visitNo || "").trim(),
        childName: String(d.childName || "").trim(),
        doctorTags: "初診",
        lang: lang,
      });
      withSheetLock_(() => {
        const sheet = getOrCreateSheet_();
        sheet.appendRow(row);
      });
      return jsonResponse_({
        ok: true,
        id: id,
        isFirstVisit: true,
        firstVisitMode: firstVisitMode,
        aiGuide: null,
      });
    }

    const certText = d.needCert
      ? d.certDetail || "需要評估/診斷證明（未填細節）"
      : "";

    // 若狀況穩定純拿藥且無補充問題，不產出心理治療紀錄
    const hasClinicalIssue =
      (d.issues && d.issues.length > 0) ||
      Boolean((d.otherDetail || "").trim()) ||
      d.q1 === "要與醫師討論";

    // 若無自傷風險且有提供候選文章，請 Gemini 判斷適配度並產出導讀
    let aiGuide = null;
    if (
      !d.selfHarm &&
      (payload.questionText ||
        (payload.candidates && payload.candidates.length > 0))
    ) {
      aiGuide = generateBlogGuide_(
        payload.questionText,
        payload.candidates,
        lang
      );
    }

    const recommendedTitles =
      aiGuide && aiGuide.suitable && aiGuide.selectedUrls.length > 0
        ? (payload.candidates || [])
            .filter((c) => aiGuide.selectedUrls.indexOf(c.url) !== -1)
            .map((c) => c.title)
        : aiGuide && aiGuide.suitable === false
        ? []
        : d.recommendedTitles || [];

    const therapyNote =
      hasClinicalIssue && aiGuide && aiGuide.therapyNote
        ? aiGuide.therapyNote
        : "";

    const otherDetailText =
      lang === "vi" &&
      aiGuide &&
      aiGuide.translatedOtherDetail &&
      d.otherDetail
        ? `${d.otherDetail}（翻譯：${aiGuide.translatedOtherDetail}）`
        : d.otherDetail || "";

    const medDaysVal =
      d.medDays !== undefined &&
      d.medDays !== null &&
      String(d.medDays).trim() !== ""
        ? String(d.medDays).trim()
        : "";

    const row = buildNewRowArray_({
      nowMs: nowMs,
      id: id,
      status: "待看診",
      visitType: "複診",
      visitNo: String(d.visitNo || "").trim(),
      childName: String(d.childName || "").trim(),
      parent: d.parent || "",
      q1: d.q1 || "",
      q2: d.q2 || "",
      medDays: medDaysVal,
      recentStatus: d.recentStatus || "",
      issuesText: (d.issues || []).join("；"),
      otherDetail: otherDetailText,
      certText: certText,
      therapyNote: therapyNote,
      recommendedTitlesText: recommendedTitles.join("；"),
      lang: lang,
    });

    withSheetLock_(() => {
      const sheet = getOrCreateSheet_();
      sheet.appendRow(row);
    });

    return jsonResponse_({ ok: true, id: id, aiGuide: aiGuide });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}
