// 兒青門診 看診前調查表 前端邏輯

(function () {
  const form = document.getElementById("intake-form");
  const closedView = document.getElementById("closed-view");
  const closedSearchInput = document.getElementById("closed-search-input");
  const closedArticlesBox = document.getElementById("closed-articles");
  const formView = document.getElementById("form-view");
  const resultView = document.getElementById("result-view");

  const visitNoInput = document.getElementById("visit-no");
  const childNameInput = document.getElementById("child-name");
  const clearSavedNameBtn = document.getElementById("clear-saved-name-btn");
  const CHILD_NAME_STORAGE_KEY = "clinic_saved_child_name";
  const headerDescEl = document.getElementById("header-desc");
  const closedBannerEl = document.getElementById("closed-banner");
  const firstVisitPanel = document.getElementById("first-visit-panel");
  const firstVisitMsgEl = document.getElementById("first-visit-msg");
  const firstVisitViNoteEl = document.getElementById("first-visit-vi-note");
  const firstVisitStaffActions = document.getElementById("first-visit-staff-actions");
  const firstVisitSelfActions = document.getElementById("first-visit-self-actions");
  const fvStaffBtn = document.getElementById("fv-staff-btn");
  const fvChildBtn = document.getElementById("fv-child-btn");
  const fvAdultBtn = document.getElementById("fv-adult-btn");
  const followupFields = document.getElementById("followup-fields");
  const firstVisitLinkCard = document.getElementById("first-visit-link-card");
  const firstVisitResultViNote = document.getElementById("first-visit-result-vi-note");
  const firstVisitFormLink = document.getElementById("first-visit-form-link");
  const firstVisitMissingUrl = document.getElementById("first-visit-missing-url");
  const parentOtherInput = document.getElementById("parent-other");
  const statusStableRadio = document.getElementById("recent-stable");
  const statusUnstableRadio = document.getElementById("recent-unstable");
  const issueCheckboxes = Array.from(
    document.querySelectorAll('input[name="issues"]')
  );
  const selfHarmCheckbox = document.getElementById("issue-self-harm");
  const selfHarmAlert = document.getElementById("self-harm-alert");
  const otherDetailInput = document.getElementById("other-detail");
  const certCheckbox = document.getElementById("need-cert");
  const certDetailInput = document.getElementById("cert-detail");

  const liveSearchInput = document.getElementById("live-search-input");
  const liveArticlesBox = document.getElementById("live-articles");
  const liveArticlesHint = document.getElementById("live-articles-hint");

  const summaryCard = document.getElementById("summary-card");
  const resultGuideSection = document.getElementById("result-guide-section");
  const aiGuideBox = document.getElementById("ai-guide-box");
  const resultArticlesHint = document.getElementById("result-articles-hint");
  const resultArticlesBox = document.getElementById("result-articles");
  const chatSection = document.getElementById("chat-section");
  const chatMessagesBox = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const submitStatus = document.getElementById("submit-status");
  const editBtn = document.getElementById("edit-btn");

  let currentRecordId = "";
  let chatHistory = [];
  let lastSubmittedData = null;
  let currentLang = "zh";
  let firstVisitMode = "self";
  let publicConfig = {};

  function t(key, ...args) {
    const dict =
      (window.CLINIC_I18N && window.CLINIC_I18N[currentLang]) ||
      (window.CLINIC_I18N && window.CLINIC_I18N.zh) ||
      {};
    const val = dict[key];
    return typeof val === "function" ? val(...args) : val || "";
  }

  function getTextOrOverride(i18nKey, configKey, ...args) {
    if (currentLang === "zh" && configKey && publicConfig[configKey]) {
      return publicConfig[configKey];
    }
    return t(i18nKey, ...args);
  }

  function applyPublicConfigOverrides() {
    if (headerDescEl) {
      headerDescEl.textContent = getTextOrOverride("headerDesc", "MSG_HEADER_DESC");
    }
    if (closedBannerEl) {
      if (currentLang === "zh" && publicConfig.MSG_CLOSED_BANNER) {
        closedBannerEl.textContent = publicConfig.MSG_CLOSED_BANNER;
      } else {
        closedBannerEl.innerHTML = t("closedBanner");
      }
    }
    if (firstVisitMsgEl) {
      firstVisitMsgEl.textContent =
        firstVisitMode === "staff"
          ? getTextOrOverride("msgFirstVisitStaff", "MSG_FIRST_VISIT_STAFF")
          : getTextOrOverride("msgFirstVisitSelf", "MSG_FIRST_VISIT_SELF");
    }
    const viNotice = t("msgFirstVisitViNote");
    if (firstVisitViNoteEl) {
      const showVi = currentLang === "vi" && firstVisitMode === "self" && Boolean(viNotice);
      firstVisitViNoteEl.textContent = viNotice;
      firstVisitViNoteEl.classList.toggle("hidden", !showVi);
    }
  }

  function syncVisitCategoryUI() {
    const selected =
      document.querySelector('input[name="visitCategory"]:checked')?.value ||
      "followup";
    const isFirst = selected === "first";
    if (followupFields) {
      followupFields.classList.toggle("hidden", isFirst);
    }
    if (firstVisitPanel) {
      firstVisitPanel.classList.toggle("hidden", !isFirst);
    }
    if (firstVisitStaffActions) {
      firstVisitStaffActions.classList.toggle(
        "hidden",
        firstVisitMode !== "staff"
      );
    }
    if (firstVisitSelfActions) {
      firstVisitSelfActions.classList.toggle(
        "hidden",
        firstVisitMode === "staff"
      );
    }
    const parentFirstRadio = document.querySelector('input[name="parent"]');
    const q1FirstRadio = document.querySelector('input[name="q1"]');
    const q2FirstRadio = document.querySelector('input[name="q2"]');
    if (parentFirstRadio) parentFirstRadio.required = !isFirst;
    if (q1FirstRadio) q1FirstRadio.required = !isFirst;
    if (q2FirstRadio) q2FirstRadio.required = !isFirst;
    applyPublicConfigOverrides();
  }

  document.querySelectorAll('input[name="visitCategory"]').forEach((radio) => {
    radio.addEventListener("change", syncVisitCategoryUI);
  });

  function applyLanguage(lang) {
    currentLang = lang === "vi" ? "vi" : "zh";
    try {
      localStorage.setItem("clinic_lang", currentLang);
    } catch (e) {}

    document.documentElement.lang = currentLang === "vi" ? "vi" : "zh-Hant";
    document.title = t("pageTitle");

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const txt = t(el.dataset.i18n);
      if (txt) el.textContent = txt;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const htmlStr = t(el.dataset.i18nHtml);
      if (htmlStr) el.innerHTML = htmlStr;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const ph = t(el.dataset.i18nPh);
      if (ph) el.placeholder = ph;
    });

    if (liveArticlesBox && liveArticlesBox.children.length === 0) {
      liveArticlesHint.textContent = t("liveHintDefault");
    }
    applyPublicConfigOverrides();
    validatePatientIdentity();
  }

  function validatePatientIdentity() {
    const visitNo = visitNoInput ? visitNoInput.value.trim() : "";
    const childName = childNameInput ? childNameInput.value.trim() : "";
    if (!visitNo && !childName) {
      if (visitNoInput) {
        visitNoInput.setCustomValidity(t("errVisitOrNameRequired"));
      }
      return false;
    }
    if (visitNoInput) visitNoInput.setCustomValidity("");
    if (childNameInput) childNameInput.setCustomValidity("");
    return true;
  }

  if (visitNoInput) {
    visitNoInput.addEventListener("input", validatePatientIdentity);
  }
  if (childNameInput) {
    childNameInput.addEventListener("input", validatePatientIdentity);
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
  });

  // Highlight selected pills visually
  function syncPillStyles() {
    document.querySelectorAll(".option-pill").forEach((pill) => {
      const input = pill.querySelector("input");
      if (!input) return;
      pill.classList.toggle("selected", input.checked);
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target.matches('.option-pill input')) {
      syncPillStyles();
    }
  });

  // Parent "其他" toggle
  document.querySelectorAll('input[name="parent"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isOther = radio.value === "其他" && radio.checked;
      parentOtherInput.classList.toggle("hidden", !isOther);
      if (isOther) parentOtherInput.focus();
    });
  });

  // Recent status & checkboxes sync
  statusStableRadio.addEventListener("change", () => {
    if (statusStableRadio.checked) {
      issueCheckboxes.forEach((cb) => (cb.checked = false));
      selfHarmAlert.classList.add("hidden");
      syncPillStyles();
      refreshRecommendedArticles();
    }
  });

  issueCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        statusUnstableRadio.checked = true;
      }
      selfHarmAlert.classList.toggle("hidden", !selfHarmCheckbox.checked);
      syncPillStyles();
      refreshRecommendedArticles();
    });
  });

  // Cert checkbox toggle
  certCheckbox.addEventListener("change", () => {
    certDetailInput.classList.toggle("hidden", !certCheckbox.checked);
    if (certCheckbox.checked) certDetailInput.focus();
    refreshRecommendedArticles();
  });

  // Debounced search on text inputs
  let searchTimer = null;
  function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshRecommendedArticles, 280);
  }

  otherDetailInput.addEventListener("input", scheduleSearch);
  liveSearchInput.addEventListener("input", scheduleSearch);

  function getSelectedIssues() {
    return issueCheckboxes
      .filter((cb) => cb.checked && cb.value !== "傷害自己")
      .map((cb) => cb.value);
  }

  function buildFreeTextQuery() {
    const parts = [];
    if (otherDetailInput.value.trim()) parts.push(otherDetailInput.value.trim());
    if (certCheckbox.checked && certDetailInput.value.trim()) {
      parts.push(certDetailInput.value.trim());
    }
    if (liveSearchInput.value.trim()) parts.push(liveSearchInput.value.trim());
    return parts.join(" ").trim();
  }

  function buildSearchQuery() {
    const issues = getSelectedIssues();
    const freeText = buildFreeTextQuery();
    return [...issues, freeText].filter(Boolean).join(" ").trim();
  }

  function renderArticles(container, posts) {
    if (!posts || posts.length === 0) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = posts
      .map(
        (p) => `
      <a class="article-card" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
        <div class="article-title">📖 ${escapeHtml(p.title)}</div>
        <div class="article-summary">${escapeHtml(p.summary)}</div>
        <div class="tag-row">
          ${(p.tags || [])
            .map((t) => `<span class="tag">#${escapeHtml(t)}</span>`)
            .join("")}
        </div>
      </a>
    `
      )
      .join("");
  }

  async function refreshRecommendedArticles() {
    const selectedIssues = getSelectedIssues();
    const freeText = buildFreeTextQuery();
    if (selectedIssues.length === 0 && !freeText) {
      liveArticlesBox.innerHTML = "";
      liveArticlesHint.textContent = t("liveHintDefault");
      return [];
    }

    try {
      const posts = await window.BlogSearch.searchBlogPosts(
        freeText,
        4,
        selectedIssues
      );
      if (posts.length > 0) {
        liveArticlesHint.textContent = t("liveHintFound", posts.length);
        renderArticles(liveArticlesBox, posts);
      } else {
        liveArticlesHint.textContent = t("liveHintNone");
        liveArticlesBox.innerHTML = "";
      }
      return posts;
    } catch (err) {
      liveArticlesHint.textContent = t("liveHintDefault");
      return [];
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getIdentityFields() {
    const rawVisitNo = visitNoInput ? visitNoInput.value.trim() : "";
    const formattedVisitNo = rawVisitNo
      ? /^\d+$/.test(rawVisitNo)
        ? `${rawVisitNo}號`
        : rawVisitNo
      : "";
    const rawChildName = childNameInput ? childNameInput.value.trim() : "";
    const displayName = [formattedVisitNo, rawChildName].filter(Boolean).join(" ");
    return { formattedVisitNo, rawChildName, displayName };
  }

  function collectFormData(recommendedPosts) {
    const { formattedVisitNo, rawChildName, displayName } = getIdentityFields();
    const parentChoice =
      document.querySelector('input[name="parent"]:checked')?.value || "";
    const parent =
      parentChoice === "其他"
        ? parentOtherInput.value.trim() || "其他家長"
        : parentChoice;

    const q1 = document.querySelector('input[name="q1"]:checked')?.value || "";
    const q2 = document.querySelector('input[name="q2"]:checked')?.value || "";
    const medDays = document.getElementById("med-days").value.trim();

    const recentStatus = statusUnstableRadio.checked
      ? "狀況仍不穩定"
      : "表現不錯！狀況穩定";
    const issues = issueCheckboxes
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    const otherDetail = otherDetailInput.value.trim();
    const needCert = certCheckbox.checked;
    const certDetail = certDetailInput.value.trim();

    return {
      visitCategory: "followup",
      timestamp: new Date().toLocaleString("zh-TW", { hour12: false }),
      visitNo: formattedVisitNo,
      childName: rawChildName,
      displayName,
      parent,
      q1,
      q2,
      medDays,
      recentStatus,
      issues,
      selfHarm: selfHarmCheckbox.checked,
      otherDetail,
      needCert,
      certDetail,
      recommendedTitles: (recommendedPosts || []).map((p) => p.title),
    };
  }

  function renderSummaryCard(data) {
    if (data.visitCategory === "first") {
      summaryCard.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <strong style="font-size:1.15rem;">${escapeHtml(
            data.displayName || data.childName || t("sumUnfilled")
          )}</strong>
          <span class="badge badge-discuss">${escapeHtml(t("sumVisitFirst"))}</span>
        </div>
        <div class="summary-grid">
          <div class="summary-row">${escapeHtml(data.timestamp)}</div>
        </div>
      `;
      return;
    }

    const statusBadge = data.selfHarm
      ? `<span class="badge badge-danger">${escapeHtml(t("sumBadgeDanger"))}</span>`
      : data.q1 === "要與醫師討論" || data.recentStatus === "狀況仍不穩定"
      ? `<span class="badge badge-discuss">${escapeHtml(t("sumBadgeDiscuss"))}</span>`
      : `<span class="badge badge-stable">${escapeHtml(t("sumBadgeStable"))}</span>`;

    summaryCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <strong style="font-size:1.15rem;">${escapeHtml(
          data.displayName || data.childName || t("sumUnfilled")
        )}</strong>
        ${statusBadge}
      </div>
      <div class="summary-grid">
        <div class="summary-row">
          <span class="summary-label">${escapeHtml(t("sumParent"))}</span>
          ${escapeHtml(data.parent || t("sumUnselected"))}
        </div>
        <div class="summary-row">
          <span class="summary-label">${escapeHtml(t("sumQ1"))}</span>
          ${escapeHtml(data.q1 || t("sumUnselected"))}
        </div>
        <div class="summary-row">
          <span class="summary-label">${escapeHtml(t("sumQ2"))}</span>
          ${escapeHtml(data.q2 || t("sumUnselected"))}${
            data.medDays ? escapeHtml(t("sumMedDays", data.medDays)) : ""
          }
        </div>
        <div class="summary-row">
          <span class="summary-label">${escapeHtml(t("sumRecent"))}</span>
          ${escapeHtml(data.recentStatus)}
          ${
            data.issues.length > 0
              ? `<div style="margin-top:4px;color:#b45309;font-weight:600;">• ${data.issues
                  .map(escapeHtml)
                  .join("<br>• ")}</div>`
              : ""
          }
        </div>
        ${
          data.otherDetail
            ? `<div class="summary-row"><span class="summary-label">${escapeHtml(
                t("sumOther")
              )}</span>${escapeHtml(data.otherDetail)}</div>`
            : ""
        }
        ${
          data.needCert
            ? `<div class="summary-row"><span class="summary-label">${escapeHtml(
                t("sumCert")
              )}</span>${escapeHtml(data.certDetail || t("sumCertEmpty"))}</div>`
            : ""
        }
      </div>
    `;
  }

  function formatCandidatesForAi(list) {
    return (list || []).slice(0, 5).map((p) => ({
      title: p.title,
      url: p.url,
      text: (p.text || "").slice(0, 1200),
    }));
  }

  async function sendToGas(data, questionText, candidates) {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      return { ok: false, reason: "no_gas", aiGuide: null };
    }
    try {
      // Use text/plain to avoid CORS preflight with Google Apps Script
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submit",
          lang: currentLang,
          data,
          questionText,
          candidates: formatCandidatesForAi(candidates),
        }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const json = await resp.json();
      if (json.closed) {
        return { ok: false, reason: "closed", id: "", aiGuide: null };
      }
      return {
        ok: true,
        id: json.id || "",
        aiGuide: json.aiGuide || null,
      };
    } catch (err) {
      return { ok: false, reason: err.message, id: "", aiGuide: null };
    }
  }

  function appendChatBubble(role, text, links = []) {
    const div = document.createElement("div");
    div.className = `chat-bubble ${role === "user" ? "user" : "bot"}`;
    const safeHtml = escapeHtml(text).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    div.innerHTML = safeHtml;

    if (links && links.length > 0) {
      const linksWrap = document.createElement("div");
      linksWrap.style.marginTop = "8px";
      linksWrap.style.display = "flex";
      linksWrap.style.flexDirection = "column";
      linksWrap.style.gap = "6px";
      for (const p of links) {
        const a = document.createElement("a");
        a.href = p.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "chat-article-link";
        a.textContent = `📖 ${p.title}`;
        linksWrap.appendChild(a);
      }
      div.appendChild(linksWrap);
    }

    chatMessagesBox.appendChild(div);
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
    chatHistory.push({ role, text });
  }

  async function handleChatSend() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = "";
    appendChatBubble("user", msg);

    // Search blog posts for this follow-up question (fall back to combined context for short replies)
    const contextQuery = lastSubmittedData
      ? `${msg} ${lastSubmittedData.otherDetail || ""}`.trim()
      : msg;
    const contextIssues = lastSubmittedData
      ? (lastSubmittedData.issues || []).filter((i) => i !== "傷害自己")
      : [];
    let matchedPosts = await window.BlogSearch.searchBlogPosts(msg, 3, []);
    if (matchedPosts.length === 0 && contextIssues.length > 0) {
      matchedPosts = await window.BlogSearch.searchBlogPosts(
        contextQuery,
        3,
        contextIssues
      );
    }
    const aiCandidates = window.BlogSearch.getAiCandidates
      ? await window.BlogSearch.getAiCandidates(
          matchedPosts.length > 0 ? msg : contextQuery,
          6,
          matchedPosts.length > 0 ? [] : contextIssues
        )
      : matchedPosts;
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();

    if (!gasUrl) {
      // Local preview fallback: update summary card & show matched posts if any
      if (lastSubmittedData) {
        lastSubmittedData.otherDetail = lastSubmittedData.otherDetail
          ? `${lastSubmittedData.otherDetail}\n[補充] ${msg}`
          : `[補充] ${msg}`;
        renderSummaryCard(lastSubmittedData);
      }
      if (matchedPosts.length > 0) {
        appendChatBubble("bot", t("chatOfflineWithArticle"), matchedPosts.slice(0, 2));
      } else {
        appendChatBubble("bot", t("chatOfflineSaved"));
      }
      return;
    }

    chatSendBtn.disabled = true;
    let chatSec = 0;
    chatSendBtn.textContent = `${t("btnSending")} (0s)`;
    const chatTimer = setInterval(() => {
      chatSec++;
      chatSendBtn.textContent = `${t("btnSending")} (${chatSec}s)`;
    }, 1000);
    try {
      const resp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "chat",
          lang: currentLang,
          id: currentRecordId,
          message: msg,
          history: chatHistory,
          candidates: formatCandidatesForAi(aiCandidates),
        }),
      });
      const json = await resp.json();
      const replyText = json.reply || t("chatFallbackReply");
      const replyLinks =
        json.selectedUrls && json.selectedUrls.length > 0
          ? aiCandidates.filter((p) => json.selectedUrls.includes(p.url))
          : [];
      appendChatBubble("bot", replyText, replyLinks);
    } catch (err) {
      appendChatBubble("bot", t("chatNetErr"));
    } finally {
      clearInterval(chatTimer);
      chatSendBtn.disabled = false;
      chatSendBtn.textContent = t("btnChatSend");
    }
  }

  chatSendBtn.addEventListener("click", handleChatSend);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleChatSend();
    }
  });

  async function submitFirstVisit(target) {
    if (!validatePatientIdentity()) {
      if (visitNoInput) visitNoInput.reportValidity();
      return;
    }
    const { formattedVisitNo, rawChildName, displayName } = getIdentityFields();
    if (rawChildName) {
      saveChildName(rawChildName);
    }
    const data = {
      visitCategory: "first",
      firstVisitTarget: target,
      timestamp: new Date().toLocaleString("zh-TW", { hour12: false }),
      visitNo: formattedVisitNo,
      childName: rawChildName,
      displayName,
    };
    lastSubmittedData = data;
    currentRecordId = "";
    chatHistory = [];
    chatMessagesBox.innerHTML = "";

    renderSummaryCard(data);
    aiGuideBox.classList.add("hidden");
    aiGuideBox.textContent = "";
    resultGuideSection.classList.add("hidden");
    chatSection.classList.add("hidden");
    if (firstVisitLinkCard) firstVisitLinkCard.classList.add("hidden");

    formView.classList.add("hidden");
    resultView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });

    let waitSec = 0;
    submitStatus.className = "alert alert-info";
    submitStatus.style.fontWeight = "600";
    submitStatus.textContent = t("statusSendingSec", 0);
    const submitTimer = setInterval(() => {
      waitSec++;
      submitStatus.textContent = t("statusSendingSec", waitSec);
    }, 1000);

    const res = await sendToGas(data, "", []);
    clearInterval(submitTimer);
    submitStatus.style.fontWeight = "";
    currentRecordId = res.id || "";

    const targetUrl =
      firstVisitMode === "self"
        ? target === "adult"
          ? (publicConfig.FIRST_VISIT_ADULT_URL || "").trim()
          : (publicConfig.FIRST_VISIT_CHILD_URL || "").trim()
        : "";

    if (res.ok) {
      submitStatus.className = "alert alert-info";
      submitStatus.textContent = targetUrl
        ? t("statusFirstVisitRedirecting")
        : getTextOrOverride("statusFirstVisitSent", "MSG_FIRST_VISIT_DONE");
    } else if (res.reason === "closed") {
      resultView.classList.add("hidden");
      formView.classList.add("hidden");
      closedView.classList.remove("hidden");
      return;
    } else if (res.reason === "no_gas") {
      submitStatus.className = "alert alert-warning";
      submitStatus.textContent = t("statusNoGas");
    } else {
      submitStatus.className = "alert alert-warning";
      submitStatus.textContent = t("statusNetErr");
    }

    if (firstVisitLinkCard && firstVisitMode === "self") {
      firstVisitLinkCard.classList.remove("hidden");
      if (firstVisitResultViNote) {
        const viNotice = t("msgFirstVisitViNote");
        const showVi = currentLang === "vi" && Boolean(viNotice);
        firstVisitResultViNote.textContent = viNotice;
        firstVisitResultViNote.classList.toggle("hidden", !showVi);
      }
      if (targetUrl) {
        if (firstVisitFormLink) {
          firstVisitFormLink.href = targetUrl;
          firstVisitFormLink.classList.remove("hidden");
        }
        if (firstVisitMissingUrl) firstVisitMissingUrl.classList.add("hidden");
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 300);
      } else {
        if (firstVisitFormLink) firstVisitFormLink.classList.add("hidden");
        if (firstVisitMissingUrl) {
          firstVisitMissingUrl.classList.remove("hidden");
        }
      }
    }
  }

  if (fvStaffBtn) {
    fvStaffBtn.addEventListener("click", () => submitFirstVisit("staff"));
  }
  if (fvChildBtn) {
    fvChildBtn.addEventListener("click", () => submitFirstVisit("child"));
  }
  if (fvAdultBtn) {
    fvAdultBtn.addEventListener("click", () => submitFirstVisit("adult"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validatePatientIdentity()) {
      if (visitNoInput) visitNoInput.reportValidity();
      return;
    }
    const visitCategory =
      document.querySelector('input[name="visitCategory"]:checked')?.value ||
      "followup";
    if (visitCategory === "first") {
      submitFirstVisit(firstVisitMode === "staff" ? "staff" : "child");
      return;
    }

    const questionText = buildSearchQuery();
    const selectedIssues = getSelectedIssues();
    const freeText = buildFreeTextQuery();
    const posts = await refreshRecommendedArticles();
    const aiCandidates =
      selectedIssues.length > 0 || freeText
        ? window.BlogSearch.getAiCandidates
          ? await window.BlogSearch.getAiCandidates(freeText, 5, selectedIssues)
          : posts
        : [];
    const data = collectFormData(posts);
    if (data.childName) {
      saveChildName(data.childName);
    }
    lastSubmittedData = data;
    currentRecordId = "";
    chatHistory = [];
    chatMessagesBox.innerHTML = "";

    renderSummaryCard(data);
    aiGuideBox.classList.add("hidden");
    aiGuideBox.textContent = "";
    if (firstVisitLinkCard) firstVisitLinkCard.classList.add("hidden");

    if (data.selfHarm) {
      resultGuideSection.classList.add("hidden");
      chatSection.classList.add("hidden");
    } else {
      resultGuideSection.classList.remove("hidden");
      chatSection.classList.remove("hidden");
      resultArticlesHint.textContent = t("guideLoading");
      renderArticles(resultArticlesBox, posts);
    }

    formView.classList.add("hidden");
    resultView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });

    let waitSec = 0;
    submitStatus.className = "alert alert-info";
    submitStatus.style.fontWeight = "600";
    submitStatus.textContent = t("statusSendingSec", 0);
    const submitTimer = setInterval(() => {
      waitSec++;
      submitStatus.textContent = t("statusSendingSec", waitSec);
    }, 1000);

    const res = await sendToGas(data, questionText, aiCandidates);
    clearInterval(submitTimer);
    submitStatus.style.fontWeight = "";
    currentRecordId = res.id || "";
    if (res.ok) {
      submitStatus.className = "alert alert-info";
      submitStatus.textContent = getTextOrOverride(
        "statusSent",
        "MSG_FOLLOWUP_SENT"
      );
    } else if (res.reason === "closed") {
      resultView.classList.add("hidden");
      formView.classList.add("hidden");
      closedView.classList.remove("hidden");
      return;
    } else if (res.reason === "no_gas") {
      submitStatus.className = "alert alert-warning";
      submitStatus.textContent = t("statusNoGas");
    } else {
      submitStatus.className = "alert alert-warning";
      submitStatus.textContent = t("statusNetErr");
    }

    if (data.selfHarm) return;

    const aiGuide = res.aiGuide;
    if (aiGuide && aiGuide.suitable) {
      aiGuideBox.textContent = aiGuide.summary;
      aiGuideBox.classList.remove("hidden");
      const selectedSet = new Set(aiGuide.selectedUrls || []);
      const chosenPosts = aiCandidates.filter((p) => selectedSet.has(p.url));
      const displayPosts = chosenPosts.length > 0 ? chosenPosts : posts.slice(0, 2);
      resultArticlesHint.textContent = t("guideLinksLabel");
      renderArticles(resultArticlesBox, displayPosts);
    } else if (aiGuide && aiGuide.suitable === false) {
      resultArticlesHint.textContent = t("guideNotSuitable");
      resultArticlesBox.innerHTML = "";
    } else if (posts.length > 0) {
      resultArticlesHint.textContent = t("guideDefaultLabel");
      renderArticles(resultArticlesBox, posts);
    } else {
      resultArticlesHint.textContent = t("guideRecordedOnly");
    }

    if (aiGuide && aiGuide.followUpQuestion) {
      appendChatBubble("bot", aiGuide.followUpQuestion);
    } else if (data.otherDetail && posts.length === 0) {
      appendChatBubble("bot", t("defaultFollowUp"));
    }

    // 運算完成後自動捲動到「衛教重點導讀與文章推薦」區塊
    resultGuideSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  editBtn.addEventListener("click", () => {
    resultView.classList.add("hidden");
    formView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Standalone search on closed-hours view
  let closedSearchTimer = null;
  if (closedSearchInput) {
    closedSearchInput.addEventListener("input", () => {
      clearTimeout(closedSearchTimer);
      closedSearchTimer = setTimeout(async () => {
        const q = closedSearchInput.value.trim();
        if (!q) {
          closedArticlesBox.innerHTML = "";
          return;
        }
        const posts = await window.BlogSearch.searchBlogPosts(q, 4, []);
        renderArticles(closedArticlesBox, posts);
      }, 280);
    });
  }

  async function checkClinicStatus() {
    const gasUrl = (window.CLINIC_CONFIG?.GAS_URL || "").trim();
    if (!gasUrl) {
      syncVisitCategoryUI();
      return;
    }
    try {
      const resp = await fetch(`${gasUrl}?action=status&t=${Date.now()}`);
      const json = await resp.json();
      if (json.ok) {
        if (json.firstVisitMode === "staff" || json.firstVisitMode === "self") {
          firstVisitMode = json.firstVisitMode;
        }
        if (json.publicConfig && typeof json.publicConfig === "object") {
          publicConfig = json.publicConfig;
        }
        syncVisitCategoryUI();
        if (json.clinicOpen === false) {
          formView.classList.add("hidden");
          resultView.classList.add("hidden");
          closedView.classList.remove("hidden");
        }
      }
    } catch (err) {
      // Keep form usable if status check fails
    }
  }

  function saveChildName(name) {
    try {
      localStorage.setItem(CHILD_NAME_STORAGE_KEY, name);
      if (clearSavedNameBtn) clearSavedNameBtn.classList.remove("hidden");
    } catch (e) {}
  }

  function loadSavedChildName() {
    if (!childNameInput) return;
    try {
      const savedName = localStorage.getItem(CHILD_NAME_STORAGE_KEY) || "";
      if (savedName) {
        childNameInput.value = savedName;
        if (clearSavedNameBtn) clearSavedNameBtn.classList.remove("hidden");
      }
    } catch (e) {}
  }

  if (clearSavedNameBtn) {
    clearSavedNameBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(CHILD_NAME_STORAGE_KEY);
      } catch (e) {}
      if (childNameInput) {
        childNameInput.value = "";
        childNameInput.focus();
      }
      clearSavedNameBtn.classList.add("hidden");
      validatePatientIdentity();
    });
  }

  // Restore saved child name before initial validation & language setup
  loadSavedChildName();

  // Initialize language (saved preference or browser Vietnamese detection)
  let initLang = "zh";
  try {
    const saved = localStorage.getItem("clinic_lang");
    if (saved === "vi" || saved === "zh") {
      initLang = saved;
    } else if ((navigator.language || "").toLowerCase().startsWith("vi")) {
      initLang = "vi";
    }
  } catch (e) {}
  applyLanguage(initLang);
  syncVisitCategoryUI();

  // Preload blog index & check clinic status
  window.BlogSearch.loadPosts().catch(() => {});
  checkClinicStatus();
})();
