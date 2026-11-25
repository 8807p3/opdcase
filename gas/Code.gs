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
const GEMINI_MODEL = "gemini-2.5-flash";
const HEADERS = [
  "ID",
  "登記時間",
  "日期",
  "小朋友姓名/診號",
  "同來家長",
  "Q1看診狀況",
  "Q2假日服藥",
  "剩餘藥量(天)",
  "近期狀況",
  "勾選問題",
  "自傷風險",
  "其他補充",
  "評估診斷證明",
  "系統推薦文章",
  "看診狀態",
];

function getOrCreateSheet_() {
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
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  const sheet = getOrCreateSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return jsonResponse_({ ok: true, records: [] });
  }

  const todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  const filterDate = (e && e.parameter && e.parameter.date) || todayStr;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rowDate =
      r[2] instanceof Date
        ? Utilities.formatDate(r[2], "Asia/Taipei", "yyyy-MM-dd")
        : String(r[2] || "");

    if (filterDate !== "all" && rowDate !== filterDate) {
      continue;
    }

    const rowTime =
      r[1] instanceof Date
        ? Utilities.formatDate(r[1], "Asia/Taipei", "HH:mm")
        : String(r[1] || "");

    records.push({
      id: String(r[0] || ""),
      timestamp: rowTime,
      date: rowDate,
      childName: String(r[3] || ""),
      parent: String(r[4] || ""),
      q1: String(r[5] || ""),
      q2: String(r[6] || ""),
      medDays: String(r[7] || ""),
      recentStatus: String(r[8] || ""),
      issues: String(r[9] || "")
        .split("；")
        .map((s) => s.trim())
        .filter(Boolean),
      selfHarm: r[10] === true || String(r[10]) === "是",
      otherDetail: String(r[11] || ""),
      certDetail: String(r[12] || ""),
      recommendedTitles: String(r[13] || "")
        .split("；")
        .map((s) => s.trim())
        .filter(Boolean),
      status: String(r[14] || "待看診"),
    });
  }

  // 最新的在最前面
  records.reverse();
  return jsonResponse_({ ok: true, date: filterDate, records: records });
}

function generateBlogGuide_(questionText, candidates) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(
    "GEMINI_API_KEY"
  );
  if (!apiKey || !questionText || !candidates || candidates.length === 0) {
    return null;
  }

  const articlesBlock = candidates
    .slice(0, 4)
    .map(
      (c, idx) =>
        `【文章 ${idx + 1}】\n標題：${c.title}\n連結：${c.url}\n內容：${c.text}`
    )
    .join("\n\n");

  const prompt = [
    "你是兒童青少年精神科門診的衛教導讀編輯，正在協助候診的家長閱讀林醫師部落格《314風神學院》的文章。",
    "請根據「家長的問題與狀況」以及「候選文章內容」，嚴格遵守以下規則：",
    "1. 先判斷候選文章是否真的能回答家長的問題。若只是擦邊球、不相關，或家長問的是高度個別化的調藥/劑量問題，請將 suitable 設為 false，不要硬塞文章。",
    "2. 若 suitable 為 true，請『只根據提供的文章內容』撰寫一段 200～300 字的繁體中文導讀，語氣溫暖好讀，禁止自行編造原文以外的醫療建議或劑量指示。結尾請固定加上：「更多資訊請點選下面連結：」",
    "3. selectedUrls 請填入最相關的 1～2 篇文章連結（必須完全符合上方提供的連結）。",
    "4. 如果家長的問題寫得比較籠統（例如「最近不太好」、「老師說偷東西」、「情緒不好」），或沒有適合的文章，請在 followUpQuestion 提出 1～2 個簡短、好回答的事實釐清問題（例如發生頻率、持續多久、誘發情境），幫醫師先收集脈絡；若問題已很明確且有適合文章，followUpQuestion 可留空字串。",
    "",
    `【家長的問題與狀況】\n${questionText}`,
    "",
    `【候選文章】\n${articlesBlock}`,
  ].join("\n");

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const resp = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              suitable: { type: "BOOLEAN" },
              summary: { type: "STRING" },
              followUpQuestion: { type: "STRING" },
              selectedUrls: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
            },
            required: ["suitable", "summary", "followUpQuestion", "selectedUrls"],
          },
        },
      }),
    });

    if (resp.getResponseCode() !== 200) {
      return null;
    }
    const body = JSON.parse(resp.getContentText());
    const rawText =
      body &&
      body.candidates &&
      body.candidates[0] &&
      body.candidates[0].content &&
      body.candidates[0].content.parts &&
      body.candidates[0].content.parts[0] &&
      body.candidates[0].content.parts[0].text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText);
    return {
      suitable: Boolean(parsed.suitable),
      summary: String(parsed.summary || "").trim(),
      followUpQuestion: String(parsed.followUpQuestion || "").trim(),
      selectedUrls: Array.isArray(parsed.selectedUrls)
        ? parsed.selectedUrls
        : [],
    };
  } catch (err) {
    return null;
  }
}

function handleFollowUpChat_(message, history, candidates) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(
    "GEMINI_API_KEY"
  );
  if (!apiKey || !message) {
    return {
      reply:
        "已幫您把這段補充記錄下來，等一下進診間時醫師會親自為您說明與討論。",
      selectedUrls: [],
    };
  }

  const articlesBlock = (candidates || [])
    .slice(0, 4)
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
    "家長可能有兩種情況：",
    "A. 回答你剛才的釐清追問（補充孩子狀況的細節）→ 請溫暖簡短地確認已記錄給醫師，若仍有重要脈絡（如頻率、情境）未清楚可再補問最多 1 題。",
    "B. 看完衛教文章後有好奇的延伸問題 → 請『嚴格只根據下方提供的部落格文章』回答（120～220 字）；若文章沒有涵蓋或涉及個別調藥/診斷，絕對不可自行編造，請誠實告知：「這個問題需要醫師依孩子的個別狀況評估，我已經幫您記下來，進診間時由醫師親自為您解答。」",
    "",
    historyBlock ? `【先前對話】\n${historyBlock}\n` : "",
    `【家長最新訊息】\n${message}\n`,
    articlesBlock ? `【可參考的《314風神學院》文章】\n${articlesBlock}` : "",
  ].join("\n");

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const resp = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reply: { type: "STRING" },
              selectedUrls: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
            },
            required: ["reply", "selectedUrls"],
          },
        },
      }),
    });

    if (resp.getResponseCode() !== 200) throw new Error("Gemini error");
    const body = JSON.parse(resp.getContentText());
    const rawText =
      body.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawText);
    return {
      reply: String(parsed.reply || "").trim(),
      selectedUrls: Array.isArray(parsed.selectedUrls)
        ? parsed.selectedUrls
        : [],
    };
  } catch (err) {
    return {
      reply:
        "收到您的補充！我已經幫您記錄下來，等一下進診間時醫師會親自為您說明。",
      selectedUrls: [],
    };
  }
}

function appendNoteToRow_(sheet, targetId, noteText) {
  if (!targetId || !noteText) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === targetId) {
      const existing = String(rows[i][11] || "").trim();
      const updated = existing
        ? `${existing}\n[對話補充] ${noteText}`
        : `[對話補充] ${noteText}`;
      sheet.getRange(i + 1, 12).setValue(updated);
      return;
    }
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = getOrCreateSheet_();

    if (payload.action === "chat") {
      const targetId = String(payload.id || "");
      const message = String(payload.message || "").trim();
      appendNoteToRow_(sheet, targetId, message);
      const chatRes = handleFollowUpChat_(
        message,
        payload.history || [],
        payload.candidates || []
      );
      return jsonResponse_({
        ok: true,
        reply: chatRes.reply,
        selectedUrls: chatRes.selectedUrls,
      });
    }

    if (payload.action === "markDone") {
      const targetId = String(payload.id || "");
      const nextStatus = String(payload.status || "已看診");
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === targetId) {
          sheet.getRange(i + 1, 15).setValue(nextStatus);
          return jsonResponse_({ ok: true, id: targetId, status: nextStatus });
        }
      }
      return jsonResponse_({ ok: false, error: "找不到該筆資料" });
    }

    // 預設：新增門診登記
    const d = payload.data || {};
    const now = new Date();
    const id =
      Utilities.formatDate(now, "Asia/Taipei", "HHmmss") +
      "-" +
      Math.floor(1000 + Math.random() * 9000);
    const timeStr = Utilities.formatDate(now, "Asia/Taipei", "HH:mm");
    const dateStr = Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM-dd");

    const certText = d.needCert
      ? d.certDetail || "需要評估/診斷證明（未填細節）"
      : "";

    // 若無自傷風險且有提供候選文章，請 Gemini 判斷適配度並產出導讀
    let aiGuide = null;
    if (!d.selfHarm && payload.questionText && payload.candidates) {
      aiGuide = generateBlogGuide_(payload.questionText, payload.candidates);
    }

    const recommendedTitles =
      aiGuide && aiGuide.suitable && aiGuide.selectedUrls.length > 0
        ? (payload.candidates || [])
            .filter((c) => aiGuide.selectedUrls.indexOf(c.url) !== -1)
            .map((c) => c.title)
        : aiGuide && aiGuide.suitable === false
        ? []
        : d.recommendedTitles || [];

    sheet.appendRow([
      id,
      timeStr,
      dateStr,
      d.childName || "",
      d.parent || "",
      d.q1 || "",
      d.q2 || "",
      d.medDays || "",
      d.recentStatus || "",
      (d.issues || []).join("；"),
      d.selfHarm ? "是" : "否",
      d.otherDetail || "",
      certText,
      recommendedTitles.join("；"),
      "待看診",
    ]);

    return jsonResponse_({ ok: true, id: id, aiGuide: aiGuide });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}
