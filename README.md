# 兒青門診 看診前調查表 ＆《314風神學院》衛教推薦系統

專為兒童青少年精神科門診設計的候診輔助工具：
- **家長／個案端 (`index.html`)**：掃描 QR code 填寫看診前調查表，系統即時搜尋您的部落格 [《314風神學院》](https://goodadhd.blogspot.com/) 推薦相關衛教文章，並產出看診重點小卡。
- **醫師端看板 (`doctor.html`)**：在診間即時查看當日候診登記（自動每 15 秒更新），標記「已看診」，並以醒目紅框標示自傷風險提醒。
- **每日自動同步 (`.github/workflows/sync-blog.yml`)**：透過 GitHub Actions 每天自動抓取部落格最新文章更新 `data/posts.json`。

---

## 檔案結構

- `index.html`：家長填寫的看診前調查表＋衛教文章推薦
- `doctor.html`：醫師端診間即時看板
- `assets/config.js`：系統設定（填入 GAS 網址與看板密碼）
- `assets/search.js`：中文關鍵字＋同義詞搜尋引擎
- `data/posts.json`：已同步的 297 篇部落格文章索引
- `gas/Code.gs`：Google Apps Script 後端程式
- `scripts/sync_blog.py`：Blogger 文章同步腳本

---

## 快速部署步驟（約 5 分鐘）

### 步驟 1：建立 Google 試算表與 GAS 後端
1. 在您的 Google 雲端硬碟新增一個 **Google 試算表**（例如命名為 `兒青門診登記表`）。
2. 點選上方選單：**擴充功能** → **Apps Script**。
3. 將本專案 `gas/Code.gs` 的全部內容複製貼上，按儲存。
4. **（選用，強烈建議）開啟 AI 衛教導讀與適配度判斷**：
   - 在 Apps Script 左側選單點選 **專案設定（齒輪圖示）** → 拉到最下方 **指令碼屬性** → **新增指令碼屬性**：
     - 屬性名稱：`GEMINI_API_KEY`
     - 值：貼上您的 Google Gemini API Key
   - 設定後，系統會先請 Gemini 讀過候選文章，判斷適不適合回答家長問題；適合才寫 200～300 字導讀並附連結，不適合就不硬塞文章。
5. 點選右上角 **部署** → **新增部署作業**：
   - 選取類型：**網頁應用程式**
   - 執行身分：**我**
   - 誰可以存取：**所有人**
5. 授權後，複製產生的 **網頁應用程式網址**（`https://script.google.com/macros/s/.../exec`）。

### 步驟 2：填入設定檔並推上 GitHub Pages
1. 打開 `assets/config.js`，將剛複製的網址貼到 `GAS_URL: "..."` 中（也可順便設定 `DOCTOR_PIN` 作為看板密碼）。
2. 將整個資料夾推上您的 GitHub Repository。
3. 到 GitHub Repository 的 **Settings → Pages**：
   - Source 選擇 **Deploy from a branch**
   - Branch 選擇 `main`（`/ (root)`），按 Save。
4. 幾分鐘後即可取得網址：
   - 候診 QR code 網址：`https://<您的帳號>.github.io/<專案名稱>/`
   - 診間醫師看板網址：`https://<您的帳號>.github.io/<專案名稱>/doctor.html`

> **小提醒**：若醫院院內電腦封鎖外部網站，建議將表單的「小朋友姓名」欄改為提示填寫「看診序號」，並用您自己的平板或手機開啟 `doctor.html`。
