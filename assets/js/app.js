window.imgFB = function (img) {
  var list = (img.dataset.fb || "").split("|").filter(Boolean);
  if (list.length) { img.src = list.shift(); img.dataset.fb = list.join("|"); } else { img.onerror = null; }
};

(function () {
  "use strict";

  var D = window.XB_DATA;
  var CFG = window.XB_CONFIG || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var DATA = { works: [], source: "local", remoteTried: false, showDemo: false };

  function demoMode() { return false; }

  function buildWorks(cloudRows) {
    if (!demoMode()) return (D.officialWorks || []).map(function (w) {
      var o = {}; Object.keys(w).forEach(function (k) { o[k] = w[k]; });
      o.verified = true;
      return o;
    });
    var official = (D.officialWorks || []).map(function (w) {
      var o = {}; Object.keys(w).forEach(function (k) { o[k] = w[k]; });
      o.verified = true;
      return o;
    });
    var demo;
    if (cloudRows && cloudRows.length) {
      demo = cloudRows.map(function (row) {
        var local = (D.works || []).filter(function (x) { return x.title === row.slug || x.title === row.title; })[0];
        var content = (row.content && row.content.length) ? row.content : (local ? local.content : null);
        return {
          id: row.id, title: row.title, author: row.author,
          grade: row.grade || "", class_name: row.class_name || "",
          category: row.category || "essay",
          excerpt: row.excerpt || (local ? local.excerpt : ""),
          content: content && content.length ? content : ["（正文待补充）"],
          likes: row.likes || 0, bookmarks: row.bookmarks || 0,
          slug: row.slug || row.title, cloud: true, demo: true
        };
      });
    } else {
      demo = (D.works || []).map(function (w) {
        var o = {}; Object.keys(w).forEach(function (k) { o[k] = w[k]; });
        o.demo = true;
        return o;
      });
    }
    return official.concat(demo);
  }
  var PAGE_SIZE = 6;
  var wState = { filter: "all", shown: PAGE_SIZE };
  var curWork = null;

  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem("xb_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem("xb_" + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("xb_" + k); } catch (e) {} }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(name, filled) {
    return '<svg class="ic' + (filled ? " ic-f" : "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  function toast(m, t) {
    var e = $("#toastEl");
    if (!e) return;
    e.textContent = m;
    e.className = "toast toast-" + (t || "ok") + " show";
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove("show"); }, 2200);
  }
  function hl(t, q) {
    var idx = String(t).toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(t);
    return esc(t.slice(0, idx)) + '<span class="hl">' + esc(t.slice(idx, idx + q.length)) + "</span>" + esc(t.slice(idx + q.length));
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  var CLOUD_USER = null;
  function curUser() { return CLOUD_USER || LS.get("user", null); }
  function likes() { return LS.get("likes", []); }
  function bookmarks() { return LS.get("bookmarks", []); }
  function commentsOf(id) { return LS.get("comments", {})[String(id)] || []; }
  function workById(id) {
    for (var i = 0; i < DATA.works.length; i++) {
      if (String(DATA.works[i].id) === String(id)) return DATA.works[i];
    }
    return null;
  }

  var CAT_HUE = { prose: "#b8964a", poetry: "#8b3a3a", fiction: "#5b7a6a", essay: "#9c6b3f" };
  var CAT_CHAR = { prose: "散", poetry: "诗", fiction: "小", essay: "随" };

  function coverArt(w) {
    var hue = CAT_HUE[w.category] || "#8b3a3a";
    var cat = D.categories[w.category] || "作品";
    var chars = String(w.title || "").split("");
    var title = chars.map(function (c, i) {
      return '<text x="342" y="' + (58 + i * 36) + '" font-size="29" fill="' + hue + '" text-anchor="middle">' + esc(c) + "</text>";
    }).join("");
    return '<svg viewBox="0 0 400 300" role="img" aria-label="《' + esc(w.title) + "》封面\">" +
      '<rect width="400" height="300" fill="#f6efe0"/>' +
      '<rect x="10" y="10" width="380" height="280" fill="none" stroke="#dccfb0" stroke-width="1.5"/>' +
      '<text x="150" y="252" font-size="170" fill="' + hue + '" opacity="0.1" text-anchor="middle">' + esc(CAT_CHAR[w.category] || "文") + "</text>" +
      '<text x="26" y="48" font-size="13" fill="#8b7e6c" letter-spacing="2">新笔文学社 · 社员作品</text>' +
      '<rect x="26" y="212" width="42" height="42" rx="3" fill="#8b3a3a"/>' +
      '<text x="47" y="240" font-size="19" fill="#f6efe0" text-anchor="middle">' + esc(cat.charAt(0)) + "</text>" +
      '<text x="82" y="242" font-size="15" fill="#5c5040">' + esc(cat) + "</text>" +
      '<text x="26" y="280" font-size="13" fill="#8b7e6c">' + esc(w.author || "") + (w.grade ? " · " + esc(w.grade) + esc(w.class_name || "") + "班" : "") + "</text>" +
      title +
      "</svg>";
  }

  function normalizeRemoteWork(w) {
    var content = [];
    if (Array.isArray(w.content)) content = w.content;
    else if (typeof w.content === "string") {
      var raw = w.content.trim();
      content = raw.split(/\r?\n\s*\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      
      if (content.length < 2 && raw.length > 400) {
        content = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      }
    }
    var cat = ["prose", "poetry", "fiction", "essay"].indexOf(w.category) > -1 ? w.category : "essay";
    return {
      id: w.id,
      title: w.title || "无题",
      author: w.author || "佚名",
      grade: w.grade || "",
      class_name: w.class_name || "",
      category: cat,
      tags: [],
      rating: 0,
      excerpt: w.excerpt || (content[0] || "").slice(0, 90),
      content: content.length ? content : ["（正文待补充）"],
      likes: w.likes || 0,
      bookmarks: w.bookmarks || 0,
      created_at: w.created_at || "",
      remote: true
    };
  }

  function setSourceBadge() {
    var b = $("#srcBadge");
    if (!b) return;
    if (DATA.source === "cloud") {
      b.textContent = "数据来源：社团云端作品库（实时）";
      b.className = "src-badge src-on";
    } else if (DATA.source === "remote") {
      b.textContent = "数据来源：旧站 Supabase（实时）";
      b.className = "src-badge src-on";
    } else if (DATA.source === "local-managed") {
      b.textContent = "数据来源：本地管理（后台编辑）";
      b.className = "src-badge src-managed";
    } else {
      b.textContent = "数据来源：本地示例数据（云端未连通）";
      b.className = "src-badge";
    }
  }

  function applyCloudData(cloud) {
    var corpus = {};
    D.works.forEach(function (w) { corpus[w.title] = w; });
    if (cloud.works && cloud.works.length) {
      DATA.works = buildWorks(cloud.works);
    }
    if (cloud.events && cloud.events.length) {
      D.events = cloud.events.map(function (r) {
        var b = r.body || {};
        return { title: r.title || b.title || "活动", days: b.days || 14, time: b.time || "18:00-20:00", loc: b.loc || "待定", desc: b.desc || "" };
      });
    }
    
    if (D.site && D.site.advisors && D.site.advisors.length) {
      D.members = D.site.advisors;
    }
    
  }

  function loadCloudData() {
    if (!window.XB_CLOUD) return Promise.resolve(null);
    return XB_CLOUD.load().then(function (ok) {
      if (!ok) return null;
      return Promise.all([
        XB_CLOUD.fetchWorks(),
        XB_CLOUD.fetchContent("event"),
        XB_CLOUD.fetchContent("member"),
        XB_CLOUD.fetchContent("issue"),
        XB_CLOUD.fetchContent("people"),
        XB_CLOUD.fetchContent("sections")
      ]).then(function (res) {
        var cloud = { works: res[0], events: res[1], members: res[2], issues: res[3] };
        if (res[4] && res[4].length) {
          var lp = res[4][res[4].length - 1];
          if (lp && Array.isArray(lp.body) && lp.body.length) window.XB_PEOPLE = lp.body;
        }
        if (res[5] && res[5].length) {
          var ls = res[5][res[5].length - 1];
          if (ls && ls.body && ls.body.verified) D.site.sections = ls.body;
        }
        if (!cloud.works && !cloud.events && !cloud.members && !cloud.issues) return null;
        applyCloudData(cloud);
        DATA.source = "cloud";
        return cloud;
      });
    }).catch(function () { return null; });
  }

  function loadRemoteWorks() {
    if (DATA.remoteTried) return Promise.resolve(DATA.source === "remote");
    DATA.remoteTried = true;
    var legacy = (window.XB_CONFIG || {}).legacySupabase || {};
    if (!legacy.enableRemote || !legacy.supabaseUrl || !legacy.anonKey) return Promise.resolve(false);
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, legacy.timeoutMs || 7000);
    var url = legacy.supabaseUrl + "/rest/v1/works?select=id,title,author,grade,class_name,category,excerpt,likes,bookmarks,created_at,content&order=created_at.desc&limit=100";
    return fetch(url, { headers: { apikey: legacy.anonKey }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (list) {
        if (Array.isArray(list) && list.length) {
          DATA.works = list.map(normalizeRemoteWork);
          DATA.source = "remote";
        }
        return DATA.source === "remote";
      })
      .catch(function () {
        clearTimeout(timer);
        return false;
      });
  }

  function showSkeleton() {
    var grid = $("#worksGrid");
    if (!grid) return;
    var s = "";
    for (var i = 0; i < PAGE_SIZE; i++) {
      s += '<div class="sk-card"><div class="sk-art"></div><div class="sk-line"></div><div class="sk-line short"></div></div>';
    }
    grid.innerHTML = s;
    var wrap = $("#loadMoreWrap");
    if (wrap) wrap.innerHTML = "";
  }

  function matchWorks() {
    return DATA.works.filter(function (w) {
      if (!w.verified && !demoMode()) return false;
      return wState.filter === "all" || w.category === wState.filter;
    });
  }

  function stars(r) {
    var full = Math.round(r / 2);
    var h = "";
    for (var i = 0; i < 5; i++) h += '<span class="star' + (i < full ? " on" : "") + '" aria-hidden="true">★</span>';
    return '<span class="stars" role="img" aria-label="评分 ' + r.toFixed(1) + ' 分">' + h + "</span>";
  }

  function workCard(w, i) {
    var liked = likes().indexOf(w.id) > -1;
    var bmed = bookmarks().indexOf(w.id) > -1;
    var metaLine = w.remote && !w.rating
      ? '<span class="wc-date">' + esc(fmtDate(w.created_at)) + "</span>"
      : (w.rating ? '<span class="rating-num">' + w.rating.toFixed(1) + "</span>" + stars(w.rating) : "");
    return '<div class="wc rv d' + ((i % 4) + 1) + '" data-id="' + w.id + '">' +
      '<div class="wci">' + coverArt(w) + '<span class="wcbadge">' + esc(D.categories[w.category] || "") + "</span></div>" +
      '<div class="wcb">' +
      '<h3 class="bc-title">' + esc(w.title) + (w.verified ? '<span class="ver-chip">已发表</span>' : "") + "</h3>" +
      '<div class="wcm">' + esc(w.grade) + (w.class_name ? esc(w.class_name) + "班 · " : " · ") +
      '<a href="authors.html?name=' + encodeURIComponent(w.author) + '">' + esc(w.author) + "</a></div>" +
      '<p class="wce">' + esc(w.excerpt) + "</p>" +
      '<div class="wcs">' + metaLine +
      '<button type="button" class="like-btn' + (liked ? " liked" : "") + '" data-id="' + w.id + '" aria-label="点赞">' + icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span></button>" +
      '<button type="button" class="bookmark-btn' + (bmed ? " liked" : "") + '" data-id="' + w.id + '" aria-label="收藏">' + icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span></button>" +
      "</div></div></div>";
  }

  function updateDemoToggle() {
    var on = demoMode();
    $$("[data-demo-toggle]").forEach(function (b) {
      b.textContent = on ? "← 返回真实内容" : "查看示例版式（30 篇，仅演示）";
    });
  }

  function bindDemoToggle() {
    $$("[data-demo-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var u = new URL(location.href);
        if (demoMode()) u.searchParams.delete("demo");
        else u.searchParams.set("demo", "1");
        location.href = u.href;
      });
    });
    updateDemoToggle();
  }

  function renderWorks(reset) {
    var list = matchWorks();
    if (reset) wState.shown = PAGE_SIZE;
    else wState.shown = Math.min(wState.shown + PAGE_SIZE, list.length);
    var grid = $("#worksGrid");
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<p class="empty-grid">该分类下暂无作品，换个分类看看。</p>';
      var w0 = $("#loadMoreWrap");
      if (w0) w0.innerHTML = "";
      return;
    }
    grid.innerHTML = list.slice(0, wState.shown).map(workCard).join("");
    var wrap = $("#loadMoreWrap");
    if (list.length > wState.shown) {
      wrap.innerHTML = '<button type="button" class="btn btn-l" id="loadMoreBtn">加载更多作品（还有 ' + (list.length - wState.shown) + " 篇）</button>";
      on("#loadMoreBtn", "click", function () { renderWorks(false); observeReveals(); });
    } else {
      wrap.innerHTML = list.length > PAGE_SIZE ? '<p class="works-all">已展示全部 ' + list.length + " 篇作品</p>" : "";
    }
    observeReveals();
  }

  function updateWorkUI(id) {
    var w = workById(id);
    if (!w) return;
    var liked = likes().indexOf(id) > -1;
    var bmed = bookmarks().indexOf(id) > -1;
    $$(".like-btn[data-id=\"" + id + "\"]").forEach(function (b) {
      b.classList.toggle("liked", liked);
      b.innerHTML = icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span>";
    });
    $$(".bookmark-btn[data-id=\"" + id + "\"]").forEach(function (b) {
      b.classList.toggle("liked", bmed);
      b.innerHTML = icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span>";
    });
    var lb = $("#mLikeBtn");
    if (lb) {
      lb.classList.toggle("on", liked);
      lb.innerHTML = icon("heart", liked) + ' <span id="mLikes">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢";
    }
    var bb = $("#mBookmarkBtn");
    if (bb) {
      bb.classList.toggle("on", bmed);
      bb.classList.toggle("gold", bmed);
      bb.innerHTML = icon("bookmark", bmed) + ' <span id="mBookmarkCount">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏";
    }
  }

  function toggleLike(id) {
    var l = likes();
    var i = l.indexOf(id);
    if (i > -1) l.splice(i, 1); else l.push(id);
    LS.set("likes", l);
    updateWorkUI(id);
    toast(i > -1 ? "已取消点赞" : "点赞成功");
    if (window.XB_CLOUD && XB_CLOUD.isReady() && CLOUD_USER) {
      XB_CLOUD.markInteraction(id, "like", i === -1).catch(function () {});
    }
  }

  function toggleBookmark(id) {
    var b = bookmarks();
    var i = b.indexOf(id);
    if (i > -1) b.splice(i, 1); else b.push(id);
    LS.set("bookmarks", b);
    updateWorkUI(id);
    toast(i > -1 ? "已取消收藏" : "已加入收藏");
    if (window.XB_CLOUD && XB_CLOUD.isReady() && CLOUD_USER) {
      XB_CLOUD.markInteraction(id, "bookmark", i === -1).catch(function () {});
    }
  }

  function openWork(id) {
    var w = workById(id);
    if (!w) { toast("作品不存在或数据尚未加载", "err"); return; }
    curWork = w;
    var liked = likes().indexOf(id) > -1;
    var bmed = bookmarks().indexOf(id) > -1;
    $("#mTitle").textContent = w.title;
    $("#mMeta").textContent = (w.grade ? w.grade + (w.class_name ? w.class_name + "班" : "") + " · " : "") + w.author + " · " + (D.categories[w.category] || "") + (w.created_at ? " · " + fmtDate(w.created_at) : "");
    $("#mart").innerHTML = coverArt(w);
    $("#mBody").innerHTML = w.content.map(function (p) { return p ? "<p>" + esc(p) + "</p>" : ""; }).join("");
    $("#mLikeBtn").className = "mact" + (liked ? " on" : "");
    $("#mLikeBtn").innerHTML = icon("heart", liked) + ' <span id="mLikes">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢";
    $("#mBookmarkBtn").className = "mact" + (bmed ? " on gold" : "");
    $("#mBookmarkBtn").innerHTML = icon("bookmark", bmed) + ' <span id="mBookmarkCount">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏";
    renderComments(id);
    $("#articleModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var m = $("#articleModal");
    if (m) m.classList.remove("open");
    document.body.style.overflow = "";
    curWork = null;
  }

  var replyTarget = null;

  function ckey(c) {
    return c.cloud ? ("C:" + c.id) : ("L:" + (c.time || "") + "|" + (c.content || ""));
  }

  function fmtCloudTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function commentTree(list) {
    list.forEach(function (c) { c._key = ckey(c); });
    var byKey = {};
    list.forEach(function (c) { byKey[c._key] = c; });
    var tops = list.filter(function (c) { return !c.parentKey || !byKey[c.parentKey]; });
    function desc(rootKey) {
      var out = [], queue = [rootKey], guard = 0;
      while (queue.length && guard++ < 200) {
        var k = queue.shift();
        list.forEach(function (c) {
          if (c.parentKey === k && out.indexOf(c) < 0) { out.push(c); queue.push(c._key); }
        });
      }
      return out;
    }
    return { tops: tops, desc: desc, byKey: byKey };
  }

  function commentHtml(c, parentName, u) {
    var replyBtn = u ? '<button type="button" class="cmt-reply-btn" data-reply="' + esc(c._key) + '">回复</button>' : "";
    return '<div class="comment-item">' +
      "<div><strong>" + esc(c.name) + "</strong>" +
      '<span class="cmt-time">' + esc(c.time) + (c.cloud ? " · 云端" : "") + "</span>" + replyBtn + "</div>" +
      (parentName ? '<div class="cmt-content" style="font-size:.8rem;color:var(--ink-3);margin-bottom:2px">回复 @' + esc(parentName) + "</div>" : "") +
      '<div class="cmt-content">' + esc(c.content) + "</div></div>";
  }

  function commentsHtml(list, u) {
    var tree = commentTree(list);
    var html = "<h4>评论 (" + list.length + ")</h4>";
    if (tree.tops.length) {
      html += '<div class="cmt-list">';
      tree.tops.forEach(function (c) {
        html += commentHtml(c, null, u);
        var kids = tree.desc(c._key);
        if (kids.length) {
          html += '<div class="cmt-replies">' + kids.map(function (k) {
            var p = tree.byKey[k.parentKey];
            return commentHtml(k, p ? p.name : null, u);
          }).join("") + "</div>";
        }
      });
      html += "</div>";
    } else {
      html += '<p class="cmt-empty">还没有评论，来发表第一条吧。</p>';
    }
    if (u) {
      html += '<div class="cmt-box"><div class="cmt-target' + (replyTarget ? " on" : "") + '" id="cmtTarget">' +
        (replyTarget ? "正在回复 <b>@" + esc(replyTarget.name) + '</b> <button type="button" id="cmtCancel">×</button>' : "") +
        '</div><div class="cmt-input-row"><input id="cmtInput" placeholder="' + (replyTarget ? "回复 @" + esc(replyTarget.name) + "…" : "写下你的评论…") + '" maxlength="200"><button type="button" class="btn btn-d" id="cmtPostBtn">发表</button></div></div>';
    } else {
      html += '<p class="cmt-login-hint">登录后即可评论 → <a href="' + loginUrl() + '">去登录</a></p>';
    }
    return html;
  }

  function bindCommentUI(id) {
    on("#cmtPostBtn", "click", function () { postComment(id); });
    on("#cmtInput", "keydown", function (e) { if (e.key === "Enter") postComment(id); });
    on("#cmtCancel", "click", function () { replyTarget = null; renderComments(id); });
    $$("#comments-section [data-reply]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-reply");
        var found = null;
        commentsCache.forEach(function (c) { if (ckey(c) === key) found = c; });
        if (!found) return;
        replyTarget = { key: key, name: found.name, cloud: !!found.cloud, id: found.id };
        renderComments(id);
        var inp = $("#cmtInput");
        if (inp) inp.focus();
      });
    });
  }

  var commentsCache = [];

  function renderComments(id) {
    var section = $("#comments-section");
    if (!section) return;
    var u = curUser();
    var local = commentsOf(id).map(function (c) {
      return { name: c.name, content: c.content, time: c.time, parentKey: c.parentKey || null, cloud: false };
    });
    commentsCache = local.slice();
    section.innerHTML = commentsHtml(local, u);
    bindCommentUI(id);

    if (window.XB_CLOUD && XB_CLOUD.isReady()) {
      XB_CLOUD.fetchComments(id).then(function (rows) {
        var cloudList = (rows || []).map(function (r) {
          return {
            id: r.id,
            name: r.author_name || "社员",
            content: r.content || "",
            time: fmtCloudTime(r.created_at),
            cloud: true,
            parentKey: r.parent_id ? ("C:" + r.parent_id) : null
          };
        });
        
        var seen = {};
        cloudList.forEach(function (c) { seen[c.name + "|" + c.content] = true; });
        var localOnly = local.filter(function (c) { return !seen[c.name + "|" + c.content]; });
        commentsCache = cloudList.concat(localOnly);
        section.innerHTML = commentsHtml(commentsCache, curUser());
        bindCommentUI(id);
      }).catch(function () {});
    }
  }

  function postComment(workId) {
    var inp = $("#cmtInput");
    if (!inp || !inp.value.trim()) { toast("请先输入评论内容", "err"); return; }
    var u = curUser();
    if (!u) { toast("请先登录", "err"); return; }
    var wid = workId || (curWork ? curWork.id : null);
    if (!wid) { toast("评论失败：未选择作品", "err"); return; }
    var text = inp.value.trim();
    var target = replyTarget;

    if (window.XB_CLOUD && XB_CLOUD.isReady() && u.cloud) {
      XB_CLOUD.markInteraction(wid, "comment", true, {
        content: text,
        author_name: u.name,
        parent_id: target && target.cloud ? target.id : null
      }).then(function (r) {
        if (r && r.error) { toast("评论失败：" + ((r.error && r.error.message) || "云端不可用"), "err"); return; }
        replyTarget = null;
        toast(target ? "回复已发表" : "评论已发表");
        renderComments(wid);
      }).catch(function () { toast("评论失败：网络异常", "err"); });
      return;
    }

    var all = LS.get("comments", {});
    var key = String(wid);
    if (!all[key]) all[key] = [];
    all[key].unshift({
      name: u.name,
      content: text,
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      parentKey: target ? target.key : null
    });
    LS.set("comments", all);
    replyTarget = null;
    renderComments(wid);
    toast("评论已发表（本机保存，登录云端账号可同步）");
  }

  function showProfile() {
    var u = curUser();
    if (!u) return;
    var d = $("#userDropdown");
    if (d) d.classList.remove("show");
    $("#mTitle").textContent = "我的主页";
    $("#mMeta").textContent = "演示账号 · 数据保存在本机浏览器";
    $("#mart").innerHTML = "";
    var l = likes().length, b = bookmarks().length;
    var cAll = LS.get("comments", {});
    var c = 0;
    Object.keys(cAll).forEach(function (k) { c += cAll[k].length; });
    $("#mBody").innerHTML =
      '<div class="pf-head">' +
      '<div class="pf-av">' + esc(u.name.charAt(0)) + "</div>" +
      "<h3>" + esc(u.name) + "</h3>" +
      '<p class="pf-mail">' + esc(u.email || "") + "</p></div>" +
      '<div class="pf-stats">' +
      "<div><strong>" + l + "</strong><br><small>点赞</small></div>" +
      "<div><strong>" + b + "</strong><br><small>收藏</small></div>" +
      "<div><strong>" + c + "</strong><br><small>评论</small></div></div>" +
      '<p class="pf-note">基础版本为本地演示：点赞、收藏、评论与投稿记录均保存在本机 localStorage，清除浏览器数据后重置。</p>';
    var cs = $("#articleModal #comments-section");
    if (cs) cs.innerHTML = "";
    var lb = $("#mLikeBtn");
    if (lb) { lb.className = "mact"; lb.innerHTML = ""; }
    var bb = $("#mBookmarkBtn");
    if (bb) { bb.className = "mact"; bb.innerHTML = ""; }
    $("#articleModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function bindSearch() {
    var inp = $("#searchInput"), res = $("#searchR");
    if (!inp || !res) return;
    var timer;
    inp.addEventListener("input", function () {
      var q = this.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { res.classList.remove("show"); res.innerHTML = ""; return; }
      res.innerHTML = '<div class="loading">搜索中...</div>';
      res.classList.add("show");
      timer = setTimeout(function () {
        var ql = q.toLowerCase();
        var list = DATA.works.filter(function (w) {
          var hay = (w.title + " " + w.author + " " + w.excerpt + " " + w.grade + " " + w.class_name + " " + (D.categories[w.category] || "")).toLowerCase();
          return hay.indexOf(ql) > -1;
        }).slice(0, 8);
        if (!list.length) { res.innerHTML = '<div class="hint">没有找到匹配的作品</div>'; return; }
        res.innerHTML = list.map(function (w) {
          return '<div class="item" data-id="' + w.id + '"><div class="tt">' + hl(w.title, q) + '</div><div class="mm">' + hl((w.grade || "") + (w.class_name ? w.class_name + "班" : "") + " · " + w.author, q) + "</div></div>";
        }).join("");
      }, 220);
    });
    res.addEventListener("click", function (e) {
      var item = e.target.closest(".item");
      if (!item) return;
      openWork(parseInt(item.dataset.id, 10));
      res.classList.remove("show");
      inp.value = "";
    });
    document.addEventListener("click", function (e) {
      if (!inp.contains(e.target) && !res.contains(e.target)) res.classList.remove("show");
    });
  }

  function renderEvents() {
    var box = $("#eventsList");
    if (!box) return;
    box.innerHTML = (D.site.eventsTruth || []).map(function (e) {
      return '<div class="past-item"><div class="past-date">' + esc(e.year) + "</div>" +
        "<div><h3>" + esc(e.title) + "</h3><p>" + esc(e.desc || "") +
        (e.url ? ' <a href="' + e.url + '" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap">阅读原文 →</a>' : "") +
        "</p></div></div>";
    }).join("");
    observeReveals();
  }

  function tickCountdown() {
    var now = Date.now();
    $$(".cdw").forEach(function (el) {
      var df = parseInt(el.dataset.td, 10) - now;
      var vals = el.querySelectorAll(".val");
      if (df <= 0) { vals.forEach(function (v) { v.textContent = "00"; }); return; }
      var d = Math.floor(df / 864e5);
      var h = Math.floor((df % 864e5) / 36e5);
      var m = Math.floor((df % 36e5) / 6e4);
      var s = Math.floor((df % 6e4) / 1e3);
      [d, h, m, s].forEach(function (v, i) { if (vals[i]) vals[i].textContent = String(v).padStart(2, "0"); });
    });
  }

  function renderMembers() {
    var box = $("#membersGrid");
    if (!box) return;
    box.innerHTML = D.members.map(function (m, i) {
      return '<div class="mc rv d' + (i + 1) + '">' +
        '<div class="mav" style="background:linear-gradient(135deg,' + m.hue + "," + m.hue + "cc)\">" + esc(m.name.charAt(0)) + "</div>" +
        "<h3>" + esc(m.name) + "</h3>" +
        '<div class="mrole">' + esc(m.role) + "</div>" +
        (m.quote ? '<p class="mq">“' + esc(m.quote) + '”</p>' : "") +
        '<div class="mbio">' + esc(m.bio) + "</div></div>";
    }).join("");
    observeReveals();
  }

  var PORTAL_ICON = { book: "book", pen: "pen", feather: "feather", globe: "globe", pencil: "pencil" };

  function renderPortals() {
    var box = $("#portalGrid");
    if (!box) return;
    box.innerHTML = D.portals.map(function (p, i) {
      return '<a class="pc rv d' + ((i % 4) + 1) + '" href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
        '<div class="pico">' + icon(PORTAL_ICON[p.icon] || "book") + "</div>" +
        "<h3>" + esc(p.name) + "</h3><p>" + esc(p.desc) + '</p><span class="lt">访问网站 →</span></a>';
    }).join("");
    observeReveals();
  }

  function renderTexts() {
    var sub = $("#heroSub");
    if (sub) sub.textContent = D.site.intro;
    var at = $("#aboutText");
    if (at) {
      at.innerHTML = D.site.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        '<a href="#contact" class="btn btn-d" style="margin-top:10px">了解更多</a>';
    }
    var c = D.contact;
    var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
    set("#cAddress", c.address);
    set("#cEmail", c.email);
    set("#cPhone", c.phone);
    set("#cHours", c.hours);
    set("#copyLine", D.site.copyright + " | 基础版本 v0.2 · 本地演示");
  }

  function gateAgree(formSel, chkSel) {
    var f = $(formSel), c = $(chkSel);
    if (!f || !c) return;
    f.addEventListener("submit", function (e) {
      if (!c.checked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toast("请先阅读并勾选「入社须知」", "err");
      }
    }, true);
  }

  function bindForm(formSel, okSel, key, okMsg, btnLabel, toCloud) {
    var form = $(formSel);
    if (!form) return;
    var btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      $$("input, textarea, select", form).forEach(function (el) { if (el.id) data[el.id] = el.value.trim(); });
      if (btn) { btn.disabled = true; btn.textContent = "提交中..."; }
      setTimeout(function () {
        var arr = LS.get(key, []);
        data._time = new Date().toLocaleString("zh-CN", { hour12: false });
        arr.unshift(data);
        LS.set(key, arr);
        if (window.XB_CLOUD && XB_CLOUD.isReady() && key === "applications") {
          var slug2 = "recruit-" + Date.now();
          var name2 = data.mName || data.sName || "匿名申请";
          var title2 = name2 + (data.mGrade ? " · " + data.mGrade : "");
          XB_CLOUD.saveContent("recruit", slug2, title2, data, 0).then(function (r) {
            if (r && r.error) {} else { toast("已同步到编辑部后台"); }
          });
        }
        var ok = $(okSel);
        if (ok) {
          ok.style.display = "block";
          setTimeout(function () { ok.style.display = "none"; }, 4000);
        }
        form.reset();
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
        toast(okMsg);
        
        if (toCloud && window.XB_CLOUD && XB_CLOUD.isReady()) {
          var rec = toCloudRecord(key, data);
          XB_CLOUD.submit(rec).then(function (r) {
            if (r && r.error) toast("云端提交失败，记录已存在本机", "err");
            else toast("已提交到社团云端作品库");
          }).catch(function () { toast("云端提交失败，记录已存在本机", "err"); });
        }
      }, 350);
    });
  }

  function toCloudRecord(key, d) {
    if (key === "submissions") {
      return {
        title: d.sTitle || "无题",
        author: d.sName || "匿名社员",
        grade: d.sGrade || "",
        category: d.sType || "prose",
        content: d.sContent || "",
        contact: [d.sEmail || "", d.sPhone || ""].filter(Boolean).join(" / ")
      };
    }
    return {
      title: "加入申请 · " + (d.mName || "社员"),
      author: d.mName || "社员",
      grade: d.mGrade || "",
      category: "application",
      content: [d.mInterest ? "兴趣：" + d.mInterest : "", d.mMsg || ""].filter(Boolean).join("\n"),
      contact: [d.mEmail || "", d.mPhone || ""].filter(Boolean).join(" / ")
    };
  }

  function openQr(type) {
    var isWx = type === "wechat";
    var seed = isWx ? 7 : 13;
    var cells = "";
    for (var r = 0; r < 7; r++) {
      for (var c = 0; c < 7; c++) {
        var corner = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
        var on = corner ? true : (r === 3 && c === 3) || (r * 3 + c * 5 + seed) % 3 === 0;
        cells += '<i class="' + (on ? "b" : "") + '"></i>';
      }
    }
    $("#qrContent").innerHTML =
      '<h3 class="qr-title">' + (isWx ? "关注微信公众号" : "加入QQ交流群") + "</h3>" +
      '<div class="qr-pattern">' + cells + "</div>" +
      '<p class="qr-desc">' + esc(isWx ? D.contact.wechat : D.contact.qq) + "</p>";
    $("#qrModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function renderUserUI() {
    var u = curUser();
    var d = $("#userDropdown");
    var b = $("#userBtn");
    if (!d || !b) return;
    if (u) {
      b.textContent = u.name.charAt(0);
      b.title = u.name;
      d.innerHTML =
        '<a href="#" data-act="profile">' + icon("user") + " 我的主页</a>" +
        '<a href="#" data-act="logout">' + icon("arrow-right") + " 退出登录</a>";
    } else {
      b.innerHTML = icon("user");
      b.title = "登录 / 注册";
      d.innerHTML =
        '<a href="' + loginUrl() + '">' + icon("user") + " 登录</a>" +
        '<a href="' + loginUrl() + '">' + icon("feather") + " 注册</a>";
    }
    $$("a[data-act]", d).forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var act = a.dataset.act;
        if (act === "profile") showProfile();
        if (act === "logout") { LS.del("user"); renderUserUI(); toast("已退出登录"); }
      });
    });
  }

  function makePoster(w) {
    var c = document.createElement("canvas");
    c.width = 800; c.height = 1060;
    var x = c.getContext("2d");
    x.fillStyle = "#f7f1e6"; x.fillRect(0, 0, 800, 1060);
    x.fillStyle = "#8b3a3a"; x.fillRect(0, 0, 800, 10);
    x.fillStyle = "#8b3a3a";
    x.beginPath(); x.arc(400, 150, 62, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f7f1e6"; x.font = "bold 44px Georgia, serif"; x.textAlign = "center";
    x.fillText("新笔", 400, 166);
    x.fillStyle = "#8b3a3a"; x.font = "bold 40px Georgia, 'STKaiti', serif";
    var title = w.title || "无题";
    var line = "", lines = [];
    for (var i = 0; i < title.length; i++) {
      line += title[i];
      if (line.length >= 14) { lines.push(line); line = ""; }
    }
    if (line) lines.push(line);
    var ty = 300;
    lines.slice(0, 3).forEach(function (l) { x.fillText(l, 400, ty); ty += 58; });
    x.fillStyle = "#6b5b4a"; x.font = "24px 'STKaiti', serif";
    x.fillText((w.author || "") + (w.grade ? " · " + w.grade + (w.class_name || "") + "班" : ""), 400, ty + 24);
    x.strokeStyle = "#c9b68a"; x.beginPath(); x.moveTo(180, ty + 70); x.lineTo(620, ty + 70); x.stroke();
    x.fillStyle = "#4a4034"; x.font = "22px 'STKaiti', serif";
    var ex = (w.excerpt || "用文字书写灵魂。").slice(0, 90);
    var eline = "", ey = ty + 120;
    for (var j = 0; j < ex.length; j++) {
      eline += ex[j];
      if (eline.length >= 22) { x.fillText(eline, 400, ey); ey += 38; eline = ""; }
    }
    if (eline) x.fillText(eline, 400, ey);
    x.fillStyle = "#8b3a3a"; x.font = "bold 30px Georgia, serif";
    x.fillText("新笔文学社", 400, 950);
    x.fillStyle = "#9a8a76"; x.font = "18px sans-serif";
    x.fillText("lueuru.github.io/xinbi-literature", 400, 990);
    var a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "xinbi-poster.png"; a.click();
    toast("海报已生成，已开始下载");
  }

  function shareWork(w) {
    var url = location.origin + location.pathname + "?id=" + w.id;
    if (navigator.share) {
      navigator.share({ title: w.title + " · 新笔文学社", text: w.excerpt || "", url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("链接已复制，去粘贴给同学吧"); }, function () { toast("复制失败，请手动复制地址栏链接", "err"); });
    } else {
      toast("请手动复制地址栏链接", "err");
    }
  }

  function loginUrl() {
    return "login.html?next=" + encodeURIComponent(location.pathname + location.search);
  }

  function injectWorkLD(w) {
    var old = document.getElementById("ld-work");
    if (old) old.remove();
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "ld-work";
    var ld = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "name": w.title,
      "author": { "@type": "Person", "name": w.author || "佚名" },
      "genre": D.categories[w.category] || "",
      "publisher": { "@type": "Organization", "name": "新笔文学社" },
      "inLanguage": "zh-CN",
      "abstract": w.excerpt || ""
    };
    if (w.created_at) ld.datePublished = w.created_at;
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  function renderWorkPage() {
    var rawId = new URLSearchParams(location.search).get("id") || "";
    var id = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;
    var wrap = $("#wkWrap");
    if (!wrap) return;

    function notFound() {
      var ld = $("#wkLoading");
      if (ld) ld.style.display = "none";
      wrap.innerHTML = '<p class="empty">未找到该作品，可能链接有误。返回 <a href="index.html#works">作品展示</a> 看看。</p>';
      wrap.style.display = "block";
    }

    function paint(w) {
      curWork = w;
      document.title = w.title + " · 新笔文学社";
      var liked = likes().indexOf(w.id) > -1;
      var bmed = bookmarks().indexOf(w.id) > -1;
      var idx = DATA.works.indexOf(w);
      var prev = idx > 0 ? DATA.works[idx - 1] : null;
      var next = idx > -1 && idx < DATA.works.length - 1 ? DATA.works[idx + 1] : null;

      $("#wkTitle").textContent = w.title;
      var chars = (w.content || []).join("").length;
      $("#wkMeta").textContent = (w.grade ? w.grade + (w.class_name ? w.class_name + "班" : "") + " · " : "") + w.author + " · " + (D.categories[w.category] || "") + (w.created_at ? " · " + fmtDate(w.created_at) : "") + " · " + chars + " 字 · 约 " + Math.max(1, Math.round(chars / 400)) + " 分钟";
      $("#wkArt").innerHTML = coverArt(w);
      $("#wkBody").innerHTML = w.content.map(function (p) { return p ? "<p>" + esc(p) + "</p>" : "" }).join("");
      var qs = D.site.quotes || [];
      if (qs.length) {
        var hsh = 0, ts = w.title || "";
        for (var qi = 0; qi < ts.length; qi++) hsh = (hsh * 31 + ts.charCodeAt(qi)) % 100000;
        var q = qs[hsh % qs.length];
        var old = $("#wkQuoteCard");
        if (old) old.parentNode.removeChild(old);
        var qc = document.createElement("aside");
        qc.id = "wkQuoteCard";
        qc.className = "quote-card";
        qc.innerHTML = "<span class='quote-mark'>「</span><p>" + esc(q.text) + "</p><cite>—— " + esc(q.from) + "</cite>";
        $("#wkBody").parentNode.insertBefore(qc, $("#wkBody").nextSibling);
      }
      var srcBox = $("#wkSource");
      if (srcBox) {
        if (w.verified) {
          srcBox.innerHTML =
            (w.appendix ? '<p class="wk-appendix">' + esc(w.appendix) + "</p>" : "") +
            (w.review ? '<div class="wk-review"><b>指导教师点评</b><p>' + esc(w.review) + "</p><span>—— " + esc(w.judge || "") + (w.judgeRole ? "，" + esc(w.judgeRole) : "") + "</span></div>" : "") +
            '<p class="wk-src">来源：' + esc(w.source || "学校公开报道") + (w.tag ? " · " + esc(w.tag) : "") + "</p>";
        } else {
          srcBox.innerHTML = '<p class="wk-src wk-demo">示例内容：本文为演示版式所用，非真实投稿，正式上线前请由编辑部替换。</p>';
        }
      }
      $("#wkActions").innerHTML =
        '<button type="button" class="like-btn' + (liked ? " liked" : "") + '" data-id="' + w.id + '">' + icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢</button>" +
        '<button type="button" class="bookmark-btn' + (bmed ? " liked" : "") + '" data-id="' + w.id + '">' + icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏</button>" +
        '<button type="button" class="share-btn" id="wkShareBtn">' + icon("share") + " 分享</button>" +
        '<span class="fs-ctl" role="group" aria-label="字号"><button type="button" class="fs-btn" data-fs="s">A−</button><button type="button" class="fs-btn" data-fs="m">A</button><button type="button" class="fs-btn" data-fs="l">A+</button></span>';
      on("#wkShareBtn", "click", function () { shareWork(w); });
      on("#posterBtn", "click", function () { makePoster(w); });
      var ttsBtn = $("#ttsBtn");
      if (ttsBtn) ttsBtn.addEventListener("click", function () {
        var syn = window.speechSynthesis;
        if (!syn) { toast("当前浏览器不支持朗读", "err"); return; }
        if (syn.speaking) { syn.cancel(); ttsBtn.textContent = "🔊 朗读"; return; }
        var u = new SpeechSynthesisUtterance((w.content || []).join("。"));
        u.lang = "zh-CN"; u.rate = 0.95;
        u.onend = function () { ttsBtn.textContent = "🔊 朗读"; };
        syn.speak(u);
        ttsBtn.textContent = "⏹ 停止朗读";
      });
      var body0 = $("#wkBody");
      var fs = localStorage.getItem("xb_wfs") || "m";
      function applyFs(v) {
        body0.classList.remove("wk-fs-s", "wk-fs-l");
        if (v === "s") body0.classList.add("wk-fs-s");
        if (v === "l") body0.classList.add("wk-fs-l");
        localStorage.setItem("xb_wfs", v);
        $$(".fs-btn").forEach(function (b) { b.classList.toggle("on", b.dataset.fs === v); });
      }
      applyFs(fs);
      $$(".fs-btn").forEach(function (b) {
        b.addEventListener("click", function () { applyFs(b.dataset.fs); });
      });
      injectWorkLD(w);
      renderComments(w.id);

      var navHtml = "";
      navHtml += prev ? '<a class="btn btn-l sm" href="work.html?id=' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>";
      navHtml += next ? '<a class="btn btn-l sm" href="work.html?id=' + next.id + '">' + esc(next.title) + " →</a>" : "<span></span>";
      $("#wkNav").innerHTML = navHtml;

      var rel = DATA.works.filter(function (x) { return x.id !== w.id && x.category === w.category; });
      if (rel.length < 2) {
        DATA.works.forEach(function (x) {
          if (x.id !== w.id && rel.indexOf(x) < 0 && rel.length < 3) rel.push(x);
        });
      }
      var relBox = $("#wkRelated");
      if (relBox) {
        relBox.innerHTML = rel.map(function (x) {
          return '<a class="spine" href="work.html?id=' + x.id + '" title="《' + esc(x.title) + '》"><div class="cover-wrap">' + coverArt(x) + "</div></a>";
        }).join("");
      }
      wrap.style.display = "block";
      var ld = $("#wkLoading");
      if (ld) ld.style.display = "none";
      observeReveals();
    }

    var w = workById(id);
    if (w) { paint(w); return; }
    if (DATA.remoteTried || !CFG.enableRemote) { notFound(); return; }
    loadRemoteWorks().then(function () {
      var w2 = workById(id);
      if (w2) paint(w2); else notFound();
    });
  }

  function renderJournal() {
    var j = D.journal;
    var intro = $("#journalIntro");
    if (intro) intro.textContent = j.intro;
    var box = $("#journalList");
    if (!box) return;
    box.innerHTML = j.issues.map(function (is, i) {
      return '<div class="jissue rv d' + ((i % 4) + 1) + '">' +
        '<div class="jno"><span class="jno-n">第' + is.no + '期</span><span class="jno-d">' + esc(is.date) + " · " + esc(is.term) + "之卷</span></div>" +
        '<div class="jbody"><h3>' + esc(is.theme) + "</h3>" +
        '<ul class="jpieces">' + is.pieces.map(function (p) {
          return "<li><span class=\"jp-t\">" + esc(p.title) + '</span><span class="jp-m">' + esc(p.author) + " · " + esc(p.type) + '</span><span class="jp-p">' + esc(p.page) + "</span></li>";
        }).join("") + "</ul>" +
        '<a class="btn btn-l sm jdl" href="issue.html?no=' + is.no + '">在线阅读本期 →</a>' +
        "</div></div>";
    }).join("");
    renderIssueWall();
    $$(".jdl").forEach(function (b) {
      b.addEventListener("click", function (e) {
        if (b.tagName !== "A") { e.preventDefault(); toast("演示版本：社刊 PDF 尚未接入", "err"); }
      });
    });
    observeReveals();
  }

  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  function bindChrome() {
    var header = $("#header"), pbar = $("#pbar"), btop = $("#backTop");
    var links = $$(".nav-links a, .mnav a");
    var secs = $$("section[id]");

    function onScroll() {
      var y = window.scrollY || 0;
      if (header) header.classList.toggle("scrolled", y > 60);
      if (pbar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        pbar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
      }
      if (btop) btop.classList.toggle("show", y > 500);
      var cur = "";
      secs.forEach(function (s) {
        if (s.getBoundingClientRect().top <= 150) cur = s.id;
      });
      links.forEach(function (a) {
        var on2 = a.getAttribute("href") === "#" + cur;
        a.classList.toggle("active", on2);
        if (on2) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var mb = $("#menuBtn"), mn = $("#mobileNav");
    if (mb && mn) {
      var open = false;
      mb.addEventListener("click", function () {
        open = !open;
        mb.classList.toggle("active", open);
        mn.classList.toggle("open", open);
        document.body.style.overflow = open ? "hidden" : "";
      });
      $$("a", mn).forEach(function (a) {
        a.addEventListener("click", function () {
          open = false;
          mb.classList.remove("active");
          mn.classList.remove("open");
          document.body.style.overflow = "";
        });
      });
    }

    var ub = $("#userBtn"), ud = $("#userDropdown");
    if (ub && ud) {
      ub.addEventListener("click", function (e) { e.stopPropagation(); ud.classList.toggle("show"); });
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#userBtn") && !e.target.closest("#userDropdown")) ud.classList.remove("show");
      });
    }

    on("#backTop", "click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

    var darkSaved = LS.get("dark", null);
    var darkOn = darkSaved === null
      ? !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      : darkSaved === "1";
    var dk = $("#darkToggle");
    function applyDark() {
      document.body.classList.toggle("dark", darkOn);
      if (dk) dk.innerHTML = icon(darkOn ? "sun" : "moon");
      LS.set("dark", darkOn ? "1" : "0");
    }
    on("#darkToggle", "click", function () { darkOn = !darkOn; applyDark(); });
    applyDark();
  }

  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("on"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
  }
  function observeReveals() {
    $$(".rv:not(.on),.rl:not(.on),.rr:not(.on),.rs:not(.on)").forEach(function (el) {
      if (io) io.observe(el);
      else {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add("on");
      }
    });
  }

  function bindHero() {
    var hp = $("#herop");
    if (hp) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        for (var i = 0; i < 30; i++) {
          var p = document.createElement("div");
          var s = Math.random() * 4 + 2;
          p.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + Math.random() * 100 + "%;animation-delay:" + Math.random() * 10 + "s;animation-duration:" + (Math.random() * 8 + 6) + "s";
          hp.appendChild(p);
        }
      }
    }
    var el = $("#heroTitle");
    if (el && !el.dataset.done) {
      el.dataset.done = "1";
      var t = el.textContent;
      el.textContent = "";
      for (var i = 0; i < t.length; i++) {
        var sp = document.createElement("span");
        sp.className = "ch";
        sp.textContent = t[i];
        sp.style.animationDelay = (0.2 + i * 0.06) + "s";
        el.appendChild(sp);
      }
    }
  }

  function bindModals() {
    on("#modalClose", "click", closeModal);
    var am = $("#articleModal");
    if (am) am.addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    on("#qrClose", "click", function () {
      var q = $("#qrModal");
      if (q) q.classList.remove("open");
      document.body.style.overflow = "";
    });
    var qm = $("#qrModal");
    if (qm) qm.addEventListener("click", function (e) {
      if (e.target === this) { this.classList.remove("open"); document.body.style.overflow = ""; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal();
        var q = $("#qrModal");
        if (q) q.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
    on("#mLikeBtn", "click", function () { if (curWork) toggleLike(curWork.id); });
    on("#mBookmarkBtn", "click", function () { if (curWork) toggleBookmark(curWork.id); });
    on("#mCommentBtn", "click", function () {
      var inp = $("#cmtInput");
      if (inp) { inp.focus(); inp.scrollIntoView({ behavior: "smooth", block: "center" }); }
      else toast("请先登录后再评论", "err");
    });
    $$(".qr-link").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openQr(a.dataset.type); });
    });
  }

  function bindWorkActions() {
    document.addEventListener("click", function (e) {
      var lb = e.target.closest(".like-btn");
      if (lb && lb.dataset.id) { toggleLike(parseInt(lb.dataset.id, 10)); return; }
      var bb = e.target.closest(".bookmark-btn");
      if (bb && bb.dataset.id) { toggleBookmark(parseInt(bb.dataset.id, 10)); }
    });
  }

  function bindWorksEvents() {
    var grid = $("#worksGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var card = e.target.closest(".wc");
        if (card && !e.target.closest(".like-btn") && !e.target.closest(".bookmark-btn")) {
          openWork(parseInt(card.dataset.id, 10));
        }
      });
    }
    $$("#filtersB button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#filtersB button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        wState.filter = b.dataset.f;
        renderWorks(true);
      });
    });
  }

  function applyOverlay() {
    var ov = LS.get("overlay", null);
    if (!ov) return;
    if (ov.useLocal) {
      var del = ov.deletedWorks || [];
      var list = D.works.filter(function (w) { return del.indexOf(w.id) < 0; }).map(function (w) {
        return (ov.works && ov.works[w.id]) || w;
      });
      if (ov.works) {
        Object.keys(ov.works).forEach(function (k) {
          if (ov.works[k]._new) list.push(ov.works[k]);
        });
      }
      DATA.works = list;
      DATA.source = "local-managed";
      DATA.remoteTried = true;
    }
    if (ov.events) D.events = ov.events;
    if (ov.members) D.members = ov.members;
    if (ov.journal) D.journal.issues = ov.journal;
  }

  function renderIndexSections() {
    var st = $("#statsStrip");
    if (st) st.innerHTML = (D.site.stats || []).map(function (s) {
      return "<div class='stat'><b>" + esc(s.num) + "</b><span>" + esc(s.label) + "</span></div>";
    }).join("");

    var nb = $("#noticeList");
    if (nb) nb.innerHTML = (D.site.notices || []).map(function (n) {
      return "<li><time>" + esc(n.date) + "</time><span>" + esc(n.text) + "</span></li>";
    }).join("");

    var pre = $("#prefaceBox");
    if (pre && D.site.preface) {
      pre.innerHTML = "<span class='preface-tag'>卷首语 · PREFACE</span><h2>" + esc(D.site.preface.title) + "</h2>" +
        D.site.preface.paragraphs.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        "<div class='preface-sign'>—— " + esc(D.site.preface.author) + "</div>";
    }

    var cg = $("#columnGrid");
    if (cg) cg.innerHTML = (D.site.columns || []).map(function (c) {
      return "<div class='column-item'><h3>" + esc(c.name) + "</h3><p>" + esc(c.desc) + "</p></div>";
    }).join("");

    var tl = $("#timelineBox");
    if (tl) tl.innerHTML = (D.site.timeline || []).map(function (t) {
      return "<div class='tl-item'><div class='tl-year'>" + esc(t.year) + "</div><div class='tl-title'>" + esc(t.title) + "</div><div class='tl-desc'>" + esc(t.desc) + "</div></div>";
    }).join("");

    var hg = $("#honorGrid");
    if (hg) hg.innerHTML = (D.site.honors || []).map(function (h) {
      return "<div class='honor-item'><span class='honor-year'>" + esc(h.year) + "</span><div><div class='honor-title'>" + esc(h.title) + "</div><div class='honor-org'>" + esc(h.org) + "</div></div></div>";
    }).join("");

    var qs = $("#quoteStrip");
    if (qs) qs.innerHTML = (D.site.quotes || []).map(function (q) {
      return "<div class='quote-card'><p>" + esc(q.text) + "</p><cite>—— " + esc(q.from) + "</cite></div>";
    }).join("");

    renderDaily();
    observeReveals();
  }

  function initWorksPage() {
    var grid = $("#wlibGrid");
    if (!grid) return;
    var st = { cat: "all", sort: "new", q: "", judge: "", shown: 12 };

    function list() {
      var arr = DATA.works.filter(function (w) { return w.verified || demoMode(); });
      if (st.cat !== "all") arr = arr.filter(function (w) { return w.category === st.cat; });
      if (st.judge) arr = arr.filter(function (w) { return (w.judge || "") === st.judge; });
      if (st.q) {
        var q = st.q.toLowerCase();
        arr = arr.filter(function (w) {
          return ((w.title || "") + (w.author || "") + (w.excerpt || "") + (w.grade || "")).toLowerCase().indexOf(q) > -1;
        });
      }
      if (st.sort === "hot") arr.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
      else if (st.sort === "rating") arr.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      else arr.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
      return arr;
    }

    function paint() {
      var arr = list();
      grid.innerHTML = arr.slice(0, st.shown).map(workCard).join("") || "<p class='empty-grid'>没有找到匹配的作品，换个关键词试试。</p>";
      var more = $("#wlibMore");
      if (more) {
        if (arr.length > st.shown) {
          more.innerHTML = "<button type='button' class='btn btn-l' id='wlibMoreBtn'>加载更多（还有 " + (arr.length - st.shown) + " 篇）</button>";
          on("#wlibMoreBtn", "click", function () { st.shown += 12; paint(); });
        } else {
          more.innerHTML = arr.length ? "<p class='works-all'>共 " + arr.length + " 篇作品</p>" : "";
        }
      }
      var c = $("#wlibCount");
      if (c) c.textContent = "共 " + arr.length + " 篇";
      observeReveals();
    }

    $$("#wlibFilters button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#wlibFilters button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        st.cat = b.dataset.cat;
        st.shown = 12;
        paint();
      });
    });
    on("#wlibSort", "change", function () { st.sort = this.value; paint(); });
    var jsel = $("#wlibJudge");
    if (jsel && !jsel.options.length) {
      var judges = [];
      DATA.works.forEach(function (w) { if (w.verified && w.judge && judges.indexOf(w.judge) < 0) judges.push(w.judge); });
      jsel.innerHTML = '<option value="">全部指导教师</option>' + judges.map(function (j) { return '<option value="' + esc(j) + '">' + esc(j) + "</option>"; }).join("");
    }
    on("#wlibJudge", "change", function () { st.judge = this.value; st.shown = 12; paint(); });
    on("#wlibSearch", "input", function () {
      var v = this.value.trim();
      clearTimeout(st._t);
      st._t = setTimeout(function () { st.q = v; st.shown = 12; paint(); }, 200);
    });

    bindDemoToggle();
    if (DATA.works.length) paint();
    loadCloudData().then(function (cloud) {
      if (cloud) toast("已同步云端作品库");
      paint();
    });
  }

  function initGuidePage() {
    var g = D.site.guide;
    if (!g) return;
    var intro = $("#guideIntro");
    if (intro) intro.textContent = g.intro;
    var rules = $("#guideRules");
    if (rules) rules.innerHTML = g.rules.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    var flow = $("#guideFlow");
    if (flow) flow.innerHTML = g.flow.map(function (f, i) {
      return "<div class='guide-step'><b>" + (i + 1) + "</b><div><h3>" + esc(f.step) + "</h3><p>" + esc(f.desc) + "</p></div></div>";
    }).join("");
    var rw = $("#guideRewards");
    if (rw) rw.textContent = g.rewards;
    var faq = $("#guideFaq");
    if (faq) {
      faq.innerHTML = g.faq.map(function (f, i) {
        return "<div class='faq-item' data-i='" + i + "'><button type='button' class='faq-q'>" + esc(f.q) + "</button><div class='faq-a'>" + esc(f.a) + "</div></div>";
      }).join("");
      $$("#guideFaq .faq-q").forEach(function (b) {
        b.addEventListener("click", function () {
          b.parentElement.classList.toggle("open");
        });
      });
    }
    var cols = $("#guideColumns");
    if (cols) cols.innerHTML = (D.site.columns || []).map(function (c) {
      return "<div class='column-item'><h3>" + esc(c.name) + "</h3><p>" + esc(c.desc) + "</p></div>";
    }).join("");
  }

  function catDecade(c) {
    var m = ((c.where || "") + " " + (c.title || "") + " " + (c.year || "")).match(/(19[6-9]\d|20[0-2]\d)/);
    return m ? m[1].slice(0, 3) + "0 年代" : "";
  }
  var catDecadeFilter = "全部";
  function paintCatalog() {
    var cat = $("#catalogList");
    if (!cat) return;
    var list = (D.site.catalog || []).filter(function (c) {
      var okKind = !catFilter || catFilter === "全部" || c.kind === catFilter;
      var dec = catDecade(c);
      var okDec = !catDecadeFilter || catDecadeFilter === "全部" ||
        (catDecadeFilter === "年代待补" ? !dec : dec === catDecadeFilter);
      return okKind && okDec;
    });
    var empty = '<p class="ad-empty">该筛选下暂无条目。</p>';
    cat.innerHTML = list.length ? list.map(function (c) {
      var dec = catDecade(c);
      return "<div class='toc-row'><div><span class='t'>" + esc(c.title) + "</span>" +
        "<span class='toc-type'>" + esc(c.kind) + "</span>" +
        (dec ? "<span class='toc-type'>" + esc(dec) + "</span>" : "") + "</div>" +
        "<div class='a'>" + esc(c.author) + "</div>" +
        "<div class='p' style='font-size:.72rem'>" + esc(c.where) + "</div></div>";
    }).join("") : empty;
  }
  var catFilter = "全部";
  function initAboutPage() {
    var rerender = function () { renderPeople(); renderBigTimeline(); var p2 = initAboutPage; };
    if (window.XB_CLOUD && XB_CLOUD.isReady()) {
      loadCloudData().then(function () { rerender(); });
    }
    var lead = $("#aboutLead");
    if (lead) lead.textContent = D.site.intro;
    var cat = $("#catalogList");
    if (cat) {
      var kinds = [];
      (D.site.catalog || []).forEach(function (c) { if (kinds.indexOf(c.kind) < 0 && c.kind) kinds.push(c.kind); });
      var chips = $("#catChips");
      if (chips) {
        var mk = ["全部"].concat(kinds);
        chips.innerHTML = mk.map(function (k) {
          return '<a class="tag-chip' + (k === catFilter ? " on" : "") + '" href="#">' + esc(k) + "<em>" +
            (k === "全部" ? (D.site.catalog || []).length : (D.site.catalog || []).filter(function (c) { return c.kind === k; }).length) + "</em></a>";
        }).join("");
        $$("#catChips .tag-chip").forEach(function (a) {
          a.addEventListener("click", function (e) {
            e.preventDefault();
            catFilter = a.textContent.replace(/[0-9]/g, "").trim();
            paintCatalog();
            $$("#catChips .tag-chip").forEach(function (x) { x.classList.toggle("on", x === a); });
          });
        });
      }
      var dchips = $("#decadeChips");
      if (dchips) {
        var decs = [];
        (D.site.catalog || []).forEach(function (c) {
          var d2 = catDecade(c);
          if (d2 && decs.indexOf(d2) < 0) decs.push(d2);
        });
        decs.sort();
        var md = ["全部"].concat(decs).concat(decs.length < (D.site.catalog || []).length ? ["年代待补"] : []);
        dchips.innerHTML = '<span style="font-size:.72rem;color:var(--ink-3);margin-right:6px">年代</span>' + md.map(function (k) {
          var n = (D.site.catalog || []).filter(function (c) {
            var d2 = catDecade(c);
            return k === "全部" ? true : (k === "年代待补" ? !d2 : d2 === k);
          }).length;
          return '<a class="tag-chip' + (k === catDecadeFilter ? " on" : "") + '" href="#">' + esc(k) + "<em>" + n + "</em></a>";
        }).join("");
        $$("#decadeChips .tag-chip").forEach(function (a) {
          a.addEventListener("click", function (e) {
            e.preventDefault();
            catDecadeFilter = (a.childNodes[0] && a.childNodes[0].textContent || a.textContent).trim();
            paintCatalog();
            $$("#decadeChips .tag-chip").forEach(function (x) { x.classList.toggle("on", x === a); });
          });
        });
      }
      paintCatalog();
    }
    renderIndexSections();
  }

  function renderDaily() {
    var daily = $("#dailyStrip");
    if (!daily) return;
    var seed = Math.floor(Date.now() / 86400000);
    var qs = D.site.quotes || [];
    var q = qs.length ? qs[seed % qs.length] : null;
    var ws = DATA.works || [];
    var w = ws.length ? ws[seed % ws.length] : null;
    daily.innerHTML = (q ? "<span class='daily-tag'>今日诗签</span><p class='daily-q'>" + esc(q.text) + "<cite>—— " + esc(q.from) + "</cite></p>" : "") +
      (w ? "<a class='daily-work' href='work.html?id=" + w.id + "'>今日推荐：《" + esc(w.title) + "》→</a>" : "");
  }

  var HUES = ["#8b3a3a", "#b8964a", "#5b7a6a", "#9c6b3f", "#33506b", "#6e2f2a"];

  function authorIndex() {
    var by = {};
    DATA.works.forEach(function (w) {
      var k = w.author || "佚名";
      if (!by[k]) by[k] = { name: k, works: [], likes: 0 };
      by[k].works.push(w);
      by[k].likes += (w.likes || 0);
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.works.length - a.works.length || b.likes - a.likes; });
  }

  function initAuthorsPage() {
    var grid = $("#authorGrid");
    if (!grid) return;

    function paint() {
      var list = authorIndex();
      var name = new URLSearchParams(location.search).get("name");
      var one = name ? list.filter(function (a) { return a.name === name; })[0] : null;
      if (one) { renderAuthor(one); return; }

      var wrap = $("#authorWorks");
      if (wrap) wrap.style.display = "none";
      var old = $("#authorHead");
      if (old) old.parentNode.removeChild(old);
      grid.style.display = "grid";
      $("#authorHero").querySelector("h1").textContent = "作者名录";
      $("#authorSub").innerHTML = "为本刊写过字的人 · " + list.length + " 位作者 · " + DATA.works.length + " 篇作品";
      grid.innerHTML = list.map(function (a, i) {
        var g = a.works[0] || {};
        return "<a class='author-card' href='authors.html?name=" + encodeURIComponent(a.name) + "'>" +
          "<span class='avatar' style='background:" + HUES[i % HUES.length] + "'>" + esc((a.name || "?").slice(0, 1)) + "</span>" +
          "<span><span class='author-name'>" + esc(a.name) + "</span>" +
          "<span class='author-meta'>" + esc((g.grade || "") + (g.class_name ? g.class_name + "班" : "")) + " · " + a.works.length + " 篇 · " + a.likes + " 喜欢</span></span></a>";
      }).join("");
    }

    function renderAuthor(a) {
      grid.style.display = "none";
      var wrap = $("#authorWorks");
      if (!wrap) return;
      wrap.style.display = "block";
      var g = a.works[0] || {};
      var member = (D.members || []).filter(function (m) { return m.name === a.name; })[0];
      var cats = {};
      a.works.forEach(function (w) { cats[w.category] = (cats[w.category] || 0) + 1; });
      var old = $("#authorHead");
      if (old) old.parentNode.removeChild(old);
      var head = document.createElement("div");
      head.className = "author-head rv on";
      head.id = "authorHead";
      head.innerHTML = "<span class='avatar' style='background:" + (member ? member.hue : "#8b3a3a") + "'>" + esc((a.name || "?").slice(0, 1)) + "</span>" +
        "<div><h2>" + esc(a.name) + "</h2><p>" + esc((g.grade || "") + (g.class_name ? g.class_name + "班" : "")) + (member ? " · " + esc(member.role) : "") + "</p>" +
        (member ? "<p style='color:var(--ink-2);margin-top:8px;font-family:var(--kai)'>“" + esc(member.quote) + "”</p>" : "") +
        "<div class='author-stats'><span><b>" + a.works.length + "</b>篇作品</span><span><b>" + a.likes + "</b>获喜欢</span><span><b>" + Object.keys(cats).length + "</b>种文体</span></div></div>";
      wrap.insertBefore(head, wrap.firstChild);
      $("#authorHero").querySelector("h1").textContent = a.name;
      $("#authorSub").innerHTML = "作者主页 · 新笔文学社";
      $("#awTitle").textContent = "全部作品";
      $("#awGrid").innerHTML = a.works.map(workCard).join("");
      
      var mentions = [];
      (window.XB_ACTIVITIES || []).forEach(function (ac) {
        (ac.paras || []).forEach(function (pp) {
          if (pp.indexOf(a.name) > -1) mentions.push({ act: ac, sent: pp });
        });
      });
      
      var catRows = (D.site.catalog || []).filter(function (c) { return (c.author || "").indexOf(a.name) > -1; });
      var mh = $("#authorMentions");
      if (mh) mh.parentNode.removeChild(mh);
      if (catRows.length) {
        var cbox = document.createElement("div");
        cbox.className = "guide-card rv on";
        cbox.id = "authorCatalog";
        cbox.innerHTML = "<h2>发表名录中的记录</h2><div class='org-list'>" +
          catRows.map(function (c) {
            return "<div class='org-item'><b>" + esc(c.kind || "作品") + "</b><span>《" + esc(c.title) + "》 · " + esc(c.where || "") + "</span></div>";
          }).join("") + "</div>";
        wrap.appendChild(cbox);
      }
      if (mentions.length) {
        var mbox = document.createElement("div");
        mbox.className = "guide-card rv on";
        mbox.id = "authorMentions";
        mbox.innerHTML = "<h2>活动原文中的提及</h2><div class='org-list'>" +
          mentions.slice(0, 4).map(function (m) {
            var t = m.sent, i = t.indexOf(a.name);
            var seg = t.slice(Math.max(0, i - 42), Math.min(t.length, i + 66));
            return "<div class='org-item'><b>" + esc(m.act.date) + "</b><span>…" + esc(seg) + "… · <a href='activity.html?id=" +
              m.act.id + "' style='color:var(--gold)'>原文</a></span></div>";
          }).join("") + "</div>";
        wrap.appendChild(mbox);
      }
      document.title = a.name + " - 新笔文学社";
      observeReveals();
    }

    paint();
    loadCloudData().then(function () { paint(); });
  }

  function initIssuePage() {
    var no = parseInt(new URLSearchParams(location.search).get("no"), 10);
    var idx = 0;
    (D.journal.issues || []).forEach(function (is, i) { if (is.no === no) idx = i; });

    function paint() {
      var list = D.journal.issues || [];
      var is = list[idx] || list[0];
      if (!is) {
        var t = $("#issueTitle");
        if (t) t.textContent = "期号待补";
        var m2 = $("#issueMeta");
        if (m2) m2.textContent = "具体期号与篇目暂无可靠来源，等编辑部提供样刊后再补";
        var toc = $("#issueToc");
        if (toc) toc.innerHTML = '<p class="ad-empty">暂无目录。已发表作品名录见 <a href="about.html#catalog">关于我们</a>。</p>';
        return;
      }
      $("#issueTitle").textContent = "第" + is.no + "期 · " + is.theme;
      $("#issueMeta").textContent = "《年轻的心》 · " + is.date + " · " + is.term + "季刊";
      document.title = "第" + is.no + "期 " + is.theme + " - 新笔文学社";

      var pieces = is.pieces || [];
      $("#issueToc").innerHTML = pieces.map(function (p) {
        var w = DATA.works.filter(function (x) { return x.title === p.title; })[0];
        var title = w
          ? "<a href='work.html?id=" + w.id + "'><span class='t'>" + esc(p.title) + "</span></a>"
          : "<span class='t'>" + esc(p.title) + "</span>";
        return "<div class='toc-row'><div>" + title + "<span class='toc-type'>" + esc(p.type) + "</span></div><div class='a'>" + esc(p.author) + "</div><div class='p'>" + esc(p.page) + "</div></div>";
      }).join("") || "<p class='ad-empty'>本期目录整理中</p>";

      renderIssueSpread(is);
      var pw = $("#issuePrefaceWrap");
      if (!pw) {  } else if (idx === 0 && D.site.preface) {
        pw.style.display = "block";
        $("#issuePreface").innerHTML = D.site.preface.paragraphs.map(function (t) {
          return "<p style='text-indent:2em;line-height:2;color:var(--ink-2);margin-bottom:.8em'>" + esc(t) + "</p>";
        }).join("") + "<p style='text-align:right;color:var(--ink-3);font-size:.85rem'>—— " + esc(D.site.preface.author) + "</p>";
      } else {
        pw.style.display = "none";
      }

      var works = pieces.map(function (p) {
        return DATA.works.filter(function (x) { return x.title === p.title; })[0];
      }).filter(Boolean);
      var ww = $("#issueWorksWrap");
      if (works.length) {
        ww.style.display = "block";
        $("#issueWorks").innerHTML = works.map(workCard).join("");
      } else {
        ww.style.display = "none";
      }

      var prev = list[idx + 1], next = list[idx - 1];
      $("#issueNav").innerHTML =
        (next ? "<a class='btn btn-l sm' href='issue.html?no=" + next.no + "'>← 第" + next.no + "期</a>" : "<span></span>") +
        "<a class='btn btn-l sm' href='journal.html'>全部往期</a>" +
        (prev ? "<a class='btn btn-l sm' href='issue.html?no=" + prev.no + "'>第" + prev.no + "期 →</a>" : "<span></span>");
      observeReveals();
    }

    paint();
    loadCloudData().then(function () { paint(); });
  }

  var PICK_NOTES = [
    "这一篇的细节是「看见」过的，不是想出来的。",
    "读完会想给家里打个电话的那种文章。",
    "短，但每一句都踩在实处。",
    "作者克制得住，所以读者放不下。",
    "推荐给所有说「我不会写」的同学看看。"
  ];

  function renderFeatured() {
    var box = $("#featureBlock");
    if (!box || !DATA.works.length) return;
    var seed = Math.floor(Date.now() / 86400000);
    var w = DATA.works[seed % DATA.works.length];
    if (!w) return;
    var grade = (w.grade || "") + (w.class_name ? w.class_name + "班" : "");
    box.innerHTML =
      '<div class="feature-art"><div class="wci">' + coverArt(w) + "</div></div>" +
      '<div class="feature-body">' +
      '<span class="feature-tag">编辑推荐 · EDITOR\u2019S PICK</span>' +
      "<h3>" + esc(w.title) + "</h3>" +
      '<div class="feature-meta">' + esc(w.author) + (grade ? " · " + esc(grade) : "") + " · " + esc(D.categories[w.category] || "") + "</div>" +
      '<p class="feature-ex">' + esc(w.excerpt) + "</p>" +
      '<p class="feature-note">编辑部：' + esc(PICK_NOTES[seed % PICK_NOTES.length]) + "</p>" +
      '<div class="feature-ops"><a class="btn btn-d" href="work.html?id=' + w.id + '">阅读全文</a>' +
      '<a class="btn btn-l" href="authors.html?name=' + encodeURIComponent(w.author) + '">作者主页</a></div>' +
      "</div>";
    observeReveals();
  }

  function renderBars() {
    var box = $("#barsBox");
    if (!box) return;
    var counts = {};
    DATA.works.forEach(function (w) { counts[w.category] = (counts[w.category] || 0) + 1; });
    var cats = ["prose", "poetry", "fiction", "essay"];
    var max = 1;
    cats.forEach(function (c) { if ((counts[c] || 0) > max) max = counts[c]; });
    box.innerHTML = cats.map(function (c) {
      var n = counts[c] || 0;
      return '<div class="bar-row"><span>' + esc(D.categories[c]) + "</span>" +
        '<span class="bar-track"><i class="bar-fill" style="width:' + Math.round((n / max) * 100) + '%"></i></span>' +
        '<span class="bar-num">' + n + "</span></div>";
    }).join("");
  }

  function initCraftPage() {
    var box = $("#craftLessons");
    if (!box) return;
    box.innerHTML = (D.site.craft || []).map(function (l) {
      return '<div class="lesson"><div class="lesson-no">' + esc(l.no) + " · LESSON</div><h3>" + esc(l.title) + "</h3>" +
        l.body.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
        '<div class="demo"><div class="demo-box"><b>改前</b>' + esc(l.demo.before) + '</div>' +
        '<div class="demo-box after"><b>改后</b>' + esc(l.demo.after) + "</div></div>" +
        '<div class="tip">' + esc(l.tip) + "</div></div>";
    }).join("");

    var r = D.site.revision;
    if (r) {
      $("#revTitle").textContent = r.title;
      $("#revBefore").innerHTML = "<h4>初稿 / BEFORE</h4>" + r.before.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
      $("#revAfter").innerHTML = "<h4>见刊稿 / AFTER</h4>" + r.after.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
      $("#revNotes").innerHTML = r.notes.map(function (n) {
        return '<div class="rev-note"><b>' + esc(n.at) + "</b><span>" + esc(n.note) + "</span></div>";
      }).join("");
    }
    $("#methodsGrid").innerHTML = (D.site.methods || []).map(function (m) {
      return '<div class="mt-item"><b>' + esc(m.name) + "</b><span>" + esc(m.desc) + "</span></div>";
    }).join("");
    $("#glossaryGrid").innerHTML = (D.site.glossary || []).map(function (g) {
      return '<div class="gl-item"><div class="gl-term">' + esc(g.term) + "<i>TERM</i></div>" +
        '<div class="gl-def">' + esc(g.def) + "</div>" +
        '<div class="gl-eg">' + esc(g.eg) + "</div></div>";
    }).join("");
    $("#promptsGrid").innerHTML = (D.site.prompts || []).map(function (p) {
      return '<div class="pr-item"><b>' + esc(p.t) + "</b><span>" + esc(p.hint) + "</span></div>";
    }).join("");

    var rev = $("#reviewsList");
    if (rev) {
      rev.innerHTML = (D.site.reviews || []).map(function (r) {
        return '<div class="wk-review" style="margin-bottom:16px"><b>《' + esc(r.work) + '》· ' + esc(r.author) + "</b>" +
          "<p>" + esc(r.text) + "</p><span>—— " + esc(r.judge) + "，" + esc(r.role) + "</span></div>";
      }).join("");
    }

    var iv = null;
    if (iv) {
      $("#ivHead").innerHTML = '<span class="avatar" style="background:#6e2f2a">顾</span>' +
        "<div><h3>" + esc(iv.who) + "</h3><p>访谈 · 编辑部长 苏晚 记录</p></div>";
      $("#ivIntro").textContent = iv.intro;
      $("#ivList").innerHTML = iv.qa.map(function (x) {
        return '<div class="iv-item"><div class="iv-q"><span>' + esc(x.q) + '</span></div>' +
          '<div class="iv-a"><span>' + esc(x.a) + "</span></div></div>";
      }).join("");
    }
    observeReveals();
  }

  function initReadingPage() {
    var grid = $("#bookGrid");
    if (!grid) return;
    var HUES = { "散文": "#5b7a6a", "小说": "#8b3a3a", "古典": "#9c6b3f", "外国": "#33506b", "非虚构": "#b8964a", "理论": "#6e2f2a" };
    var cats = ["全部"];
    (D.site.reading || []).forEach(function (b) { if (cats.indexOf(b.cat) < 0) cats.push(b.cat); });
    var cur = "全部";

    function paint() {
      var list = (D.site.reading || []).filter(function (b) { return cur === "全部" || b.cat === cur; });
      grid.innerHTML = list.map(function (b) {
        return '<div class="book-card"><span class="book-spine" style="background:' + (HUES[b.cat] || "#8b3a3a") + '">' + esc(b.cat) + "</span>" +
          '<div class="book-body"><h3>' + esc(b.title) + "</h3>" +
          '<div class="book-meta"><span>' + esc(b.author) + "</span><span>" + esc(b.year) + "</span><span>" + esc(b.level) + "</span></div>" +
          '<p class="book-why">' + esc(b.why) + "</p></div></div>";
      }).join("");
    }

    $("#bookFilters").innerHTML = cats.map(function (c) {
      return '<button type="button"' + (c === "全部" ? ' class="on"' : "") + ' data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
    $$("#bookFilters button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#bookFilters button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        cur = b.dataset.cat;
        paint();
      });
    });
    paint();
  }

  function renderTopics() {
    var box = $("#topicBox");
    if (!box) return;
    box.innerHTML = (D.site.topics || []).map(function (t) {
      var works = (t.works || []).map(function (title) {
        return DATA.works.filter(function (w) { return w.title === title; })[0];
      }).filter(Boolean);
      return '<div class="topic"><span class="topic-tag">' + esc(t.tag) + "</span>" +
        "<h3>" + esc(t.title) + "</h3>" +
        '<p class="topic-note">' + esc(t.note) + "</p>" +
        '<div class="topic-works">' + works.map(function (w) {
          return '<a class="topic-work" href="work.html?id=' + w.id + '"><b>' + esc(w.title) + "</b>" +
            "<span>" + esc(w.author) + " · " + esc(D.categories[w.category] || "") + " · " + (w.likes || 0) + " 喜欢</span></a>";
        }).join("") + "</div></div>";
    }).join("");
  }

  function renderGeo() {
    var box = $("#geoGrid");
    if (!box) return;
    box.innerHTML = (D.site.geo || []).map(function (g) {
      return '<div class="geo-card"><div class="geo-name">' + esc(g.name) + "</div>" +
        '<div class="geo-sub">' + esc(g.sub) + "</div>" +
        '<p class="geo-desc">' + esc(g.desc) + "</p>" +
        '<p class="geo-prompt"><b>写作提示</b>' + esc(g.prompt) + "</p></div>";
    }).join("");
  }

  var ISSUE_HUES = ["#8b3a3a", "#b8964a", "#5b7a6a", "#9c6b3f", "#33506b", "#6e2f2a"];

  function vText(str, x, y0, size, color) {
    return String(str || "").split("").map(function (ch, i) {
      return '<text x="' + x + '" y="' + (y0 + i * size * 1.14) + '" font-size="' + size + '" fill="' + color +
        '" text-anchor="middle" font-family="Songti SC, SimSun, STSong, serif">' + esc(ch) + "</text>";
    }).join("");
  }

  function issueCover(is, i) {
    var c = ISSUE_HUES[i % ISSUE_HUES.length];
    var theme = String(is.theme || "");
    return '<svg viewBox="0 0 300 400" role="img" aria-label="第' + esc(is.no) + "期 " + esc(theme) + '">' +
      '<rect width="300" height="400" fill="#f6efe0"/>' +
      '<rect width="300" height="16" fill="' + c + '"/>' +
      '<rect x="18" y="34" width="264" height="332" fill="none" stroke="' + c + '" stroke-opacity=".3"/>' +
      '<text x="40" y="74" font-size="11" fill="' + c + '" letter-spacing="3" font-family="Helvetica, Arial, sans-serif">XINBI</text>' +
      '<text x="40" y="96" font-size="12" fill="' + c + '" font-family="Songti SC, SimSun, serif" letter-spacing="2">校刊 · 新笔</text>' +
      vText(theme, 214, 140, 34, "#2a211b") +
      '<line x1="40" y1="330" x2="120" y2="330" stroke="' + c + '" stroke-opacity=".5"/>' +
      '<text x="40" y="352" font-size="13" fill="' + c + '" font-family="Songti SC, SimSun, serif" letter-spacing="1">第 ' + esc(is.no) + " 期 · " + esc(is.term || "") + "</text>" +
      '<text x="40" y="370" font-size="10" fill="#8a7c6c" letter-spacing="1.6" font-family="Helvetica, Arial, sans-serif">' + esc(String(is.date || "").replace("年", ".").replace("月", "")) + "</text>" +
      "</svg>";
  }

  function renderIssueWall() {
    var wall = $("#issueWall");
    if (!wall) return;
    wall.innerHTML = (D.journal.issues || []).map(function (is, i) {
      return '<a class="wall-item" href="issue.html?no=' + is.no + '">' +
        '<div class="wall-cover">' + issueCover(is, i) + "</div>" +
        '<div class="wall-meta"><b>第' + is.no + "期 · " + esc(is.theme) + "</b><span>" + esc(is.date) + "</span></div></a>";
    }).join("");
  }

  function renderIssueSpread(is) {
    var spread = $("#issueSpread");
    if (!spread || !is) return;
    var first = (is.pieces || [])[0];
    var w = first ? DATA.works.filter(function (x) { return x.title === first.title; })[0] : null;
    var lead = w ? (w.content || []).slice(0, 2) : [];
    var pre = D.site.preface;
    spread.innerHTML =
      '<div class="spread">' +
        '<div class="page"><h4>卷首语 · PREFACE</h4>' +
          (pre ? pre.paragraphs.slice(0, 2).map(function (t) { return '<p class="page-lead">' + esc(t) + "</p>"; }).join("") +
            '<div class="page-sign">—— ' + esc(pre.author) + "</div>" : "") +
          '<span class="page-no">导读 · 01</span></div>' +
        '<div class="page"><h4>试读 · ' + esc(first ? first.title : "本期精选") + "</h4>" +
          (lead.length ? lead.map(function (t) { return '<p class="page-lead">' + esc(t) + "</p>"; }).join("") : '<p class="page-lead">本期内页整理中。</p>') +
          '<div class="page-sign">' + esc(w ? w.author : "") + (w ? " · " + esc(D.categories[w.category] || "") : "") + "</div>" +
          '<span class="page-no">导读 · 02</span></div>' +
      "</div>";
  }

  function initContestPage() {
    var c = D.site && D.site.contest;
    if (!c) return;
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v || ""; }
    setText("contestSeason", c.season);
    setText("contestTheme", "主题 · " + c.theme);
    setText("contestLead", c.lead);
    setText("contestDeadline", c.deadline);
    setText("contestWords", c.words);

    var pl = $("#prizeList");
    if (pl) pl.innerHTML = (c.prizes || []).map(function (p) {
      return '<div class="prize-item"><span class="prize-rank">' + esc(p.rank) + '</span><span class="prize-n">' + esc(p.n) + '</span><span class="prize-d">' + esc(p.prize) + "</span></div>";
    }).join("");

    var rl = $("#contestRules");
    if (rl) rl.innerHTML = (c.rules || []).map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");

    var entries = (c.entries || []).map(function (title) {
      return DATA.works.filter(function (w) { return w.title === title; })[0];
    }).filter(Boolean);

    var votes = {};
    var mine = {};
    try { mine = JSON.parse(localStorage.getItem("xb_myvotes") || "{}") || {}; } catch (e) { mine = {}; }

    function sorted() {
      return entries.slice().sort(function (a, b) {
        return (votes[b.id] || 0) - (votes[a.id] || 0) || (b.likes || 0) - (a.likes || 0);
      });
    }

    function paint() {
      var list = sorted();
      var grid = $("#entryGrid");
      if (grid) {
        grid.innerHTML = list.map(function (w, i) {
          var n = votes[w.id] || 0;
          var voted = !!mine[w.id];
          return '<article class="entry">' +
            '<div class="entry-art">' + coverArt(w) + "</div>" +
            '<div class="entry-body"><h3>' + esc(w.title) + "</h3>" +
            '<div class="entry-meta">' + esc(w.author) + " · " + esc((w.grade || "") + (w.class_name ? w.class_name + "班" : "")) + " · " + esc(D.categories[w.category] || "") + "</div>" +
            '<p class="entry-ex">' + esc(w.excerpt) + "</p>" +
            '<div class="entry-foot"><button type="button" class="vote-btn' + (voted ? " on" : "") + '" data-vote="' + w.id + '">' + (voted ? "已投一票" : "投一票") + "</button>" +
            '<span class="vote-n">' + n + " 票</span>" +
            '<span class="entry-rank">NO.' + (i + 1) + "</span></div></div></article>";
        }).join("");
        $$("#entryGrid [data-vote]").forEach(function (b) {
          b.addEventListener("click", function () { vote(b.dataset.vote); });
        });
      }
      var rank = $("#rankList");
      if (rank) {
        var max = 1;
        list.forEach(function (w) { if ((votes[w.id] || 0) > max) max = votes[w.id]; });
        rank.innerHTML = list.slice(0, 6).map(function (w, i) {
          var n = votes[w.id] || 0;
          return '<div class="rank-row' + (i === 0 ? " top1" : "") + '"><span class="rank-no">' + String(i + 1).padStart(2, "0") + "</span>" +
            '<div class="rank-title"><b>' + esc(w.title) + "</b><span>" + esc(w.author) + "</span>" +
            '<div class="rank-bar"><i style="width:' + Math.round((n / max) * 100) + '%"></i></div></div>' +
            '<span class="rank-num">' + n + " 票</span></div>";
        }).join("");
      }
    }

    function loadVotes() {
      if (!window.XB_CLOUD || !XB_CLOUD.isReady()) return;
      XB_CLOUD.fetchVotes().then(function (rows) {
        if (!rows) return;
        votes = {};
        rows.forEach(function (r) { votes[r.work_id] = (votes[r.work_id] || 0) + 1; });
        paint();
      }).catch(function () {});
    }

    function vote(id) {
      var w = entries.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!w) return;
      var u = curUser();
      if (!u) { toast("登录后即可投票", "err"); return; }
      var on = !mine[w.id];
      if (on) { mine[w.id] = true; votes[w.id] = (votes[w.id] || 0) + 1; }
      else { delete mine[w.id]; votes[w.id] = Math.max(0, (votes[w.id] || 0) - 1); }
      try { localStorage.setItem("xb_myvotes", JSON.stringify(mine)); } catch (e) {}
      paint();
      if (window.XB_CLOUD && XB_CLOUD.isReady() && u.cloud) {
        XB_CLOUD.markInteraction(w.id, "vote", on).then(function (r) {
          if (r && r.error) { toast("投票失败：云端不可用", "err"); return; }
          toast(on ? "投票成功" : "已撤回投票");
          loadVotes();
        }).catch(function () { toast("投票失败：网络异常", "err"); });
      } else {
        toast(on ? "已投票（登录云端账号可计票）" : "已撤回投票");
      }
    }

    paint();
    loadVotes();
  }

  function initSearchPage() {
    var input = $("#searchInput");
    if (!input) return;
    var idx = [];
    var cur = "全部";

    function build() {
      idx = [];
      DATA.works.forEach(function (w) {
        idx.push({
          type: "作品", title: w.title,
          sub: (w.author || "") + " · " + (D.categories[w.category] || "") + " · " + (w.likes || 0) + " 喜欢",
          text: (w.excerpt || "") + " " + (w.content || []).join(" "),
          href: "work.html?id=" + w.id
        });
      });
      authorIndex().forEach(function (a) {
        idx.push({
          type: "作者", title: a.name,
          sub: a.works.length + " 篇作品 · " + a.likes + " 获喜欢",
          text: a.works.map(function (w) { return w.title; }).join(" "),
          href: "authors.html?name=" + encodeURIComponent(a.name)
        });
      });
      (D.journal.issues || []).forEach(function (is) {
        idx.push({
          type: "社刊", title: "第" + is.no + "期 " + is.theme,
          sub: (is.date || "") + " · " + (is.pieces || []).length + " 篇",
          text: (is.pieces || []).map(function (x) { return x.title + " " + x.author; }).join(" "),
          href: "issue.html?no=" + is.no
        });
      });
      (D.site.topics || []).forEach(function (t) {
        idx.push({ type: "专题", title: t.title, sub: "专题策划", text: t.note + " " + (t.works || []).join(" "), href: "index.html#topics" });
      });
      (D.site.columns || []).forEach(function (c) {
        idx.push({ type: "栏目", title: c.name, sub: "社刊栏目", text: c.desc, href: "guide.html" });
      });
      (D.site.geo || []).forEach(function (g) {
        idx.push({ type: "地理", title: g.name, sub: g.sub || "文学地理", text: g.desc + " " + g.prompt, href: "index.html#geo" });
      });
      (D.site.glossary || []).forEach(function (g) {
        idx.push({ type: "写作", title: g.term, sub: "文学小词典", text: g.def + " " + g.eg, href: "craft.html" });
      });
      (window.XB_PEOPLE || []).forEach(function (p) {
        idx.push({ type: "人物", title: p.name, sub: p.role, text: p.note, href: "activity.html?id=" + p.act });
      });
      (window.XB_ACTIVITIES || []).forEach(function (a) {
        idx.push({
          type: "活动", title: a.title, sub: a.date + " · 活动档案",
          text: (a.paras || []).join(" "),
          href: "activity.html?id=" + a.id
        });
      });
      (D.site.reading || []).forEach(function (b) {
        idx.push({ type: "书单", title: b.title, sub: b.author + " · " + b.cat + " · " + b.level, text: b.why, href: "reading.html" });
      });
    }

    function hi(text, q) {
      var e = esc(text || "");
      if (!q) return e;
      var qe = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        return e.replace(new RegExp(qe, "gi"), function (m) { return "<mark>" + m + "</mark>"; });
      } catch (err) { return e; }
    }

    function render(res, q) {
      var box = $("#searchResults"), sum = $("#searchSummary");
      if (!q) {
        sum.innerHTML = "试试搜「洞庭湖」「稻草」「母亲」「留白」，或点下面的标签。";
        box.innerHTML = "";
        return;
      }
      sum.innerHTML = "找到 <b>" + res.length + "</b> 条与「" + esc(q) + "」相关的内容";
      if (!res.length) {
        box.innerHTML = '<p class="search-empty">没有找到。换个词试试——作者名、作品名、地名都可以。</p>';
        return;
      }
      var grouped = {};
      res.forEach(function (it) { (grouped[it.type] = grouped[it.type] || []).push(it); });
      box.innerHTML = Object.keys(grouped).map(function (k) {
        return '<div class="search-group"><h3>' + esc(k) + " · " + grouped[k].length + "</h3>" +
          grouped[k].map(function (it) {
            return '<a class="result" href="' + it.href + '"><b>' + hi(it.title, q) + "</b>" +
              "<span>" + esc(it.sub) + "</span>" +
              (it.text ? "<p>" + hi(String(it.text).slice(0, 96), q) + "…</p>" : "") + "</a>";
          }).join("") + "</div>";
      }).join("");
    }

    function run() {
      var q = input.value.trim();
      if (!q) { render([], ""); return; }
      var norm = function (v) { return String(v == null ? "" : v).replace(/\s+/g, "").toLowerCase(); };
      var ql = norm(q);
      var res = idx.map(function (it) {
        var score = 0;
        if (norm(it.title).indexOf(ql) > -1) score += 5;
        if (norm(it.sub).indexOf(ql) > -1) score += 2;
        if (norm(it.text).indexOf(ql) > -1) score += 1;
        return { it: it, score: score };
      }).filter(function (r) { return r.score > 0 && (cur === "全部" || r.it.type === cur); })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (r) { return r.it; })
        .slice(0, 40);
      render(res, q);
    }

    build();
    var q0 = new URLSearchParams(location.search).get("q");
    if (q0) input.value = q0;
    run();

    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 180);
    });
    on("#searchBtn", "click", run);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); run(); } });

    $$("#searchTags button").forEach(function (b) {
      b.addEventListener("click", function () {
        input.value = b.textContent;
        run();
        input.focus();
      });
    });
    loadCloudData().then(function () { build(); run(); });
    observeReveals();
  }

  var lbItems = [], lbIdx = 0;
  function lbPaint() {
    var lb = $("#lightbox");
    if (!lb || !lbItems.length) return;
    var it = lbItems[lbIdx];
    var img = lb.querySelector("img");
    if (img) {
      img.src = it.src;
      var fb = it.fb || "";
      if (fb) { img.dataset.fb = fb; img.onerror = function () { window.imgFB(img); }; }
      else img.onerror = null;
    }
    var c = lb.querySelector(".lightbox-cap");
    if (c) c.textContent = it.cap || "";
    var p = $("#lbPrev"), n = $("#lbNext"), ct = $("#lbCount");
    var multi = lbItems.length > 1;
    if (p) p.style.display = multi ? "" : "none";
    if (n) n.style.display = multi ? "" : "none";
    if (ct) { ct.textContent = multi ? (lbIdx + 1) + " / " + lbItems.length : ""; ct.style.display = multi ? "" : "none"; }
  }
  function lbStep(d) {
    if (!lbItems.length) return;
    lbIdx = (lbIdx + d + lbItems.length) % lbItems.length;
    lbPaint();
  }
  function lightboxOpen(src, cap, fb) {
    var lb = $("#lightbox");
    if (!lb) return;
    lbItems = [{ src: src, cap: cap, fb: fb || "" }];
    lbIdx = 0;
    lbPaint();
    lb.classList.add("open");
  }

  function bindLightbox() {
    var lb = $("#lightbox");
    if (!lb || lb._bound) return;
    lb._bound = true;
    lb.addEventListener("click", function (e) {
      if (e.target === lb || (e.target.className || "").indexOf("lightbox-close") > -1) {
        lb.classList.remove("open");
      }
    });
    var pb = $("#lbPrev"), nb = $("#lbNext");
    if (pb) pb.addEventListener("click", function (e) { e.stopPropagation(); lbStep(-1); });
    if (nb) nb.addEventListener("click", function (e) { e.stopPropagation(); lbStep(1); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") lb.classList.remove("open");
      if (e.key === "ArrowLeft") lbStep(-1);
      if (e.key === "ArrowRight") lbStep(1);
    });
    document.addEventListener("click", function (e) {
      var card = e.target.closest ? e.target.closest("[data-photo]") : null;
      if (!card) return;
      var holder = card.closest("[data-photo-group]") || document;
      var cards = [].slice.call(holder.querySelectorAll("[data-photo]"));
      var idx = Math.max(0, cards.indexOf(card));
      lbItems = cards.map(function (cc) {
        var im = cc.querySelector("img");
        return im ? { src: im.getAttribute("data-full") || im.getAttribute("src"), cap: cc.getAttribute("data-cap") || im.alt || "", fb: im.dataset.fb || "" } : null;
      }).filter(Boolean);
      if (!lbItems.length) return;
      lbIdx = idx;
      lbPaint();
      lb.classList.add("open");
    });
  }

  var PIC = location.hostname === "lueuru.github.io" ? "" : "https://lueuru.github.io/xinbi-literature";
  var ALT = location.hostname === "lueuru.github.io" ? "https://xinbi-literature.app.workbuddy.host" : "https://lueuru.github.io/xinbi-literature";
  function pic(src) { return /^https?:/.test(String(src)) ? String(src) : PIC + "/" + String(src); }
  function alt(src) { return ALT + "/" + String(src).replace(/^\//, ""); }
  function webpOf(src) { return String(src).replace(/\.jpg$/, ".webp"); }

  function thumbOf(src) { return pic(src.replace("assets/photos/", "assets/photos/th/")); }
  function fbAttrs(src) {
    var m = String(src).match(/([^\/]+)\.jpg$/);
    if (!m) return "";
    var t = "assets/photos/th/" + m[1];
    var full = "assets/photos/" + String(src).split("assets/photos/")[1];
    var list = [pic(t + ".webp"), alt(t + ".webp"), alt(t + ".jpg"), pic(full), alt(full)];
    return ' data-fb="' + list.join("|") + '" onerror="imgFB(this)"';
  }

  function photoCard(p, withCap) {
    return '<figure class="photo-card" data-photo data-cap="' + esc(p.cap || "") + '">' +
      '<img src="' + webpOf(thumbOf(p.src)) + '" data-full="' + pic(p.src) + '"' + fbAttrs(p.src) + ' alt="' + esc(p.cap || "") + '" loading="lazy">' +
      (withCap ? '<figcaption class="photo-cap"><b>' + esc(p.cap || "") + "</b><span>" + esc(p.note || "") + "</span></figcaption>" : "") +
      "</figure>";
  }

  function renderFlow(act) {
    var box = $("#actFlow");
    if (!box) return;
    var flow = (D.site.flow || {})[act.id];
    if (!flow) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="st rv on" style="margin:6px 0 14px"><span class="tag">Agenda</span><h2>会议议程</h2></div>' +
      '<ol class="flow">' + flow.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ol>';
  }

  function renderMeipian() {
    var box = $("#meipianList");
    if (!box) return;
    box.innerHTML = (D.site.meipian || []).map(function (m) {
      var photos = m.photos || [];
      var show = photos.slice(0, 4);
      return '<div class="mp-item">' +
        '<div class="mp-head"><b>' + esc(m.date || "") + "</b>" +
        '<a class="mp-title" href="activity.html?id=' + m.url.split("/").pop() + '">' + esc(m.title) + "</a>" +
        '<a href="' + m.url + '" target="_blank" rel="noopener">原文 →</a></div>' +
        (show.length ? '<div class="mp-thumbs">' + show.map(function (src) {
          return '<img src="' + webpOf(thumbOf(src)) + '" data-full="' + pic(src) + '"' + fbAttrs(src) + ' alt="' + esc(m.title) + '" loading="lazy" data-photo data-cap="' + esc(m.date + " · " + m.title) + '">';
        }).join("") + "</div>" : "") +
        (photos.length > 4 ? '<p class="mp-more">另有 ' + (photos.length - 4) + " 张，见原文</p>" : "") +
        "</div>";
    }).join("");
    bindLightbox();
  }

  function renderSchoolNews() {
    var box = $("#schoolNewsList");
    if (!box) return;
    box.innerHTML = (D.site.schoolNews || []).map(function (n) {
      return '<div class="mp-item">' +
        '<div class="mp-head"><b>' + esc(n.date) + "</b><span>" + esc(n.title) + "</span>" +
        '<a href="' + n.url + '" target="_blank" rel="noopener">原文 →</a></div>' +
        '<div class="mp-thumbs">' + (n.photos || []).map(function (src) {
          return '<img src="' + src + '" alt="' + esc(n.title) + '" loading="lazy" data-photo data-cap="' + esc(n.date + " · " + n.title) + '">';
        }).join("") + "</div></div>";
    }).join("");
    bindLightbox();
  }

  function initActivityPage() {
    var id = new URLSearchParams(location.search).get("id") || "";
    var list = window.XB_ACTIVITIES || [];
    var act = list.filter(function (a) { return a.id === id; })[0] || list[0];
    var box = $("#actBody");
    if (!act || !box) return;
    document.title = act.title + " - 新笔文学社";
    var t = $("#actTitle"); if (t) t.textContent = act.title;
    var m = $("#actMeta");
    if (m) m.innerHTML = esc(act.date) + ' · <a href="' + act.url + '" target="_blank" rel="noopener" style="color:var(--gold)">美篇原文 →</a>';
    box.innerHTML = act.paras.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    var src = $("#actSrc");
    if (src) src.textContent = "本文文字与照片据「新笔文学社」美篇原文整理（" + act.date + "），版权归原作者。";
    renderFlow(act);
    document.addEventListener("keydown", function (e) {
      var nav = document.getElementById("actNav");
      if (!nav) return;
      var as = nav.querySelectorAll("a[href*=activity]");
      if (e.key === "ArrowLeft" && as[0]) location.href = as[0].href;
      if (e.key === "ArrowRight" && as[as.length - 1]) location.href = as[as.length - 1].href;
    });
    var nav = $("#actNav");
    if (nav) {
      var i0 = list.indexOf(act), prev = list[i0 - 1], next = list[i0 + 1];
      nav.innerHTML = (prev ? '<a class="btn btn-l sm" href="activity.html?id=' + prev.id + '">← ' + esc(prev.title.slice(0, 12)) + "…</a>" : "<span></span>") +
        '<a class="btn btn-l sm" href="gallery.html#meipianList">全部活动</a>' +
        (next ? '<a class="btn btn-l sm" href="activity.html?id=' + next.id + '">' + esc(next.title.slice(0, 12)) + "… →</a>" : "<span></span>");
    }
    var ph = $("#actPhotos");
    if (ph) {
      ph.innerHTML = act.photos.map(function (s2) {
        return '<figure class="photo-card" data-photo data-cap="' + esc(act.title) + '">' +
          '<img src="' + webpOf(thumbOf(s2)) + '" data-full="' + pic(s2) + '"' + fbAttrs(s2) + ' alt="' + esc(act.title) + '" loading="lazy"></figure>';
      }).join("");
      bindLightbox();
    }
  }

  function renderBigTimeline() {
    var box = $("#bigTimeline");
    if (!box) return;
    var items = [];
    (D.site.timeline || []).forEach(function (t) {
      items.push({ date: t.year, title: t.title, desc: t.desc, kind: "沿革" });
    });
    (window.XB_ACTIVITIES || []).forEach(function (a2) {
      items.push({ date: a2.date, title: a2.title.split("——").pop(), desc: "活动档案 · 全文与照片", kind: "活动", id: a2.id });
    });
    (D.site.honors || []).forEach(function (h) {
      if (/^\d{4}$/.test(h.year)) items.push({ date: h.year, title: h.title, desc: h.org, kind: "荣誉" });
    });
    items.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
    box.innerHTML = items.map(function (it) {
      var link = it.id ? ' · <a href="activity.html?id=' + it.id + '" style="color:var(--gold)">详情</a>' : "";
      return '<div class="past-item"><div class="past-date">' + esc(it.date) + "</div>" +
        "<div><h3>" + esc(it.title) + '<span class="tl-kind">' + esc(it.kind) + "</span></h3>" +
        "<p>" + esc(it.desc) + link + "</p></div></div>";
    }).join("");
  }

  function renderPeople() {
    var box = $("#peopleList");
    if (!box) return;
    var groups = [
      { k: "学校领导", test: /校长|书记|主任/ },
      { k: "社团教师", test: /社长|主编|教师|老师/ },
      { k: "学生社干", test: /学生|设计者/ }
    ];
    var all = window.XB_PEOPLE || [];
    box.innerHTML = groups.map(function (g) {
      var list = all.filter(function (p) {
        if (g.k === "学生社干") return g.test.test(p.role);
        if (g.k === "社团教师") return g.test.test(p.role) && !/校长|书记|主任/.test(p.role);
        return g.test.test(p.role);
      });
      if (!list.length) return "";
      return '<div class="ppl-group"><h3 class="ppl-h">' + g.k + " · " + list.length + "</h3>" +
        list.map(function (p) {
          return '<div class="org-item"><b>' + esc(p.name) + "</b><span>" + esc(p.role) + " · " + esc(p.note) +
            ' · <a href="activity.html?id=' + p.act + '" style="color:var(--gold)">出处</a></span></div>';
        }).join("") + "</div>";
    }).join("");
    observeReveals();
  }

  var tlFilter = "全部";
  function initTimelinePage() {
    var box = $("#tlList");
    if (!box) return;
    var items = [];
    (D.site.timeline || []).forEach(function (t) {
      items.push({ date: t.year, title: t.title, desc: t.desc, kind: t.year === "1960" || t.year === "1984" ? "建校/创社" : "沿革", key: true });
    });
    (window.XB_ACTIVITIES || []).forEach(function (a) {
      items.push({ date: String(a.date), title: a.title, desc: "活动档案 · " + (a.paras || []).length + " 段原文、" + (a.photos || []).length + " 张照片", kind: "活动", id: a.id });
    });
    (D.site.honors || []).forEach(function (h) {
      if (/^\d{4}$/.test(h.year)) items.push({ date: h.year, title: h.title, desc: h.org, kind: "荣誉" });
    });
    function sortKey(d) { var m = String(d).match(/\d{4}(-\d{2}(-\d{2})?)?/); return m ? m[0] : String(d); }
    items.sort(function (x, y) { return sortKey(y.date).localeCompare(sortKey(x.date)); });
    function paint(f) {
      var shown = items.filter(function (it) { return !f || f === "全部" || it.kind === f; });
      box.innerHTML = shown.map(function (it) {
        var link = it.id ? ' · <a href="activity.html?id=' + it.id + '" style="color:var(--gold)">详情</a>' : "";
        return '<div class="tl-item' + (it.key ? " key" : "") + '">' +
          '<span class="tl-year">' + esc(it.date) + "</span><span class='tl-tag'>" + esc(it.kind) + "</span>" +
          '<div class="tl-body"><h3>' + esc(it.title) + "</h3><p>" + esc(it.desc || "") + link + "</p></div></div>";
      }).join("");
      var sub = $("#tlSub");
      if (sub) sub.textContent = "从 1960 建校到今天的每一步 · 共 " + shown.length + " 条";
    }
    var chips = $("#tlChips");
    if (chips) {
      var kinds = ["全部", "沿革", "活动", "荣誉"];
      chips.innerHTML = kinds.map(function (k) {
        var n = k === "全部" ? items.length : items.filter(function (it) { return it.kind === k; }).length;
        return '<a class="tag-chip' + (k === tlFilter ? " on" : "") + '" href="#">' + k + "<em>" + n + "</em></a>";
      }).join("");
      $$("#tlChips .tag-chip").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          tlFilter = a.textContent.replace(/[0-9]/g, "").trim();
          paint(tlFilter);
          $$("#tlChips .tag-chip").forEach(function (x) { x.classList.toggle("on", x === a); });
        });
      });
    }
    paint(tlFilter);
  }

  function initTagsPage() {
    var idx = {}, result = $("#tagResult"), box = $("#tagIndex"), sub = $("#tagSub");
    if (!box) return;
    function add(tag, type, item) {
      if (!tag) return;
      var key = type + "|" + tag;
      if (!idx[key]) idx[key] = { tag: tag, type: type, items: [] };
      if (!idx[key].items.some(function (x) { return x.href === item.href; })) idx[key].items.push(item);
    }
    DATA.works.filter(function (w) { return w.verified; }).forEach(function (w) {
      add(D.categories[w.category] || "", "体裁", { kind: "作品", title: w.title, href: "work.html?id=" + w.id });
      add(w.tag || "", "体裁", { kind: "作品", title: w.title, href: "work.html?id=" + w.id });
      add(w.author || "", "作者", { kind: "作品", title: w.title, href: "work.html?id=" + w.id });
    });
    (window.XB_ACTIVITIES || []).forEach(function (a) {
      add(String(a.date).slice(0, 4), "年份", { kind: "活动", title: a.title, href: "activity.html?id=" + a.id });
      add(a.title.split("——")[0], "活动", { kind: "活动", title: a.title, href: "activity.html?id=" + a.id });
    });
    (D.site.honors || []).forEach(function (h) {
      if (/^\d{4}$/.test(h.year)) add(h.year, "年份", { kind: "荣誉", title: h.title, href: "about.html#records" });
    });
    (window.XB_PEOPLE || []).forEach(function (p2) {
      add(p2.name, "人物", { kind: "人物", title: p2.name + " · " + p2.role, href: "activity.html?id=" + p2.act });
    });
    var all = Object.keys(idx).map(function (k) { return idx[k]; });
    var cur = new URLSearchParams(location.search).get("tag");

    var types = ["体裁", "年份", "活动", "人物", "作者"];
    box.innerHTML = types.map(function (t) {
      var list = all.filter(function (x) { return x.type === t; });
      if (!list.length) return "";
      return '<div class="tag-group"><h3>' + t + " · " + list.length + '</h3><div class="tag-chips">' +
        list.map(function (x) {
          return '<a class="tag-chip' + (x.tag === cur ? " on" : "") + '" href="tags.html?tag=' + encodeURIComponent(x.tag) + '">' +
            esc(x.tag) + "<em>" + x.items.length + "</em></a>";
        }).join("") + "</div></div>";
    }).join("");

    if (!result) return;
    if (!cur) { result.innerHTML = ""; if (sub) sub.textContent = "按体裁、年份、活动、作者交叉索引 · 共 " + all.length + " 个标签"; return; }
    var hits = all.filter(function (x) { return x.tag === cur; });
    var items = [];
    hits.forEach(function (h) { h.items.forEach(function (i) { if (!items.some(function (y) { return y.href === i.href; })) items.push(i); }); });
    if (sub) sub.textContent = "标签：" + cur + " · " + items.length + " 条";
    result.innerHTML = '<div class="guide-card rv on"><h2>「' + esc(cur) + "」相关 " + items.length + " 条</h2><div class='org-list'>" +
      items.map(function (i) {
        return "<div class='org-item'><b>" + esc(i.kind) + "</b><span><a href='" + i.href + "'>" + esc(i.title) + "</a></span></div>";
      }).join("") + "</div></div>";
  }

  function renderSections() {
    var box = $("#secList");
    if (!box) return;
    var sec = D.site.sections || {};
    box.innerHTML = (sec.verified || []).map(function (x) {
      return '<div class="sec-card"><b>' + esc(x.name) + "</b><span>" + esc(x.note || "") + "</span></div>";
    }).join("");
    var note = $("#secNote");
    if (note) note.textContent = (sec.source || "") + "；共 " + sec.total + " 个版块，尚有 " + sec.pending + " 个待补。";
  }

  function buildTOC() {
    if (document.querySelector(".toc-float")) return;
    var heads = Array.prototype.slice.call(document.querySelectorAll("h2")).filter(function (h) {
      return h.textContent.trim().length > 1 && h.offsetParent !== null;
    });
    if (heads.length < 3) return;
    var nav = document.createElement("nav");
    nav.className = "toc-float";
    nav.setAttribute("aria-label", "本页目录");
    nav.innerHTML = "<b>本页目录</b>" + heads.map(function (h, i) {
      if (!h.id) h.id = "sect-" + i;
      return '<a href="#' + h.id + '">' + esc(h.textContent.trim()) + "</a>";
    }).join("");
    document.body.appendChild(nav);
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-15% 0px -75% 0px" });
      heads.forEach(function (h) { io.observe(h); });
    }
  }

  function buildMobileBar() {
    if (document.querySelector(".mbar") || window.innerWidth > 860) return;
    var page = document.body.getAttribute("data-page");
    var items = [
      { t: "首页", h: "index.html", k: "index" },
      { t: "作品", h: "works.html", k: "works" },
      { t: "活动", h: "gallery.html", k: "gallery" },
      { t: "招新", h: "join.html", k: "join" },
      { t: "搜索", h: "search.html", k: "search" }
    ];
    var bar = document.createElement("nav");
    bar.className = "mbar";
    bar.innerHTML = items.map(function (i) {
      return '<a href="' + i.h + '"' + (i.k === page ? ' class="on"' : "") + ">" + i.t + "</a>";
    }).join("");
    document.body.appendChild(bar);
  }

  function buildCrumb() {
    var page = document.body.getAttribute("data-page");
    var map = { sections: "社刊版块", works: "作品库", journal: "社刊", gallery: "活动现场",
      activity: "活动档案", about: "关于我们", guide: "投稿指南", craft: "写作课",
      reading: "书单", contest: "征文", search: "搜索", authors: "作者", work: "作品", issue: "期号", tags: "标签索引", timeline: "大事记", join: "网上招新" };
    var label = map[page];
    var main = document.getElementById("main");
    if (!label || !main || document.querySelector(".crumb")) return;
    var c = document.createElement("div");
    c.className = "crumb";
    c.innerHTML = '<a href="index.html">首页</a> <span aria-hidden="true">/</span> <span>' + label + "</span>";
    main.parentNode.insertBefore(c, main);
  }

  function renderNavCards() {
    var box = $("#navGrid");
    if (!box) return;
    var acts = window.XB_ACTIVITIES || [];
    var chars = acts.reduce(function (n, a) { return n + (a.paras || []).join("").length; }, 0);
    var photos = acts.reduce(function (n, a) { return n + (a.photos || []).length; }, 0) + (D.site.gallery || []).length;
    var cards = [
      { t: "作品库", d: "已发表作品，附指导老师点评与来源", n: (D.officialWorks || []).length + " 篇", h: "works.html" },
      { t: "活动档案", d: "会议纪要与现场照片，全文可读", n: acts.length + " 场 · " + chars + " 字 · " + photos + " 图", h: "gallery.html" },
      { t: "人物志", d: "社长、主编、校领导与学生社干", n: (window.XB_PEOPLE || []).length + " 位", h: "about.html#people" },
      { t: "大事记", d: "从建校、创社到今天的完整脉络", n: "1960 → 2026", h: "timeline.html" },
      { t: "社刊档案", d: "《年轻的心》的期数、版块与印量", n: "第 36 期 · 11 版块", h: "sections.html" },
      { t: "标签索引", d: "按体裁、年份、活动、作者交叉检索", n: "40 个标签", h: "tags.html" },
      { t: "光华杯征文", d: "清明缅怀——传承的力量", n: "1027 篇 → 90 篇", h: "contest.html" },
      { t: "投稿与指南", d: "怎么投稿、格式要求、往哪里交", n: "长期征稿", h: "guide.html" },
      { t: "加入我们", d: "网上招新：流程、条件与在线申请表", n: "常年招新", h: "join.html" }
    ];
    box.innerHTML = cards.map(function (c) {
      return '<a class="navcard" href="' + c.h + '"><b>' + esc(c.t) + "</b><span>" + esc(c.d) + "</span><em>" + esc(c.n) + "</em></a>";
    }).join("");
  }


  /* v6.4 现场掠影轮播 */
  function buildRot() {
    var box = $("#rotBox");
    if (!box) return;
    var pool = [];
    (window.XB_ACTIVITIES || []).forEach(function (a) {
      if ((a.photos || []).length) pool.push({ src: thumbOf(a.photos[0]), act: a });
    });
    if (!pool.length) { box.style.display = "none"; return; }
    var cur = 0, timer = null;
    box.innerHTML = pool.map(function (p2, i) {
      return '<img class="rot-img' + (i === 0 ? " on" : "") + '" src="' + webpOf(p2.src) +
        '" data-full="' + pic(p2.src) + '" data-fallback="' + p2.src +
        '" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="' + esc(p2.act.title) +
        '" data-photo data-cap="' + esc(p2.act.date + " · " + p2.act.title) + '"' + (i ? ' loading="lazy"' : "") + ' style="opacity:' + (i === 0 ? 1 : 0) + '">' +
        '<div class="rot-cap" style="opacity:' + (i === 0 ? 1 : 0) + '">' + esc(p2.act.date + " · " + p2.act.title) + "</div>";
    }).join("") + '<div class="rot-dots">' + pool.map(function (_, i) {
      return '<i data-i="' + i + '"' + (i === 0 ? ' class="on"' : "") + "></i>";
    }).join("") + "</div>";
    var imgs = box.querySelectorAll(".rot-img"), caps = box.querySelectorAll(".rot-cap"), dots = box.querySelectorAll(".rot-dots i");
    function show(i) {
      cur = (i + pool.length) % pool.length;
      imgs.forEach(function (im, k) { im.style.opacity = k === cur ? 1 : 0; });
      caps.forEach(function (cp, k) { cp.style.opacity = k === cur ? 1 : 0; });
      dots.forEach(function (d, k) { d.classList.toggle("on", k === cur); });
    }
    function auto() { timer = setInterval(function () { show(cur + 1); }, 4000); }
    dots.forEach(function (d) { d.addEventListener("click", function () { clearInterval(timer); show(+d.dataset.i); auto(); }); });
    box.addEventListener("click", function (e) {
      if (e.target.tagName === "IMG") { location.href = "gallery.html#meipianList"; }
    });
    auto();
    if (window.XB_CLOUD && XB_CLOUD.isReady()) {
      loadCloudData().then(function () {
        var np = [];
        (window.XB_ACTIVITIES || []).forEach(function (a) { if ((a.photos || []).length) np.push({ src: thumbOf(a.photos[0]), act: a }); });
        if (np.length !== pool.length) buildRot();
      });
    }
  }

  function renderDash() {
    var box = $("#dashGrid");
    if (!box) return;
    var acts = window.XB_ACTIVITIES || [];
    var chars = acts.reduce(function (n, a) { return n + (a.paras || []).join("").length; }, 0);
    var ph = acts.reduce(function (n, a) { return n + (a.photos || []).length; }, 0) + (D.site.gallery || []).length;
    var items = [
      { n: (D.officialWorks || []).length, l: "篇已发表作品" },
      { n: acts.length, l: "场活动档案" },
      { n: chars, l: "字活动原文" },
      { n: ph, l: "张现场照片" },
      { n: (window.XB_PEOPLE || []).length, l: "位记录在册者" },
      { n: (D.site.honors || []).length, l: "项荣誉" }
    ];
    box.innerHTML = items.map(function (i) {
      return '<div class="dash-cell"><b>' + i.n + "</b><span>" + i.l + "</span></div>";
    }).join("");
  }

  function renderGallery() {
    var box = $("#photoGrid");
    if (!box) return;
    box.innerHTML = (D.site.gallery || []).map(function (p) { return photoCard(p, true); }).join("");
    var note = $("#galleryNote");
    if (note) note.textContent = D.site.galleryNote || "";
    bindLightbox();
    renderMeipian();
  }

  function renderGalleryStrip() {
    var box = $("#galleryStrip");
    if (!box) return;
    box.innerHTML = (D.site.gallery || []).slice(0, 4).map(function (p) { return photoCard(p, false); }).join("");
    bindLightbox();
  }

  function init() {
    DATA.works = buildWorks();
    applyOverlay();
    var page = document.body.getAttribute("data-page");

    renderUserUI();
    bindChrome();
    bindHero();
    bindWorkActions();
    bindModals();
    observeReveals();

    if (window.XB_CLOUD) {
      XB_CLOUD.load()
        .then(function () { return XB_CLOUD.session(); })
        .then(function (s) {
          if (s && s.user) {
            CLOUD_USER = { name: s.user.email || s.user.name || "社员", email: s.user.email || "", cloud: true };
            renderUserUI();
          }
        })
        .catch(function () {});
    }

    if (page === "index") {
      renderTexts();
      renderIndexSections();
      renderFeatured();
      renderBars();
      renderTopics();
      renderGeo();
      renderGalleryStrip();
      renderDash();
      renderNavCards();
      buildRot();
      renderEvents();
      renderMembers();
      renderPortals();
      bindSearch();
      bindWorksEvents();
      bindDemoToggle();
      bindForm("#subForm", "#subOk", "submissions", "投稿已提交，我们将尽快审核", "提交投稿", true);
      bindForm("#memForm", "#memOk", "applications", "申请已提交，我们将尽快与您联系", "提交申请", true);
      gateAgree("#memForm", "#mAgree");
      bindForm("#joinForm", "#joinOk", "applications", "申请已提交，编辑部已收到，请留意联系方式", "提交申请", true);
      gateAgree("#joinForm", "#jAgree");
      if (DATA.source === "local-managed") {
        setSourceBadge();
        renderWorks(true);
      } else {
        var badge = $("#srcBadge");
        if (badge) { badge.textContent = "正在连接社团云端作品库…"; badge.className = "src-badge src-loading"; }
        showSkeleton();
        loadCloudData().then(function (cloud) {
          if (cloud) {
            renderWorks(true);
            renderEvents();
            renderMembers();
            renderFeatured();
            renderBars();
            renderTopics();
            setSourceBadge();
            toast("已连接社团云端作品库");
            return;
          }
          
          loadRemoteWorks().then(function (remote) {
            renderWorks(true);
            setSourceBadge();
            if (!remote) {
              var b = $("#srcBadge");
              if (b) b.textContent = "数据来源：本地示例数据（云端未连通）";
            }
          });
        });
      }
    }
    if (page === "work") renderWorkPage();
    if (page === "journal") renderJournal();
    if (page === "works") initWorksPage();
    if (page === "authors") initAuthorsPage();
    if (page === "issue") initIssuePage();
    if (page === "craft") initCraftPage();
    if (page === "reading") initReadingPage();
    if (page === "contest") initContestPage();
    buildCrumb();
    buildTOC();
    buildMobileBar();
    if (page === "search") initSearchPage();
    if (page === "gallery") renderGallery();
    if (page === "sections") renderSections();
    if (page === "tags") initTagsPage();
    if (page === "timeline") initTimelinePage();
    if (page === "activity") initActivityPage();
    if (page === "about") {
      renderPeople();
      renderBigTimeline();
      var ce = $("#catExport");
      if (ce) ce.addEventListener("click", function (e) {
        e.preventDefault();
        var rows = [["标题", "作者/出处", "说明"]].concat((D.site.catalog || []).map(function (c) {
          return [c.title || "", c.author || c.kind || "", c.where || ""];
        }));
        var csv = "\ufeff" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
        var b = new Blob([csv], { type: "text/csv" });
        var a2 = document.createElement("a");
        a2.href = URL.createObjectURL(b); a2.download = "xinbi-catalog.csv"; a2.click();
      });
    }
    if (page === "guide") initGuidePage();
    if (page === "about") initAboutPage();
    if (page === "journal") {
      loadCloudData().then(function (cloud) { if (cloud) { renderJournal(); } });
    }

    if (page === "index" || page === "work" || page === "journal" || page === "works" || page === "guide" || page === "about" || page === "authors" || page === "issue" || page === "contest" || page === "search" || page === "gallery" || page === "activity") {
      var y = $("#year");
      if (y) y.textContent = new Date().getFullYear();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
