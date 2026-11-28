# 工作紀錄 (WORKLOG)

## 2026-11-25｜兒青門診 看診前調查表 ＆《314風神學院》衛教推薦系統上線

### 完成項目
1. **問卷與衛教推薦前端**（`index.html`、`assets/app.js`、`assets/search.js`、`assets/style.css`）
   - 數位化「兒青門診 看診前調查表」（基本資訊、Q1 看診狀況、Q2 假日服藥與剩餘藥量、近期狀況複選、評估／診斷證明需求）。
   - 內建自傷風險即時提醒（勾選「傷害自己」時顯示 1925 安心專線與立即通知診間人員提醒）。
   - 整合《314風神學院》（`https://goodadhd.blogspot.com/`）**292 篇完整文章**索引（`data/posts.json`，已補抓 `Read more` 截斷內文並過濾過短／非衛教文章）。
   - 加入停用詞與 IDF 稀有度加權搜尋，並支援「補充說明或延伸提問」對話框（含可點擊文章連結）。
2. **醫師端診間即時看板**（`doctor.html`、`assets/doctor.js`）
   - 密碼保護（`DOCTOR_PIN` 存於試算表 `Config` 分頁並由 GAS 後端驗證），每 15 秒自動更新今日登記名單、支援「標記已看診」、篩選與手動「鎖定看板」。
   - 內建「門診填寫開關」（一鍵切換開放／關閉填寫），非門診時段自動隱藏問卷並保留免費關鍵字搜尋。
   - 看板上方直接顯示「個案填寫網址」與「複製網址」按鈕；點「標記已看診」即時從待看診名單收起卡片；每張卡片支援「切換為 Supportive / Re-educative」即時改寫治療紀錄。
   - 前台送出與追問加入「即時跳動秒數計時」（置於頂端 `正在傳送資料給診間…` 狀態列），運算完成後自動捲動至衛教重點導讀與文章推薦區。
   - 近期用藥狀況選項細分為「忘記吃藥／抗拒服藥／沒按時吃」與「服藥後不適或副作用（如沒胃口、睡不著、不舒服）」，並分流對應搜尋關鍵字。
3. **Google Apps Script 後端與 Gemini AI 導讀**（`gas/Code.gs`、`gas/appsscript.json`）
   - 已透過 `clasp` 綁定並部署至版本 `@17`（首次執行自動建立 `兒青門診登記表` Google 試算表與 `Config` 分頁）。
   - `DOCTOR_PIN` 移至試算表 `Config` 分頁並於 GAS 後端嚴格驗證（`getRecords`、`markDone`、`rewriteTherapyNote`、`setClinicOpen` 全改由 `POST` body 驗證），加入 `LockService` 防止試算表併發競爭，並修正 15 秒輪詢與治療紀錄切換的競態覆寫問題。
   - 加入 `繁體中文 ⇄ Tiếng Việt（越南語）` 雙語切換（`assets/i18n.js`），支援越南語家長填寫與閱讀 AI 越語導讀，同時自動將選項與越語補充翻譯為繁體中文寫入試算表與 `doctor.html`。
   - 整合 `gemini-4-hydrogen`（Gemini 4 最經濟版本）進行適配度判斷（不適合不硬塞）、200～300 字原文導讀、追問補充，並依健保規範產出不含「衛教」字眼、不腦補會談反應的 `Supportive / Re-educative Psychotherapy` 半成品草稿（寫入精簡 15 欄試算表，並於 `doctor.html` 提供一鍵複製）。
4. **GitHub Pages ＆ 自動同步部署**（`8807p3/opdcase`）
   - 已完成 `gh` CLI 認證與 GitHub Pages（`main` 分支）部署。
   - 已設定 `.github/workflows/sync-blog.yml` 每日凌晨自動同步部落格新文章，並啟用 GitHub Actions `write` 權限。

---

### 正式網址與維運資訊
- **家長／個案填寫網址（QR code）**：https://8807p3.github.io/opdcase/
- **醫師端診間看板網址**：https://8807p3.github.io/opdcase/doctor.html
- **GAS Web App 部署**：`AKfycbw6lYZ5FE2wI3M8dv4DIaop8LFl1ywR_f6vWzobddW9egXrM-dblZU4Qk8FKMbcxHxb`（`@20`）
- **日常更新指令**：
  - 前端修改：`git add . && git commit -m "update" && git push`
  - GAS 修改（Windows PowerShell 請用 `clasp.cmd`）：`cd gas; & "$env:APPDATA\npm\clasp.cmd" push -f; & "$env:APPDATA\npm\clasp.cmd" deploy -i AKfycbw6lYZ5FE2wI3M8dv4DIaop8LFl1ywR_f6vWzobddW9egXrM-dblZU4Qk8FKMbcxHxb`

---

## 2026-11-27｜填寫流程、診間病歷摘要與 AI 速度優化

### 完成項目
1. **家長／個案端流程與輸入優化**（`index.html`、`assets/app.js`、`assets/i18n.js`、`assets/search.js`）
   - 「看診號」與「小朋友姓名（或暱稱）」拆為並排兩欄，至少需填寫其中一項，送出時自動合併為 `看診號 姓名` 寫入試算表（純數字診號自動補 `號`）。
   - 新增 `localStorage` 記憶「小朋友姓名」並附「清除記憶」按鈕，方便家長免重複輸入（不記憶看診號）。
   - 將「送出調查表」按鈕移至《314風神學院》即時衛教推薦之前，避免家長分心忘記送出。
2. **醫師端診間病歷一鍵複製**（`doctor.html`、`assets/doctor.js`）
   - 將「陪同家長、假日服藥、剩餘 X 天藥物（未填則略過）、近期狀況、補充問題、證明需求」濃縮為單段病歷格式，右側新增「複製」按鈕直接貼入 HIS 病歷。
3. **AI 推薦命中率與回應速度優化**（`gas/Code.gs`、`assets/app.js`、`assets/search.js`）
   - AI 候選文章池由 3 篇 × 650 字擴增為 **5 篇 × 1200 字**，並於 `SYNONYMS` 補齊妥瑞／抽動、焦慮／強迫、拒學、情緒崩潰、3C／電玩等門診常用同義詞。
   - `gemini-4-hydrogen` 設定 `thinkingConfig.thinkingLevel = "low"`、備援 `gemini-2.5-flash` 設定 `thinkingBudget = 0`，送出回應時間由 ~30 秒降至 ~12 秒（GAS 部署更新至 `@19`）。

---

## 2026-11-28｜初診雙版本分流、醫師／護理共用看板與看診效率計時系統

### 完成項目
1. **試算表 28 欄新版架構與 `Config` 擴充**（`gas/Code.gs`）
   - 自動備份舊版 15 欄工作表（`門診登記_舊版_MMdd_HHmm`），建立 28 欄新版結構：拆出獨立 `就診類型`、`叫號順序`（預留日後排號用）、`看診號`、`姓名`，新增 `初診問完時間`、`開始看診時間`、`結束看診時間`、`等待時間(分)`、`看診時間(分)`（扣除測驗暫離）、`測驗暫離(分)`、`總停留時間(分)`、`診間屬性`、`診間備註`、`計時狀態(系統)`。
   - `Config` 分頁自動補齊 `FIRST_VISIT_CHILD_URL`、`FIRST_VISIT_ADULT_URL`、`DOCTOR_TAGS` 與 `MSG_*` 前台客製提示語（保留既有 `DOCTOR_PIN` 且僅白名單公開至 `?action=status`）。
2. **家長端初診分流與雙版本引導**（`index.html`、`assets/app.js`、`assets/i18n.js`）
   - 新增「複診／初診」分流：選「初診」自動隱藏複診用藥題，並依後台 `firstVisitMode` 顯示「專人詢問報到」或「兒童／青少年版 vs 成人／大人版」線上初診表單連結按鈕（防 iOS Safari / LINE 彈窗攔截），越語介面自動附上「初診表單目前僅有中文版」提示並於看板標記 `🇻🇳 越語`。
   - 支援繁體中文版即時套用試算表 `Config` 的 `MSG_*` 客製提示語。
3. **醫師／護理共用看板與接力計時**（`doctor.html`、`assets/doctor.js`、`assets/style.css`）
   - 頂端新增 **初診模式開關**（`📱 掃碼自填` ⇄ `👩‍⚕️ 專人詢問`）、**看板視角切換**（`🩺 醫師看診` ⇄ `👩‍⚕️ 護理跟診`，記憶於 `localStorage`）與 **＋快速登錄個案**。
   - 完整狀態流：`初診待問` → `初診已問完`／`待看診` → `測驗／問卷中`（暫停累計）→ `測驗完成待看` → `看診中`（置頂即時計時 `mm:ss`、點下一位自動結案上一位）→ `已看診`。
   - 新增頂端即時統計列（各狀態人數、平均等待／平均看診分鐘數）及醫師端可點選「診間屬性標籤」＋「診間備註 (Free Typing)」。
   - 部署 GAS 至版本 `@20` 並同步更新 `README.md`。

### 待辦／保留事項
- 年齡／學齡選項暫緩（先以現況實際跑診觀察）。
- 試算表已預留 `叫號順序` 欄位，後續若有需要可無痛加上「排下一位」或拖曳排序。
