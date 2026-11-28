# 兒青門診 看診前調查表 ＆《314風神學院》衛教推薦系統

專為兒童青少年精神科門診設計的候診輔助與診間效率看板系統：
- **家長／個案端 (`index.html`)**：
  - 支援 **繁體中文 ⇄ Tiếng Việt（越南語）** 雙語切換，並可記憶小朋友姓名免重複輸入。
  - **初診／複診自動分流**：複診填寫用藥與近期狀況後，由 Gemini AI 從 [《314風神學院》](https://goodadhd.blogspot.com/) 精選文章與 200～300 字導讀；初診則依後台開關顯示「專人詢問報到」或「兒童青少年版／成人版線上初診表單」引導。
- **醫師／護理共用診間看板 (`doctor.html`)**：
  - 由試算表 `Config` 分頁密碼驗證進入（於 GAS 後端嚴格卡關），支援 **🩺 醫師看診 ⇄ 👩‍⚕️ 護理跟診** 視角切換。
  - 支援 **門診填寫開關**、**初診模式切換（專人詢問 ⇄ 掃碼自填）**、**現場／電話快速登錄**。
  - **全流程狀態接力與時間統計**：`初診待問` → `初診已問完`／`待看診` → `測驗／問卷中`（暫停累計）→ `測驗完成待看` → `看診中`（置頂即時 `mm:ss` 計時＋一鍵接龍結案上一位）→ `已看診`，自動寫入等待、純看診（扣除測驗暫離）、測驗、總停留分鐘數。
  - 醫師視角提供單段病歷摘要一鍵複製、`Supportive / Re-educative` 心理治療紀錄切換、診間屬性標籤與備註（Free Typing）。
- **每日自動同步 (`.github/workflows/sync-blog.yml`)**：透過 GitHub Actions 每天自動抓取部落格最新文章更新 `data/posts.json`。

---

## 檔案結構

- `index.html`：家長報到與看診前調查表＋衛教文章推薦
- `doctor.html`：醫師／護理共用診間即時看板
- `assets/config.js`：前端連線設定（填入 GAS 網址與輪詢間隔）
- `assets/i18n.js`：繁體中文／越南語雙語字典
- `assets/search.js`：中文關鍵字＋IDF 權重＋門診同義詞搜尋引擎
- `assets/app.js` / `assets/doctor.js`：前台與看板邏輯
- `data/posts.json`：已同步的部落格文章索引
- `gas/Code.gs`：Google Apps Script 後端程式（含 28 欄試算表與 `Config` 管理）
- `scripts/sync_blog.py`：Blogger 文章同步腳本

---

## Google 試算表 `Config` 分頁設定說明

首次執行後 GAS 會於同一份試算表自動建立 `Config` 分頁，可直接修改欄位即時生效（不需重改程式碼）：

| 參數名稱 | 說明 |
| :--- | :--- |
| `DOCTOR_PIN` | 醫師／護理看板密碼（留空代表不設密碼） |
| `FIRST_VISIT_CHILD_URL` | 初診線上表單網址（兒童青少年版） |
| `FIRST_VISIT_ADULT_URL` | 初診線上表單網址（大人版） |
| `DOCTOR_TAGS` | 診間屬性標籤清單（以半形逗號分隔，如 `初診,調藥,...`） |
| `MSG_HEADER_DESC` | 問卷上方說明文字（留空用系統預設） |
| `MSG_CLOSED_BANNER` | 非門診時段提示文字（留空用系統預設） |
| `MSG_FIRST_VISIT_SELF` | 初診「掃碼自填」模式提示語（留空用系統預設） |
| `MSG_FIRST_VISIT_STAFF` | 初診「專人詢問」模式提示語（留空用系統預設） |
| `MSG_FIRST_VISIT_DONE` | 初診報到完成提示語（留空用系統預設） |
| `MSG_FOLLOWUP_SENT` | 複診送出成功頂端提示語（留空用系統預設） |

---

## 快速部署步驟

### 步驟 1：Google 試算表與 GAS 後端
1. 新增 **Google 試算表**（例如 `兒青門診登記表`）→ **擴充功能** → **Apps Script**，貼上 `gas/Code.gs` 儲存（或使用 `clasp` 推送）。
2. **專案設定 → 指令碼屬性 → 新增 `GEMINI_API_KEY`**：貼上 Gemini API Key 以啟用 AI 導讀與心理治療紀錄草稿。
3. **部署 → 網頁應用程式**（執行身分：**我**、誰可以存取：**所有人**），複製網址填入 `assets/config.js` 的 `GAS_URL`。

### 步驟 2：GitHub Pages
1. 推送專案至 GitHub Repository，並於 **Settings → Pages** 選擇 `main` 分支部署。
2. 正式網址：
   - 家長端 QR code：`https://<帳號>.github.io/<專案>/`
   - 診間看板：`https://<帳號>.github.io/<專案>/doctor.html`
