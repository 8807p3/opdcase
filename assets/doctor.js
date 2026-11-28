// 醫師／護理共用診間即時看板邏輯

(function () {
  const pinGate = document.getElementById("pin-gate");
  const pinInput = document.getElementById("pin-input");
  const pinBtn = document.getElementById("pin-btn");
  const pinError = document.getElementById("pin-error");
  const dashboard = document.getElementById("dashboard");

  const modeNotice = document.getElementById("mode-notice");
  const clinicStatusBadge = document.getElementById("clinic-status-badge");
  const toggleClinicBtn = document.getElementById("toggle-clinic-btn");
  const fvModeBadge = document.getElementById("fv-mode-badge");
  const toggleFvModeBtn = document.getElementById("toggle-fv-mode-btn");
  const patientUrlLink = document.getElementById("patient-url-link");
  const copyUrlBtn = document.getElementById("copy-url-btn");
  const roleBtns = Array.from(document.querySelectorAll(".role-btn"));
  const toggleQuickAddBtn = document.getElementById("toggle-quick-add-btn");
  const quickAddCard = document.getElementById("quick-add-card");
  const qaVisitNo = document.getElementById("qa-visit-no");
  const qaName = document.getElementById("qa-name");
  const qaType = document.getElementById("qa-type");
  const qaStatus = document.getElementById("qa-status");
  const qaNote = document.getElementById("qa-note");
  const qaSubmitBtn = document.getElementById("qa-submit-btn");

  const statActive = document.getElementById("stat-active");
  const statWaiting = document.getElementById("stat-waiting");
  const statFirstPending = document.getElementById("stat-first-pending");
  const statPaused = document.getElementById("stat-paused");
  const statDone = document.getElementById("stat-done");
  const statAvgWait = document.getElementById("stat-avg-wait");
  const statAvgConsult = document.getElementById("stat-avg-consult");

  const recordsList = document.getElementById("records-list");
  const filterSelect = document.getElementById("filter-status");
  const refreshBtn = document.getElementById("refresh-btn");
  const lockBtn = document.getElementById("lock-btn");
  const lastUpdated = document.getElementById("last-updated");

  const DEFAULT_TAGS = [
    "初診",
    "調藥",
    "行為/情緒長談",
    "證明/鑑定",
    "危機處置",
    "家庭會談",
  ];

  const nowDemo = Date.now();
  const DEMO_RECORDS = [
    {
      id: "demo-1",
      timestamp: "09:15:10",
      visitType: "複診",
      queueOrder: 15,
      visitNo: "15號",
      childName: "王小明（示範）",
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
      status: "看診中",
      doctorTags: ["調藥"],
      doctorNote: "",
      waitMinutes: 12.4,
      consultMinutes: null,
      pauseMinutes: null,
      totalMinutes: null,
      timing: {
        submitMs: nowDemo - 900000,
        firstConsultMs: nowDemo - 180000,
        segStartMs: nowDemo - 180000,
        pauseStartMs: 0,
        consultMs: 0,
        pauseMs: 0,
      },
      lang: "zh",
    },
    {
      id: "demo-2",
      timestamp: "09:20:05",
      visitType: "初診(專人問)",
      queueOrder: 18,
      visitNo: "18號",
      childName: "林小華（示範）",
      parent: "",
      q1: "",
      q2: "",
      medDays: "",
      recentStatus: "",
      issues: [],
      selfHarm: false,
      otherDetail: "",
      certDetail: "",
      recommendedTitles: [],
      therapyNote: "",
      status: "初診待問",
      doctorTags: ["初診"],
      doctorNote: "",
      waitMinutes: null,
      consultMinutes: null,
      pauseMinutes: null,
      totalMinutes: null,
      timing: {
        submitMs: nowDemo - 420000,
        segStartMs: 0,
        pauseStartMs: 0,
        consultMs: 0,
        pauseMs: 0,
      },
      lang: "zh",
    },
  ];

  let currentRecords = [];
  let clinicOpen = true;
  let firstVisitMode = "self";
  let doctorTags = DEFAULT_TAGS.slice();
  let currentRole = "doctor";
  let sessionPin = "";
  let pinRequired = true;
  let pollTimer = null;
  let tickerTimer = null;
  let eventsBound = false;
  let mutationEpoch = 0;
  let focusedNoteId = "";
  const rewritingIds = new Set();

  const PIN_STORAGE_KEY = "clinic_doctor_pin";
  const ROLE_STORAGE_KEY = "clinic_dashboard_role";

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMmSs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

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

  function renderFirstVisitMode() {
    if (!fvModeBadge || !toggleFvModeBtn) return;
    if (firstVisitMode === "staff") {
      fvModeBadge.className = "badge badge-discuss";
      fvModeBadge.textContent = "👩‍⚕️ 專人詢問";
      toggleFvModeBtn.textContent = "切換為掃碼自填";
    } else {
      fvModeBadge.className = "badge badge-first-visit";
      fvModeBadge.textContent = "📱 掃碼自填";
      toggleFvModeBtn.textContent = "切換為專人詢問";
    }
  }

  function applyRole(role) {
    currentRole = role === "nurse" ? "nurse" : "doctor";
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, currentRole);
    } catch (e) {}
    roleBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.role === currentRole);
    });
    renderRecords();
  }

  function stopTimers() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }

  function lockDashboard(errMsg) {
    stopTimers();
    sessionPin = "";
    try {
      sessionStorage.removeItem(PIN_STORAGE_KEY);
    } catch (e) {}
    dashboard.classList.add("hidden");
    pinGate.classList.remove("hidden");
    pinInput.value = "";
    if (errMsg) {
      pinError.textContent = errMsg;
      pinError.classList.remove("hidden");
    } else {
      pinError.classList.add("hidden");
    }
    pinInput.focus();
  }

  function unlockDashboard() {
    pinError.classList.add("hidden");
    pinGate.classList.add("hidden");
    dashboard.classList.remove("hidden");
    if (lockBtn) {
      lockBtn.classList.toggle("hidden", !pinRequired);
    }
    startDashboard();
  }

  async function doctorPost(payload, timeoutMs = 25000) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timerId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...payload, pin: sessionPin }),
        signal: controller ? controller.signal : undefined,
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const json = await resp.json();
      if (json.unauthorized) {
        lockDashboard("密碼已變更或驗證失效，請重新輸入。");
        throw new Error("unauthorized");
      }
      return json;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  function applyServerState(json) {
    if (Array.isArray(json.records)) {
      currentRecords = json.records;
    }
    if (typeof json.clinicOpen === "boolean") {
      clinicOpen = json.clinicOpen;
      renderClinicStatus();
    }
    if (json.firstVisitMode === "staff" || json.firstVisitMode === "self") {
      firstVisitMode = json.firstVisitMode;
      renderFirstVisitMode();
    }
    if (Array.isArray(json.doctorTags) && json.doctorTags.length > 0) {
      doctorTags = json.doctorTags;
    }
    renderStats();
    renderRecords();
    lastUpdated.textContent =
      "最後更新：" + new Date().toLocaleTimeString("zh-TW", { hour12: false });
  }

  async function verifyAndEnter(pinValue, isSilentAuto) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    pinBtn.disabled = true;
    pinBtn.textContent = "驗證中…";
    pinError.classList.add("hidden");
    try {
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "verifyPin", pin: pinValue }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const json = await resp.json();
      if (json.ok) {
        sessionPin = pinValue;
        pinRequired = json.pinRequired !== false;
        try {
          if (pinRequired && pinValue) {
            sessionStorage.setItem(PIN_STORAGE_KEY, pinValue);
          } else {
            sessionStorage.removeItem(PIN_STORAGE_KEY);
          }
        } catch (e) {}
        unlockDashboard();
      } else {
        if (isSilentAuto) {
          try {
            sessionStorage.removeItem(PIN_STORAGE_KEY);
          } catch (e) {}
        } else {
          pinError.textContent = json.error || "密碼不正確，請再試一次。";
          pinError.classList.remove("hidden");
          pinInput.select();
        }
      }
    } catch (err) {
      if (!isSilentAuto) {
        pinError.textContent = "連線驗證失敗，請檢查網路或 GAS 部署。";
        pinError.classList.remove("hidden");
      }
    } finally {
      pinBtn.disabled = false;
      pinBtn.textContent = "進入看板";
    }
  }

  async function initAuth() {
    try {
      const savedRole = localStorage.getItem(ROLE_STORAGE_KEY);
      if (savedRole === "nurse" || savedRole === "doctor") {
        currentRole = savedRole;
      }
    } catch (e) {}
    roleBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.role === currentRole);
    });

    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      pinRequired = false;
      unlockDashboard();
      return;
    }

    pinBtn.addEventListener("click", () => {
      verifyAndEnter(pinInput.value.trim(), false);
    });
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        verifyAndEnter(pinInput.value.trim(), false);
      }
    });

    let savedPin = "";
    try {
      savedPin = sessionStorage.getItem(PIN_STORAGE_KEY) || "";
    } catch (e) {}

    if (savedPin) {
      await verifyAndEnter(savedPin, true);
      return;
    }

    pinBtn.disabled = true;
    pinBtn.textContent = "檢查設定中…";
    try {
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "checkPinStatus" }),
      });
      const json = await resp.json();
      if (json.ok && json.pinRequired === false) {
        pinRequired = false;
        unlockDashboard();
        return;
      }
    } catch (err) {
      // Keep PIN gate visible
    } finally {
      pinBtn.disabled = false;
      pinBtn.textContent = "進入看板";
    }
    pinInput.focus();
  }

  async function fetchRecords(isPoll = false) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      modeNotice.classList.remove("hidden");
      modeNotice.innerHTML =
        "<strong>目前為預覽示範模式：</strong>尚未設定 <code>GAS_URL</code>，以下顯示為示範資料。";
      currentRecords = DEMO_RECORDS;
      renderStats();
      renderRecords();
      lastUpdated.textContent = "示範模式";
      return;
    }

    modeNotice.classList.add("hidden");
    const isAutoPoll = isPoll === true;
    if (isAutoPoll && (rewritingIds.size > 0 || focusedNoteId)) return;

    const startEpoch = mutationEpoch;
    try {
      const json = await doctorPost({ action: "getRecords" });
      if (startEpoch !== mutationEpoch) return;
      if (json.ok) {
        applyServerState(json);
      }
    } catch (err) {
      if (err.message === "unauthorized") return;
      modeNotice.classList.remove("hidden");
      modeNotice.textContent = "讀取資料失敗，請檢查網路或 GAS 部署權限。";
    }
  }

  function renderStats() {
    let active = 0;
    let waiting = 0;
    let firstPending = 0;
    let paused = 0;
    let done = 0;
    const waits = [];
    const consults = [];

    currentRecords.forEach((r) => {
      if (r.status === "看診中") active++;
      else if (r.status === "初診待問") firstPending++;
      else if (r.status === "測驗／問卷中") paused++;
      else if (r.status === "已看診") done++;
      else waiting++;

      if (typeof r.waitMinutes === "number" && !isNaN(r.waitMinutes)) {
        waits.push(r.waitMinutes);
      }
      if (typeof r.consultMinutes === "number" && !isNaN(r.consultMinutes)) {
        consults.push(r.consultMinutes);
      }
    });

    if (statActive) statActive.textContent = String(active);
    if (statWaiting) statWaiting.textContent = String(waiting);
    if (statFirstPending) statFirstPending.textContent = String(firstPending);
    if (statPaused) statPaused.textContent = String(paused);
    if (statDone) statDone.textContent = String(done);

    if (statAvgWait) {
      statAvgWait.textContent = waits.length
        ? (waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(1)
        : "-";
    }
    if (statAvgConsult) {
      statAvgConsult.textContent = consults.length
        ? (consults.reduce((a, b) => a + b, 0) / consults.length).toFixed(1)
        : "-";
    }
  }

  function updateLiveTimers() {
    const now = Date.now();
    document.querySelectorAll(".live-timer-pill[data-start]").forEach((el) => {
      const base = Number(el.dataset.base || 0);
      const start = Number(el.dataset.start || 0);
      const kind = el.dataset.kind;
      const elapsed = base + (start ? Math.max(0, now - start) : 0);
      el.textContent =
        kind === "pause"
          ? `📝 測驗計時 ${formatMmSs(elapsed)}`
          : `⏱ 看診中 ${formatMmSs(elapsed)}`;
    });
  }

  function formatHolidayMed(q2) {
    if (q2 === "有") return "假日有服藥";
    if (q2 === "沒有") return "假日沒服藥";
    if (q2 === "看狀況") return "假日看狀況服藥";
    if (q2 === "尚未服藥") return "尚未服藥";
    return q2 ? `假日服藥：${q2}` : "";
  }

  function formatChartSummary(r) {
    const parts = [];
    if (r.parent) parts.push(`${r.parent}陪同`);
    const medText = formatHolidayMed(r.q2);
    if (medText) parts.push(medText);

    const medDays = String(r.medDays ?? "").trim();
    if (medDays) {
      parts.push(`剩餘 ${medDays} 天藥物`);
    }

    const baseStatus =
      r.recentStatus === "表現不錯！狀況穩定"
        ? "近期狀況穩定"
        : r.recentStatus === "狀況仍不穩定"
        ? "近期狀況仍不穩定"
        : r.recentStatus || "";
    if (r.issues && r.issues.length > 0) {
      const issueStr = r.issues.join("、");
      parts.push(baseStatus ? `${baseStatus}（${issueStr}）` : issueStr);
    } else if (baseStatus) {
      parts.push(baseStatus);
    }

    if (r.otherDetail) {
      parts.push(r.otherDetail.replace(/\s*\n+\s*/g, "；").trim());
    }
    if (r.certDetail) {
      parts.push(`評估／診斷證明：${r.certDetail}`);
    }
    return parts.join(", ");
  }

  async function copyWithFeedback(btn, text, defaultLabel, fallbackPrompt) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "已複製！";
      setTimeout(() => (btn.textContent = defaultLabel), 1500);
    } catch (err) {
      prompt(fallbackPrompt, text);
    }
  }

  function getStatusRank(status) {
    switch (status) {
      case "看診中":
        return 0;
      case "測驗完成待看":
        return 1;
      case "初診已問完":
        return 2;
      case "待看診":
        return 3;
      case "初診待問":
        return 4;
      case "測驗／問卷中":
        return 5;
      case "已看診":
        return 6;
      default:
        return 3;
    }
  }

  function sortRecords(list) {
    return list.slice().sort((a, b) => {
      const ra = getStatusRank(a.status);
      const rb = getStatusRank(b.status);
      if (ra !== rb) return ra - rb;
      if (a.status === "已看診" && b.status === "已看診") {
        return (b.timing?.finishedMs || 0) - (a.timing?.finishedMs || 0);
      }
      const qa = Number(a.queueOrder) || 999999;
      const qb = Number(b.queueOrder) || 999999;
      if (qa !== qb) return qa - qb;
      return (a.timing?.submitMs || 0) - (b.timing?.submitMs || 0);
    });
  }

  function buildActionButtonsHtml(r) {
    const idAttr = escapeHtml(r.id);
    const hasConsult = (r.timing?.consultMs || 0) > 0;
    const isNurse = currentRole === "nurse";
    const mkBtn = (nextStatus, label, primary = false) =>
      `<button type="button" class="btn btn-sm ${
        primary ? "btn-primary" : "btn-secondary"
      } status-btn" style="width:auto;padding:5px 10px;font-size:0.8rem;" data-id="${idAttr}" data-next="${escapeHtml(
        nextStatus
      )}">${escapeHtml(label)}</button>`;

    if (r.status === "看診中") {
      return (
        mkBtn("已看診", "✓ 結束看診", true) +
        mkBtn("測驗／問卷中", "⏸ 測驗／問卷", false)
      );
    }
    if (r.status === "初診待問") {
      return isNurse
        ? mkBtn("初診已問完", "✅ 初診問完", true) +
            mkBtn("測驗／問卷中", "📝 去測驗", false) +
            mkBtn("看診中", "▶ 開始看診", false)
        : mkBtn("看診中", "▶ 開始看診", true) +
            mkBtn("初診已問完", "✅ 初診問完", false) +
            mkBtn("測驗／問卷中", "📝 去測驗", false);
    }
    if (r.status === "測驗／問卷中") {
      return isNurse
        ? mkBtn("測驗完成待看", "✅ 測驗完成", true) +
            mkBtn("看診中", hasConsult ? "▶ 繼續看診" : "▶ 開始看診", false) +
            mkBtn("已看診", "✓ 結束看診", false)
        : mkBtn("看診中", hasConsult ? "▶ 繼續看診" : "▶ 開始看診", true) +
            mkBtn("測驗完成待看", "✅ 測驗完成", false) +
            mkBtn("已看診", "✓ 結束看診", false);
    }
    if (r.status === "測驗完成待看") {
      return (
        mkBtn("看診中", hasConsult ? "▶ 繼續看診" : "▶ 開始看診", true) +
        mkBtn("已看診", "✓ 結束看診", false)
      );
    }
    if (r.status === "已看診") {
      return mkBtn("待看診", "恢復待看診", false);
    }
    // 待看診 or 初診已問完
    return isNurse
      ? mkBtn("測驗／問卷中", "📝 去測驗", false) +
          mkBtn("看診中", "▶ 開始看診", true) +
          mkBtn("已看診", "✓ 直接已看診", false)
      : mkBtn("看診中", "▶ 開始看診", true) +
          mkBtn("測驗／問卷中", "📝 去測驗", false) +
          mkBtn("已看診", "✓ 直接已看診", false);
  }

  function getStatusMeta(r) {
    if (r.status === "看診中") {
      return {
        cardClass: "is-active-consult",
        badgeClass: "badge-active-consult",
        badgeText: "🟢 看診中",
      };
    }
    if (r.status === "測驗／問卷中") {
      return {
        cardClass: "is-paused-test",
        badgeClass: "badge-paused-test",
        badgeText: "📝 去測驗／問卷",
      };
    }
    if (r.status === "測驗完成待看") {
      return {
        cardClass: "is-test-ready",
        badgeClass: "badge-test-ready",
        badgeText: "✅ 測驗完成・等回診",
      };
    }
    if (r.status === "初診待問") {
      return {
        cardClass: "is-first-pending",
        badgeClass: "badge-first-visit",
        badgeText: "🆕 初診待問",
      };
    }
    if (r.status === "初診已問完") {
      return {
        cardClass: "",
        badgeClass: "badge-stable",
        badgeText: "✅ 初診已問完",
      };
    }
    if (r.status === "已看診") {
      return {
        cardClass: "is-done",
        badgeClass: "badge-stable",
        badgeText: "✓ 已看診",
      };
    }
    return {
      cardClass: "",
      badgeClass:
        r.q1 === "要與醫師討論" || r.recentStatus === "狀況仍不穩定"
          ? "badge-discuss"
          : "badge-stable",
      badgeText: r.q1 || r.recentStatus || "待看診",
    };
  }

  async function transitionStatus(id, targetStatus) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      const nowMs = Date.now();
      currentRecords = currentRecords.map((r) => {
        if (targetStatus === "看診中" && r.status === "看診中" && r.id !== id) {
          const seg = r.timing?.segStartMs ? nowMs - r.timing.segStartMs : 0;
          const totalConsult = (r.timing?.consultMs || 0) + seg;
          return {
            ...r,
            status: "已看診",
            consultMinutes: Math.round((totalConsult / 60000) * 10) / 10,
            timing: {
              ...(r.timing || {}),
              segStartMs: 0,
              consultMs: totalConsult,
              finishedMs: nowMs,
            },
          };
        }
        if (r.id !== id) return r;
        const t = { ...(r.timing || {}) };
        if (targetStatus === "看診中") {
          t.segStartMs = nowMs;
          if (!t.firstConsultMs) t.firstConsultMs = nowMs;
        } else if (targetStatus === "測驗／問卷中") {
          if (t.segStartMs) {
            t.consultMs = (t.consultMs || 0) + (nowMs - t.segStartMs);
            t.segStartMs = 0;
          }
          t.pauseStartMs = nowMs;
        } else if (targetStatus === "測驗完成待看") {
          if (t.pauseStartMs) {
            t.pauseMs = (t.pauseMs || 0) + (nowMs - t.pauseStartMs);
            t.pauseStartMs = 0;
          }
        } else if (targetStatus === "已看診") {
          if (t.segStartMs) {
            t.consultMs = (t.consultMs || 0) + (nowMs - t.segStartMs);
            t.segStartMs = 0;
          }
          t.finishedMs = nowMs;
        }
        return { ...r, status: targetStatus, timing: t };
      });
      renderStats();
      renderRecords();
      return;
    }

    mutationEpoch++;
    try {
      const json = await doctorPost({
        action: "transitionStatus",
        id,
        targetStatus,
        autoFinishOther: true,
      });
      if (!json.ok) throw new Error(json.error || "狀態更新失敗");
      mutationEpoch++;
      applyServerState(json);
    } catch (err) {
      if (err.message !== "unauthorized") {
        alert("更新狀態失敗：" + err.message);
      }
    }
  }

  async function saveDoctorMeta(id, nextTags, nextNote) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    mutationEpoch++;
    currentRecords = currentRecords.map((r) =>
      r.id === id
        ? {
            ...r,
            doctorTags: Array.isArray(nextTags) ? nextTags : r.doctorTags,
            doctorNote: nextNote !== undefined ? nextNote : r.doctorNote,
          }
        : r
    );
    if (!gasUrl) {
      renderRecords();
      return;
    }
    try {
      const payload = { action: "updateDoctorMeta", id };
      if (Array.isArray(nextTags)) payload.doctorTags = nextTags;
      if (nextNote !== undefined) payload.doctorNote = nextNote;
      const json = await doctorPost(payload);
      if (!json.ok) throw new Error(json.error || "儲存失敗");
      mutationEpoch++;
    } catch (err) {
      if (err.message !== "unauthorized") {
        alert("儲存診間註記失敗，請稍後再試");
      }
    }
  }

  function renderRecords() {
    const filter = filterSelect.value;
    const filtered = currentRecords.filter((r) => {
      if (filter === "all") return true;
      if (filter === "active") return r.status !== "已看診";
      return r.status === filter;
    });
    const list = sortRecords(filtered);

    if (list.length === 0) {
      recordsList.innerHTML =
        '<div class="card" style="text-align:center;color:#64748b;">目前沒有符合條件的看診登記資料</div>';
      return;
    }

    const isDoctor = currentRole === "doctor";

    recordsList.innerHTML = list
      .map((r) => {
        const meta = getStatusMeta(r);
        const isFirst = String(r.visitType || "").startsWith("初診");
        const displayTitle =
          [r.visitNo, r.childName].filter(Boolean).join(" ") || "未填姓名";
        const isVi = r.lang === "vi";

        let liveTimerHtml = "";
        if (r.status === "看診中" && r.timing?.segStartMs) {
          liveTimerHtml = `<span class="live-timer-pill" data-kind="consult" data-base="${
            r.timing.consultMs || 0
          }" data-start="${r.timing.segStartMs}">⏱ 看診中 00:00</span>`;
        }

        const timeMetrics = [];
        if (typeof r.waitMinutes === "number") {
          timeMetrics.push(`等待 ${r.waitMinutes} 分`);
        }
        if (typeof r.consultMinutes === "number") {
          timeMetrics.push(`看診 ${r.consultMinutes} 分`);
        } else if ((r.timing?.consultMs || 0) > 0 && r.status !== "看診中") {
          timeMetrics.push(
            `已談 ${Math.round((r.timing.consultMs / 60000) * 10) / 10} 分`
          );
        }
        if (typeof r.pauseMinutes === "number") {
          timeMetrics.push(`測驗 ${r.pauseMinutes} 分`);
        }
        if (typeof r.totalMinutes === "number") {
          timeMetrics.push(`總計 ${r.totalMinutes} 分`);
        }

        const summaryText = isFirst ? "" : formatChartSummary(r);

        const bodyHtml = isFirst
          ? `<div style="color:#475569;font-size:0.9rem;">
              <span>報到類型：<strong>${escapeHtml(r.visitType || "初診")}</strong></span>
              ${
                r.intakeDoneTime
                  ? `<span style="margin-left:10px;">問完時間：${escapeHtml(
                      r.intakeDoneTime
                    )}</span>`
                  : ""
              }
            </div>`
          : `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div style="flex:1;color:${
                r.issues && r.issues.length > 0 ? "#9a3412" : "#1e293b"
              };">${escapeHtml(summaryText)}</div>
              ${
                isDoctor
                  ? `<button type="button" class="btn btn-secondary btn-sm copy-summary-btn" data-summary-id="${escapeHtml(
                      r.id
                    )}" style="width:auto;flex-shrink:0;padding:3px 10px;font-size:0.8rem;">複製</button>`
                  : ""
              }
            </div>`;

        const therapyBoxHtml =
          isDoctor && r.therapyNote
            ? (() => {
                const isCurrentlySupportive =
                  /Supportive\s+Psychotherapy/i.test(r.therapyNote) &&
                  !/Re-educative/i.test(r.therapyNote.split("\n")[0] || "");
                const nextType = isCurrentlySupportive
                  ? "Re-educative"
                  : "Supportive";
                const isRewriting = rewritingIds.has(r.id);
                return `<div style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #1f6f78;border-radius:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px;flex-wrap:wrap;">
                    <strong style="color:#16535a;font-size:0.88rem;">🧠 心理治療紀錄草稿</strong>
                    <div style="display:flex;gap:6px;">
                      <button type="button" class="btn btn-secondary btn-sm switch-note-btn" data-note-id="${escapeHtml(
                        r.id
                      )}" data-target-type="${nextType}" style="padding:3px 9px;font-size:0.78rem;" ${
                  isRewriting ? "disabled" : ""
                }>${isRewriting ? "轉換中…" : `切換為 ${nextType}`}</button>
                      <button type="button" class="btn btn-secondary btn-sm copy-note-btn" data-note-id="${escapeHtml(
                        r.id
                      )}" style="padding:3px 9px;font-size:0.78rem;">複製紀錄</button>
                    </div>
                  </div>
                  <div style="white-space:pre-line;font-size:0.88rem;color:#334155;line-height:1.55;">${escapeHtml(
                    r.therapyNote
                  )}</div>
                </div>`;
              })()
            : "";

        const activeTagSet = new Set(r.doctorTags || []);
        const doctorMetaHtml = `<div class="doctor-meta-box">
            <div class="tag-chips" ${isDoctor ? "" : 'style="margin-bottom:0;"'}>
              ${doctorTags
                .map(
                  (tag) =>
                    `<button type="button" class="tag-chip ${
                      activeTagSet.has(tag) ? "active" : ""
                    }" data-tag-id="${escapeHtml(r.id)}" data-tag="${escapeHtml(
                      tag
                    )}">${escapeHtml(tag)}</button>`
                )
                .join("")}
            </div>
            ${
              isDoctor
                ? `<div class="doctor-note-row">
                <input type="text" class="doctor-note-input" data-dnote-id="${escapeHtml(
                  r.id
                )}" value="${escapeHtml(
                    r.doctorNote || ""
                  )}" placeholder="診間備註（選填，按 Enter 或點儲存寫入試算表）" />
                <button type="button" class="btn btn-secondary btn-sm save-dnote-btn" data-save-dnote-id="${escapeHtml(
                  r.id
                )}" style="width:auto;padding:6px 12px;font-size:0.8rem;">儲存</button>
              </div>`
                : ""
            }
          </div>`;

        return `
        <article class="patient-card ${
          r.selfHarm ? "is-danger" : meta.cardClass
        }">
          <div class="patient-head">
            <div>
              <span class="patient-name">${escapeHtml(displayTitle)}</span>
              <span style="color:#64748b;font-size:0.86rem;margin-left:8px;">
                報到 ${escapeHtml((r.timestamp || "").slice(0, 5))}
              </span>
              ${
                isFirst
                  ? `<span class="badge badge-first-visit" style="margin-left:6px;">初診</span>`
                  : ""
              }
              ${
                isVi
                  ? `<span class="badge badge-lang-vi" style="margin-left:4px;">🇻🇳 越語</span>`
                  : ""
              }
              ${
                r.selfHarm
                  ? `<span class="badge badge-danger" style="margin-left:4px;">⚠️ 自傷風險</span>`
                  : ""
              }
            </div>
            <div class="action-btn-group">
              ${liveTimerHtml}
              <span class="badge ${meta.badgeClass}">${escapeHtml(
          meta.badgeText
        )}</span>
              ${buildActionButtonsHtml(r)}
            </div>
          </div>

          <div style="font-size:0.94rem;line-height:1.65;">
            ${bodyHtml}
            ${
              timeMetrics.length > 0
                ? `<div style="margin-top:6px;font-size:0.82rem;color:#0f766e;font-weight:600;">⏱ ${escapeHtml(
                    timeMetrics.join(" ｜ ")
                  )}</div>`
                : ""
            }
            ${
              isDoctor &&
              r.recommendedTitles &&
              r.recommendedTitles.length > 0
                ? `<div style="color:#64748b;font-size:0.84rem;margin-top:4px;">已推薦文章：${r.recommendedTitles
                    .map(escapeHtml)
                    .join(" ／ ")}</div>`
                : ""
            }
            ${therapyBoxHtml}
            ${doctorMetaHtml}
          </div>
        </article>`;
      })
      .join("");

    updateLiveTimers();

    recordsList.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.disabled = true;
        transitionStatus(btn.dataset.id, btn.dataset.next);
      });
    });

    recordsList.querySelectorAll(".copy-summary-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rec = currentRecords.find(
          (item) => item.id === btn.dataset.summaryId
        );
        if (!rec) return;
        copyWithFeedback(
          btn,
          formatChartSummary(rec),
          "複製",
          "請手動複製看診摘要："
        );
      });
    });

    recordsList.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.dataset.tagId;
        const tag = chip.dataset.tag;
        const rec = currentRecords.find((item) => item.id === id);
        if (!rec) return;
        const set = new Set(rec.doctorTags || []);
        if (set.has(tag)) set.delete(tag);
        else set.add(tag);
        const nextTags = Array.from(set);
        chip.classList.toggle("active", set.has(tag));
        saveDoctorMeta(id, nextTags, undefined);
      });
    });

    recordsList.querySelectorAll(".doctor-note-input").forEach((inp) => {
      const id = inp.dataset.dnoteId;
      inp.addEventListener("focus", () => {
        focusedNoteId = id;
      });
      inp.addEventListener("blur", () => {
        if (focusedNoteId === id) focusedNoteId = "";
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const saveBtn = recordsList.querySelector(
            `.save-dnote-btn[data-save-dnote-id="${id}"]`
          );
          if (saveBtn) saveBtn.click();
        }
      });
    });

    recordsList.querySelectorAll(".save-dnote-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.saveDnoteId;
        const inp = recordsList.querySelector(
          `.doctor-note-input[data-dnote-id="${id}"]`
        );
        if (!inp) return;
        btn.disabled = true;
        btn.textContent = "儲存中…";
        await saveDoctorMeta(id, undefined, inp.value.trim());
        btn.disabled = false;
        btn.textContent = "已儲存！";
        setTimeout(() => (btn.textContent = "儲存"), 1200);
      });
    });

    recordsList.querySelectorAll(".switch-note-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.noteId;
        const targetType = btn.dataset.targetType;
        if (rewritingIds.has(id)) return;
        const rec = currentRecords.find((item) => item.id === id);
        if (!rec) return;

        const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
        if (!gasUrl) {
          const demoNote =
            targetType === "Supportive"
              ? "治療標題：Supportive Psychotherapy - 情緒支持與親子壓力調適\n相關內容記載：針對個案近期情緒挫折與互動壓力，予以情緒同理與支持，協助家長緩解教養焦慮並維繫治療聯盟。"
              : "治療標題：Re-educative Psychotherapy - 注意力轉移與執行功能因應策略\n相關內容記載：針對個案近期寫作業拖延與情緒煩躁情形，協助家長釐清注意力轉換困難之機轉，並引導建立分段任務與正向回饋等行為因應策略。";
          currentRecords = currentRecords.map((item) =>
            item.id === id ? { ...item, therapyNote: demoNote } : item
          );
          renderRecords();
          return;
        }

        rewritingIds.add(id);
        btn.disabled = true;
        btn.textContent = "轉換中…";
        try {
          const context = [
            ...(rec.issues || []),
            rec.otherDetail || "",
          ]
            .filter(Boolean)
            .join("；");
          const json = await doctorPost({
            action: "rewriteTherapyNote",
            id,
            targetType,
            currentNote: rec.therapyNote,
            context,
          });
          if (!json.ok || !json.therapyNote) {
            throw new Error(json.error || "轉換失敗");
          }
          mutationEpoch++;
          currentRecords = currentRecords.map((item) =>
            item.id === id ? { ...item, therapyNote: json.therapyNote } : item
          );
          rewritingIds.delete(id);
          renderRecords();
        } catch (err) {
          rewritingIds.delete(id);
          renderRecords();
          if (err.message !== "unauthorized") {
            alert("轉換治療紀錄失敗，請稍後再試");
          }
        }
      });
    });

    recordsList.querySelectorAll(".copy-note-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rec = currentRecords.find(
          (item) => item.id === btn.dataset.noteId
        );
        if (!rec || !rec.therapyNote) return;
        copyWithFeedback(
          btn,
          rec.therapyNote,
          "複製紀錄",
          "請手動複製心理治療紀錄："
        );
      });
    });
  }

  async function toggleClinicOpen() {
    if (toggleClinicBtn.disabled) return;
    const nextOpen = !clinicOpen;
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      clinicOpen = nextOpen;
      renderClinicStatus();
      return;
    }
    toggleClinicBtn.disabled = true;
    toggleClinicBtn.textContent = "切換中…";
    mutationEpoch++;
    try {
      const json = await doctorPost(
        { action: "setClinicOpen", open: nextOpen },
        12000
      );
      if (!json.ok) throw new Error(json.error || "切換失敗");
      mutationEpoch++;
      clinicOpen = Boolean(json.clinicOpen);
    } catch (err) {
      if (err.message !== "unauthorized") {
        alert("切換狀態失敗，請稍後再試");
      }
    } finally {
      toggleClinicBtn.disabled = false;
      renderClinicStatus();
    }
  }

  async function toggleFirstVisitMode() {
    if (toggleFvModeBtn.disabled) return;
    const nextMode = firstVisitMode === "staff" ? "self" : "staff";
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      firstVisitMode = nextMode;
      renderFirstVisitMode();
      return;
    }
    toggleFvModeBtn.disabled = true;
    toggleFvModeBtn.textContent = "切換中…";
    mutationEpoch++;
    try {
      const json = await doctorPost(
        { action: "setFirstVisitMode", mode: nextMode },
        12000
      );
      if (!json.ok) throw new Error(json.error || "切換失敗");
      mutationEpoch++;
      firstVisitMode = json.firstVisitMode === "staff" ? "staff" : "self";
    } catch (err) {
      if (err.message !== "unauthorized") {
        alert("切換初診模式失敗，請稍後再試");
      }
    } finally {
      toggleFvModeBtn.disabled = false;
      renderFirstVisitMode();
    }
  }

  async function handleQuickAdd() {
    const rawVNo = qaVisitNo ? qaVisitNo.value.trim() : "";
    const formattedVNo = rawVNo
      ? /^\d+$/.test(rawVNo)
        ? `${rawVNo}號`
        : rawVNo
      : "";
    const name = qaName ? qaName.value.trim() : "";
    if (!formattedVNo && !name) {
      alert("請至少填寫看診號或姓名");
      return;
    }
    const isFirst = qaType ? qaType.value === "first" : true;
    const initStatus = qaStatus ? qaStatus.value : "待看診";
    const note = qaNote ? qaNote.value.trim() : "";

    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      currentRecords.unshift({
        id: "demo-" + Date.now(),
        timestamp: new Date().toTimeString().slice(0, 8),
        visitType: isFirst ? "初診(快速登錄)" : "複診(快速登錄)",
        queueOrder: parseInt(rawVNo, 10) || 999999,
        visitNo: formattedVNo,
        childName: name,
        status: initStatus,
        doctorTags: isFirst ? ["初診"] : [],
        doctorNote: note,
        timing: { submitMs: Date.now(), consultMs: 0, pauseMs: 0 },
      });
      renderStats();
      renderRecords();
      if (qaVisitNo) qaVisitNo.value = "";
      if (qaName) qaName.value = "";
      if (qaNote) qaNote.value = "";
      if (quickAddCard) quickAddCard.classList.add("hidden");
      return;
    }

    qaSubmitBtn.disabled = true;
    qaSubmitBtn.textContent = "登錄中…";
    mutationEpoch++;
    try {
      const json = await doctorPost({
        action: "quickAddPatient",
        visitNo: formattedVNo,
        childName: name,
        isFirstVisit: isFirst,
        initialStatus: initStatus,
        doctorNote: note,
      });
      if (!json.ok) throw new Error(json.error || "登錄失敗");
      mutationEpoch++;
      applyServerState(json);
      if (qaVisitNo) qaVisitNo.value = "";
      if (qaName) qaName.value = "";
      if (qaNote) qaNote.value = "";
      if (quickAddCard) quickAddCard.classList.add("hidden");
    } catch (err) {
      if (err.message !== "unauthorized") {
        alert("快速登錄失敗：" + err.message);
      }
    } finally {
      qaSubmitBtn.disabled = false;
      qaSubmitBtn.textContent = "確認登錄";
    }
  }

  function startDashboard() {
    const patientUrl = new URL("./", window.location.href).href;
    if (patientUrlLink) {
      patientUrlLink.href = patientUrl;
      patientUrlLink.textContent = patientUrl;
    }
    if (!eventsBound) {
      eventsBound = true;
      if (copyUrlBtn) {
        copyUrlBtn.addEventListener("click", () => {
          copyWithFeedback(
            copyUrlBtn,
            patientUrl,
            "複製網址",
            "請手動複製個案填寫網址："
          );
        });
      }
      if (lockBtn) {
        lockBtn.addEventListener("click", () => lockDashboard(""));
      }
      roleBtns.forEach((btn) => {
        btn.addEventListener("click", () => applyRole(btn.dataset.role));
      });
      if (toggleQuickAddBtn && quickAddCard) {
        toggleQuickAddBtn.addEventListener("click", () => {
          quickAddCard.classList.toggle("hidden");
          if (!quickAddCard.classList.contains("hidden") && qaVisitNo) {
            qaVisitNo.focus();
          }
        });
      }
      if (qaType && qaStatus) {
        qaType.addEventListener("change", () => {
          qaStatus.value =
            qaType.value === "first" ? "初診已問完" : "待看診";
        });
      }
      if (qaSubmitBtn) {
        qaSubmitBtn.addEventListener("click", handleQuickAdd);
      }
    }
    renderClinicStatus();
    renderFirstVisitMode();
    fetchRecords(false);
    stopTimers();
    const interval = window.CLINIC_CONFIG?.POLL_INTERVAL_MS || 15000;
    pollTimer = setInterval(() => fetchRecords(true), interval);
    tickerTimer = setInterval(updateLiveTimers, 1000);
  }

  toggleClinicBtn.addEventListener("click", toggleClinicOpen);
  if (toggleFvModeBtn) {
    toggleFvModeBtn.addEventListener("click", toggleFirstVisitMode);
  }
  filterSelect.addEventListener("change", renderRecords);
  refreshBtn.addEventListener("click", () => fetchRecords(false));

  initAuth();
})();
