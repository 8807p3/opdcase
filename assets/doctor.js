// 醫師端診間即時看板邏輯

(function () {
  const pinGate = document.getElementById("pin-gate");
  const pinInput = document.getElementById("pin-input");
  const pinBtn = document.getElementById("pin-btn");
  const pinError = document.getElementById("pin-error");
  const dashboard = document.getElementById("dashboard");

  const modeNotice = document.getElementById("mode-notice");
  const clinicStatusBadge = document.getElementById("clinic-status-badge");
  const toggleClinicBtn = document.getElementById("toggle-clinic-btn");
  const patientUrlLink = document.getElementById("patient-url-link");
  const copyUrlBtn = document.getElementById("copy-url-btn");
  const recordsList = document.getElementById("records-list");
  const filterSelect = document.getElementById("filter-status");
  const refreshBtn = document.getElementById("refresh-btn");
  const lastUpdated = document.getElementById("last-updated");

  const DEMO_RECORDS = [
    {
      id: "demo-1",
      timestamp: "09:15",
      childName: "15號（示範資料）",
      parent: "媽媽",
      q1: "要與醫師討論",
      q2: "看狀況",
      medDays: "3",
      recentStatus: "狀況仍不穩定",
      issues: ["容易生氣、講不聽", "與家人爭執多／與手足爭執多"],
      selfHarm: false,
      otherDetail: "最近寫作業拖拉，吃藥後中午食慾比較差，想問是否需要調整劑量。",
      certDetail: "",
      recommendedTitles: ["「我沒空！」，當孩子困在過度專注的當下"],
      therapyNote:
        "治療標題：Re-educative Psychotherapy - 注意力轉移與執行功能因應策略\n相關內容記載：針對個案近期寫作業拖延與情緒煩躁情形，協助家長釐清注意力轉換困難之機轉，並引導建立分段任務與正向回饋等行為因應策略。",
      status: "待看診",
    },
    {
      id: "demo-2",
      timestamp: "09:08",
      childName: "12號（示範資料）",
      parent: "爸爸",
      q1: "狀況穩定，回診拿藥即可",
      q2: "沒有",
      medDays: "5",
      recentStatus: "表現不錯！狀況穩定",
      issues: [],
      selfHarm: false,
      otherDetail: "",
      certDetail: "",
      recommendedTitles: [],
      status: "已看診",
    },
  ];

  let currentRecords = [];
  let clinicOpen = true;

  function renderClinicStatus() {
    if (clinicOpen) {
      clinicStatusBadge.className = "badge badge-stable";
      clinicStatusBadge.textContent = "🟢 門診開放填寫中";
      toggleClinicBtn.textContent = "點擊關閉填寫（下診）";
    } else {
      clinicStatusBadge.className = "badge badge-danger";
      clinicStatusBadge.textContent = "🔴 目前已關閉填寫（非門診時間）";
      toggleClinicBtn.textContent = "點擊開放填寫（上診）";
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initAuth() {
    const requiredPin = (window.CLINIC_CONFIG?.DOCTOR_PIN || "").trim();
    if (!requiredPin) {
      pinGate.classList.add("hidden");
      dashboard.classList.remove("hidden");
      startDashboard();
      return;
    }

    pinBtn.addEventListener("click", () => {
      if (pinInput.value === requiredPin) {
        pinGate.classList.add("hidden");
        dashboard.classList.remove("hidden");
        startDashboard();
      } else {
        pinError.classList.remove("hidden");
      }
    });
  }

  async function fetchRecords() {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      modeNotice.classList.remove("hidden");
      modeNotice.innerHTML =
        "<strong>目前為預覽示範模式：</strong>尚未設定 <code>GAS_URL</code>，以下顯示為示範資料。請依照說明書設定 Google 試算表與 GAS 後，將網址填入 <code>assets/config.js</code> 即可接收真實門診資料。";
      currentRecords = DEMO_RECORDS;
      renderRecords();
      lastUpdated.textContent = "示範模式";
      return;
    }

    modeNotice.classList.add("hidden");
    try {
      const resp = await fetch(`${gasUrl}?t=${Date.now()}`);
      const json = await resp.json();
      if (json.ok) {
        currentRecords = json.records || [];
        if (typeof json.clinicOpen === "boolean") {
          clinicOpen = json.clinicOpen;
          renderClinicStatus();
        }
        renderRecords();
        lastUpdated.textContent =
          "最後更新：" +
          new Date().toLocaleTimeString("zh-TW", { hour12: false });
      }
    } catch (err) {
      modeNotice.classList.remove("hidden");
      modeNotice.textContent = "讀取資料失敗，請檢查網路或 GAS 部署權限。";
    }
  }

  async function toggleDone(id, nextStatus) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      currentRecords = currentRecords.map((r) =>
        r.id === id ? { ...r, status: nextStatus } : r
      );
      renderRecords();
      return;
    }

    try {
      await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "markDone", id, status: nextStatus }),
      });
      await fetchRecords();
    } catch (err) {
      alert("更新狀態失敗，請稍後再試");
    }
  }

  function renderRecords() {
    const filter = filterSelect.value;
    const list = currentRecords.filter((r) => {
      if (filter === "all") return true;
      return r.status === filter;
    });

    if (list.length === 0) {
      recordsList.innerHTML =
        '<div class="card" style="text-align:center;color:#64748b;">目前沒有符合條件的看診登記資料</div>';
      return;
    }

    recordsList.innerHTML = list
      .map((r) => {
        const isDone = r.status === "已看診";
        const badgeClass = r.selfHarm
          ? "badge-danger"
          : r.q1 === "要與醫師討論" || r.recentStatus === "狀況仍不穩定"
          ? "badge-discuss"
          : "badge-stable";
        const badgeText = r.selfHarm
          ? "⚠️ 自傷風險"
          : r.q1 || r.recentStatus;

        const nextStatus = isDone ? "待看診" : "已看診";

        return `
        <article class="patient-card ${r.selfHarm ? "is-danger" : ""} ${
          isDone ? "is-done" : ""
        }">
          <div class="patient-head">
            <div>
              <span class="patient-name">${escapeHtml(r.childName)}</span>
              <span style="color:#64748b;font-size:0.9rem;margin-left:8px;">
                ${escapeHtml(r.timestamp)} ｜ 家長：${escapeHtml(r.parent || "未填")}
              </span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
              <button class="btn btn-sm ${
                isDone ? "btn-secondary" : "btn-primary"
              }" style="width:auto;" data-id="${escapeHtml(
          r.id
        )}" data-next="${nextStatus}">
                ${isDone ? "恢復待看診" : "標記已看診"}
              </button>
            </div>
          </div>

          <div style="font-size:0.94rem;line-height:1.65;">
            <div><strong>假日服藥：</strong>${escapeHtml(
              r.q2 || "未填"
            )} ｜ <strong>剩餘藥量：</strong>${
          r.medDays ? escapeHtml(r.medDays) + " 天" : "未填"
        }</div>
            ${
              r.issues && r.issues.length > 0
                ? `<div style="color:#b45309;"><strong>近期狀況：</strong>${r.issues
                    .map(escapeHtml)
                    .join("、")}</div>`
                : `<div><strong>近期狀況：</strong>${escapeHtml(r.recentStatus)}</div>`
            }
            ${
              r.otherDetail
                ? `<div><strong>補充／問題：</strong>${escapeHtml(r.otherDetail)}</div>`
                : ""
            }
            ${
              r.certDetail
                ? `<div style="color:#1f6f78;"><strong>評估／診斷證明：</strong>${escapeHtml(
                    r.certDetail
                  )}</div>`
                : ""
            }
            ${
              r.recommendedTitles && r.recommendedTitles.length > 0
                ? `<div style="color:#64748b;font-size:0.86rem;margin-top:4px;">已推薦文章：${r.recommendedTitles
                    .map(escapeHtml)
                    .join(" ／ ")}</div>`
                : ""
            }
            ${
              r.therapyNote
                ? `<div style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #1f6f78;border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px;">
                      <strong style="color:#16535a;font-size:0.88rem;">🧠 心理治療紀錄草稿（Supportive / Re-educative）</strong>
                      <button type="button" class="btn btn-secondary btn-sm copy-note-btn" data-note-id="${escapeHtml(
                        r.id
                      )}" style="padding:3px 9px;font-size:0.78rem;">複製紀錄</button>
                    </div>
                    <div style="white-space:pre-line;font-size:0.88rem;color:#334155;line-height:1.55;">${escapeHtml(
                      r.therapyNote
                    )}</div>
                  </div>`
                : ""
            }
          </div>
        </article>
      `;
      })
      .join("");

    recordsList.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleDone(btn.dataset.id, btn.dataset.next);
      });
    });

    recordsList.querySelectorAll(".copy-note-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const rec = currentRecords.find((item) => item.id === btn.dataset.noteId);
        if (!rec || !rec.therapyNote) return;
        try {
          await navigator.clipboard.writeText(rec.therapyNote);
          btn.textContent = "已複製！";
          setTimeout(() => (btn.textContent = "複製紀錄"), 1500);
        } catch (err) {
          prompt("請手動複製心理治療紀錄：", rec.therapyNote);
        }
      });
    });
  }

  async function toggleClinicOpen() {
    const nextOpen = !clinicOpen;
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      clinicOpen = nextOpen;
      renderClinicStatus();
      return;
    }
    toggleClinicBtn.disabled = true;
    try {
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "setClinicOpen", open: nextOpen }),
      });
      const json = await resp.json();
      if (json.ok) {
        clinicOpen = Boolean(json.clinicOpen);
        renderClinicStatus();
      }
    } catch (err) {
      alert("切換狀態失敗，請稍後再試");
    } finally {
      toggleClinicBtn.disabled = false;
    }
  }

  function startDashboard() {
    const patientUrl = new URL("./", window.location.href).href;
    if (patientUrlLink) {
      patientUrlLink.href = patientUrl;
      patientUrlLink.textContent = patientUrl;
    }
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(patientUrl);
          copyUrlBtn.textContent = "已複製！";
          setTimeout(() => (copyUrlBtn.textContent = "複製網址"), 1500);
        } catch (err) {
          prompt("請手動複製個案填寫網址：", patientUrl);
        }
      });
    }
    renderClinicStatus();
    fetchRecords();
    const interval = window.CLINIC_CONFIG?.POLL_INTERVAL_MS || 15000;
    setInterval(fetchRecords, interval);
  }

  toggleClinicBtn.addEventListener("click", toggleClinicOpen);
  filterSelect.addEventListener("change", renderRecords);
  refreshBtn.addEventListener("click", fetchRecords);

  initAuth();
})();
