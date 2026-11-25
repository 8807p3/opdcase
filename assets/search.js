// Client-side search engine for https://goodadhd.blogspot.com/ (314風神學院)

(function () {
  const STOPWORDS = new Set([
    "問題", "使用", "狀況", "討論", "小朋友", "孩子", "家長", "醫師", "醫生",
    "沒有", "可以", "怎麼", "什麼", "時候", "我們", "他們", "她們", "自己",
    "最近", "比較", "還是", "因為", "所以", "如果", "需要", "評估", "證明",
    "診斷", "看診", "不當", "容易", "其他", "補充", "調整", "覺得", "好像",
    "一直", "非常", "有時", "常常", "總是", "不會", "不能", "不想", "應該",
    "如何", "為什麼", "老師", "學校", "媽媽", "爸爸", "東西", "事情", "這個",
    "那個", "這樣", "那樣", "一下", "一點", "很多", "每天", "今天", "昨天",
  ]);

  // Map exact questionnaire checkbox labels to clean clinical keywords & blog tags
  const ISSUE_QUERY_MAP = {
    "打同學／常與同學吵架／捉弄同學": {
      keywords: ["人際", "同學", "吵架", "打架", "打人", "捉弄", "霸凌", "社交", "同儕"],
      tags: ["人際互動"],
    },
    "與家人爭執多／與手足爭執多": {
      keywords: ["親子", "手足", "家人", "爭執", "衝突", "頂嘴", "管教", "溝通"],
      tags: ["親子"],
    },
    "容易生氣、講不聽": {
      keywords: ["生氣", "情緒", "發脾氣", "情緒失控", "暴躁", "對立", "憤怒", "講不聽"],
      tags: ["心理調適", "親子"],
    },
    "忘記吃藥／抗拒服藥／沒按時吃": {
      keywords: ["藥物", "服藥", "吃藥", "用藥", "忘記吃藥", "停藥", "規律", "拒吃", "假日"],
      tags: ["藥物"],
    },
    "服藥後不適或副作用（如沒胃口、睡不著、不舒服）": {
      keywords: ["副作用", "食慾", "沒胃口", "吃不下", "睡不著", "失眠", "睡眠", "藥物", "長高", "體重"],
      tags: ["藥物"],
    },
  };

  const SYNONYMS = [
    ["打同學", "打人", "吵架", "捉弄", "霸凌", "人際", "同儕", "社交"],
    ["手足", "兄弟姐妹", "家人", "親子", "頂嘴", "管教"],
    ["生氣", "發脾氣", "暴躁", "情緒", "憤怒", "對立", "講不聽"],
    ["吃藥", "服藥", "用藥", "藥物", "副作用", "停藥", "減藥", "利他能", "專思達", "思銳"],
    ["食慾", "吃不下", "沒胃口", "體重", "長高", "身高"],
    ["作業", "功課", "拖拉", "拖延", "寫字", "專注", "分心", "執行功能"],
    ["睡覺", "睡不著", "失眠", "睡眠", "晚睡"],
    ["國中", "高中", "青春期", "叛逆", "手機", "網路", "成癮"],
    ["診斷證明", "特教", "鑑定", "心理衡鑑", "資源班"],
  ];

  const VI_TO_ZH_HINTS = [
    ["đánh bạn", "cãi nhau", "trêu", "bạn bè", "đánh nhau", "霸凌 人際 同學 吵架"],
    ["người nhà", "anh em", "chị em", "gia đình", "bố mẹ", "親子 手足 家人 爭執"],
    ["nổi nóng", "tức giận", "cáu", "không nghe", "bướng", "生氣 情緒 發脾氣 講不聽"],
    ["thuốc", "uống thuốc", "tác dụng phụ", "cuối tuần", "藥物 服藥 吃藥 副作用"],
    ["ăn", "chán ăn", "không muốn ăn", "gầy", "食慾 吃不下 沒胃口 體重"],
    ["bài tập", "trì hoãn", "chậm", "tập trung", "quên", "作業 拖延 專注 分心 執行功能"],
    ["ngủ", "mất ngủ", "khó ngủ", "thức khuya", "睡眠 失眠 睡不著"],
    ["dậy thì", "cấp 2", "cấp 3", "điện thoại", "game", "青春期 國中 高中 手機 網路"],
    ["đánh giá", "giấy chứng nhận", "chẩn đoán", "評估 診斷證明 鑑定"],
  ];

  let cachedPosts = null;

  async function loadPosts() {
    if (cachedPosts) return cachedPosts;
    const resp = await fetch("./data/posts.json");
    if (!resp.ok) {
      throw new Error("無法載入部落格文章索引");
    }
    const data = await resp.json();
    cachedPosts = (data.posts || []).filter(
      (p) => !(p.tags || []).includes("公告")
    );
    return cachedPosts;
  }

  function extractQueryTerms(query, selectedIssues) {
    const keywordSet = new Set();
    const preferredTags = new Set();

    // 1. Add curated keywords & tags for checked issues
    for (const issue of selectedIssues || []) {
      const mapped = ISSUE_QUERY_MAP[issue];
      if (mapped) {
        mapped.keywords.forEach((k) => keywordSet.add(k.toLowerCase()));
        mapped.tags.forEach((t) => preferredTags.add(t.toLowerCase()));
      }
    }

    // 2. Tokenize free-text query (augment with Chinese hints if Vietnamese terms appear)
    let augmentedQuery = query || "";
    const lowerRaw = augmentedQuery.toLowerCase();
    for (const row of VI_TO_ZH_HINTS) {
      const zhHints = row[row.length - 1];
      const viTerms = row.slice(0, -1);
      if (viTerms.some((vt) => lowerRaw.includes(vt))) {
        augmentedQuery += " " + zhHints;
      }
    }

    const cleaned = augmentedQuery
      .replace(/[，。！？、；：「」『』（）()／,.!?\n\r/]/g, " ")
      .trim()
      .toLowerCase();

    if (cleaned) {
      const rawParts = cleaned.split(/\s+/).filter(Boolean);
      for (const part of rawParts) {
        if (part.length >= 2 && !STOPWORDS.has(part)) {
          keywordSet.add(part);
        }
        // Only generate 2-char bigrams for longer Chinese phrases, filtering stopwords
        if (part.length >= 3) {
          for (let i = 0; i <= part.length - 2; i++) {
            const gram = part.slice(i, i + 2);
            if (!STOPWORDS.has(gram) && !/^\s+$/.test(gram)) {
              keywordSet.add(gram);
            }
          }
        }
      }

      // Expand domain synonyms only when free-text matches a group
      for (const group of SYNONYMS) {
        const hit = group.some((kw) => cleaned.includes(kw.toLowerCase()));
        if (hit) {
          group.forEach((kw) => keywordSet.add(kw.toLowerCase()));
        }
      }
    }

    return {
      keywords: Array.from(keywordSet),
      preferredTags: Array.from(preferredTags),
    };
  }

  async function searchBlogPosts(
    query,
    limit = 4,
    selectedIssues = [],
    options = {}
  ) {
    const posts = await loadPosts();
    const { keywords, preferredTags } = extractQueryTerms(query, selectedIssues);
    if (keywords.length === 0 && preferredTags.length === 0) return [];

    const minScore = options.minScore ?? 10;
    const minHits = options.minHits ?? 2;
    const totalPosts = posts.length || 1;
    const scored = [];

    // Compute document frequency (IDF) so overly common words carry near-zero weight
    const dfMap = new Map();
    for (const kw of keywords) {
      let df = 0;
      for (const p of posts) {
        const hay = ((p.title || "") + " " + (p.text || "")).toLowerCase();
        if (hay.includes(kw)) df++;
      }
      dfMap.set(kw, df);
    }

    for (const post of posts) {
      const titleLower = (post.title || "").toLowerCase();
      const tagsLower = (post.tags || []).map((t) => t.toLowerCase());
      const textLower = (post.text || "").toLowerCase();

      let score = 0;
      let hitCount = 0;

      for (const tag of preferredTags) {
        if (tagsLower.includes(tag)) {
          score += 6;
          hitCount++;
        }
      }

      for (const kw of keywords) {
        const df = dfMap.get(kw) || 0;
        // Skip words that appear in >25% of all posts (too generic)
        if (df > totalPosts * 0.25) continue;
        const idfBoost = Math.min(2.0, Math.max(0.6, Math.log10(totalPosts / (df + 1))));

        if (titleLower.includes(kw)) {
          score += (kw.length >= 3 ? 10 : 7) * idfBoost;
          hitCount++;
        } else if (tagsLower.some((t) => t.includes(kw))) {
          score += 6 * idfBoost;
          hitCount++;
        } else if (textLower.includes(kw)) {
          score += (kw.length >= 3 ? 3 : 1.5) * idfBoost;
          hitCount++;
        }
      }

      if (score >= minScore && hitCount >= minHits) {
        scored.push({ post, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((item) => item.post);
  }

  async function getAiCandidates(query, limit = 6, selectedIssues = []) {
    return searchBlogPosts(query, limit, selectedIssues, {
      minScore: 3,
      minHits: 1,
    });
  }

  window.BlogSearch = {
    loadPosts,
    searchBlogPosts,
    getAiCandidates,
  };
})();
