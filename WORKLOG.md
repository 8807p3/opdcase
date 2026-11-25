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
- **GAS Web App 部署**：`AKfycbw6lYZ5FE2wI3M8dv4DIaop8LFl1ywR_f6vWzobddW9egXrM-dblZU4Qk8FKMbcxHxb`（`@17`）
- **日常更新指令**：
  - 前端修改：`git add . && git commit -m "update" && git push`
  - GAS 修改：`cd gas && clasp push -f && clasp deploy -i AKfycbw6lYZ5FE2wI3M8dv4DIaop8LFl1ywR_f6vWzobddW9egXrM-dblZU4Qk8FKMbcxHxb`
