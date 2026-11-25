// 系統設定檔
// 完成 Google Apps Script 部署後，請將網址貼到下方的 GAS_URL 引號內。
// 若留空，網頁仍可正常使用（會於手機畫面產生看診重點小卡，並搜尋部落格文章）。

window.CLINIC_CONFIG = {
  // 範例: "https://script.google.com/macros/s/AKfycb.../exec"
  GAS_URL: "https://script.google.com/macros/s/AKfycbw6lYZ5FE2wI3M8dv4DIaop8LFl1ywR_f6vWzobddW9egXrM-dblZU4Qk8FKMbcxHxb/exec",

  // 醫師看板密碼 (DOCTOR_PIN) 已移至 Google 試算表「Config」分頁並由 GAS 後端驗證
  // 診間看板自動更新間隔（毫秒）
  POLL_INTERVAL_MS: 15000,
};
