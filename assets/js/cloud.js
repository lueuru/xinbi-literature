
window.XB_CLOUD = (function () {
  "use strict";

  function CFG() { return window.XB_CONFIG || {}; }

  var client = null;
  var sdkPromise = null;
  var state = { ready: false, reason: "", signedIn: false, user: null };

  function loadSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve) {
      var c = CFG();
      if (!c.cloudEnabled || !c.cloudEndpoint || !c.publishableKey) {
        state.reason = "未启用云端";
        return resolve(false);
      }
      if (window.WorkBuddyCloud) return resolve(true);
      
      var sources = [
        "assets/vendor/workbuddy-cloud.js",
        "https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js"
      ];
      var idx = 0;
      function tryLoad() {
        if (idx >= sources.length) {
          state.reason = "SDK 加载失败（本地与 CDN 均不可用）";
          return resolve(false);
        }
        var url = sources[idx++];
        var s = document.createElement("script");
        s.src = url;
        s.async = true;
        var done = false;
        var timer = setTimeout(function () {
          if (done) return;
          done = true;
          tryLoad();
        }, CFG().cloudTimeoutMs || 8000);
        s.onload = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (window.WorkBuddyCloud) {
            state.reason = "";
            resolve(true);
          } else {
            tryLoad();
          }
        };
        s.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          tryLoad();
        };
        document.head.appendChild(s);
      }
      tryLoad();
    });
    return sdkPromise;
  }

  function get() {
    if (client) return client;
    if (!window.WorkBuddyCloud) return null;
    try {
      client = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: CFG().cloudEndpoint,
        publishableKey: CFG().publishableKey
      });
    } catch (e) {
      client = null;
      state.reason = "客户端初始化失败";
    }
    return client;
  }

  function db() { var c = get(); return c ? c.database : null; }
  function auth() { var c = get(); return c ? c.auth : null; }

  async function fetchWorks() {
    var d = db(); if (!d) return null;
    var r = await d.from("works").select("*").order("id", { ascending: true });
    if (r.error) { state.reason = (r.error && r.error.message) || "读取作品失败"; return null; }
    state.ready = true;
    return r.data || [];
  }

  async function fetchContent(kind) {
    var d = db(); if (!d) return null;
    var r = await d.from("site_content").select("*").eq("kind", kind).order("sort", { ascending: true });
    if (r.error) { state.reason = (r.error && r.error.message) || "读取内容失败"; return null; }
    return r.data || [];
  }

  async function fetchSubmissions() {
    var d = db(); if (!d) return null;
    var r = await d.from("submissions").select("*").order("created_at", { ascending: false }).limit(100);
    if (r.error) return null;
    return r.data || [];
  }

  async function fetchComments(workId) {
    var d = db(); if (!d) return null;
    var r = await d.from("interactions").select("*").eq("kind", "comment").eq("work_id", workId)
      .order("created_at", { ascending: false });
    if (r.error) return null;
    return r.data || [];
  }

  async function fetchVotes() {
    var d = db(); if (!d) return null;
    var r = await d.from("interactions").select("work_id, owner_id").eq("kind", "vote");
    if (r.error) return null;
    return r.data || [];
  }

  async function fetchMyMarks(workId) {
    var d = db(); if (!d) return null;
    var r = await d.from("interactions").select("*").eq("work_id", workId).in("kind", ["like", "bookmark"]);
    if (r.error) return null;
    return r.data || [];
  }

  async function saveWork(row) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    var payload = {
      title: row.title,
      author: row.author,
      grade: row.grade || null,
      class_name: row.class_name || null,
      category: row.category || "prose",
      excerpt: row.excerpt || null,
      slug: row.slug || row.title,
      content: row.content || null
    };
    if (row.id) return await d.from("works").update(payload).eq("id", row.id).select();
    return await d.from("works").insert(payload).select();
  }

  async function deleteWork(id) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("works").delete().eq("id", id).select();
  }

  async function saveContent(kind, slug, title, body, sort) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("site_content").upsert(
      { kind: kind, slug: slug, title: title, body: body, sort: sort || 0 },
      { onConflict: "kind,slug" }
    ).select();
  }

  async function deleteContent(kind, slug) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("site_content").delete().eq("kind", kind).eq("slug", slug).select();
  }

  async function deleteSubmission(id) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("submissions").delete().eq("id", id).select();
  }

  async function updateSubmission(id) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("submissions").update({ read_at: new Date().toISOString() }).eq("id", id).select();
  }

  async function submit(rec) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    return await d.from("submissions").insert(rec);
  }

  async function markInteraction(workId, kind, on, payload) {
    var d = db(); if (!d) return { error: { message: "云端不可用" } };
    if (!on) {
      var del = await d.from("interactions").delete().eq("work_id", workId).eq("kind", kind).select();
      return del;
    }
    var row = { work_id: workId, kind: kind };
    if (payload) Object.keys(payload).forEach(function (k) { row[k] = payload[k]; });
    return await d.from("interactions").insert(row).select();
  }

  async function session() {
    var a = auth(); if (!a) return null;
    var r = await a.getSession();
    if (r.error || !r.data) { state.signedIn = false; state.user = null; return null; }
    state.signedIn = true;
    state.user = r.data && r.data.user ? r.data.user : null;
    return r.data;
  }

  async function signIn(email, password) {
    var a = auth(); if (!a) return { error: { message: "云端不可用" } };
    var r = await a.signInWithPassword({ email: email, password: password });
    if (!r.error) { state.signedIn = true; state.user = r.data && r.data.user; }
    return r;
  }

  async function sendOtp(email) {
    var a = auth(); if (!a) return { error: { message: "云端不可用" } };
    return await a.sendOtp({ email: email });
  }

  async function verifyOtp(payload) {
    var a = auth(); if (!a) return { error: { message: "云端不可用" } };
    var r = await a.verifyOtp(payload);
    if (!r.error) { state.signedIn = true; state.user = r.data && r.data.user; }
    return r;
  }

  async function signOut() {
    var a = auth(); if (!a) return;
    await a.signOut();
    state.signedIn = false;
    state.user = null;
  }

  function onAuthChange(cb) {
    var a = auth(); if (!a) return function () {};
    return a.onAuthStateChange(function (event, sess) {
      state.signedIn = !!sess;
      state.user = sess && sess.user ? sess.user : null;
      cb(event, sess);
    });
  }

  return {
    state: state,
    load: loadSdk,
    isReady: function () { return state.ready; },
    status: function () { return state.reason; },
    fetchWorks: fetchWorks,
    fetchContent: fetchContent,
    fetchSubmissions: fetchSubmissions,
    fetchComments: fetchComments,
    fetchMyMarks: fetchMyMarks,
    fetchVotes: fetchVotes,
    saveWork: saveWork,
    deleteWork: deleteWork,
    saveContent: saveContent,
    deleteContent: deleteContent,
    submit: submit,
    updateSubmission: updateSubmission,
    deleteSubmission: deleteSubmission,
    markInteraction: markInteraction,
    session: session,
    signIn: signIn,
    sendOtp: sendOtp,
    verifyOtp: verifyOtp,
    signOut: signOut,
    onAuthChange: onAuthChange
  };
})();
