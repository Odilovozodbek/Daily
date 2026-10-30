/* =========================================================
   KUNLIK REJA — dastur mantiqi (JavaScript)
   Tuzilishi:
   1. Sozlamalar va yordamchi funksiyalar
   2. Saqlash (localStorage)
   3. Holat va hisob-kitoblar
   4. Ekranga chizish (render)
   5. Amallar: qo'shish, tahrirlash, o'chirish, belgilash
   6. Xabarlar, eslatmalar va soat
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. Sozlamalar va yordamchi funksiyalar ---------- */
  var KEY = "kunlik-reja-v2";
  var RING_LENGTH = 238.76; // aylana uzunligi: 2 * pi * 38

  // Vazifa turlari: nomi va ikonka (index.html dagi #i-... bilan bir xil)
  var CATS = {
    kod:    { name: "Dasturlash", icon: "code" },
    dars:   { name: "Dars",       icon: "book" },
    sport:  { name: "Sport",      icon: "dumbbell" },
    dam:    { name: "Dam olish",  icon: "coffee" },
    boshqa: { name: "Boshqa",     icon: "star" }
  };
  var WEEK = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  var MONTH = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  var STATUS_TEXT = { done: "Bajarildi", now: "Hozir", wait: "Kutilmoqda", late: "O'tib ketdi" };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, "0"); }
  // Sanani "2026-10-09" ko'rinishiga o'tkazadi (saqlashda kalit sifatida)
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  // "09:30" -> 570 (kun boshidan o'tgan daqiqalar)
  function toMin(t) { var p = t.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  // 570 -> "09:30"
  function fromMin(m) { m = Math.max(0, Math.min(1439, m)); return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // 90 -> "1 soat 30 daq"
  function fmtDur(min) {
    var h = Math.floor(min / 60), m = min % 60, out = [];
    if (h) out.push(h + " soat");
    if (m || !h) out.push(m + " daq");
    return out.join(" ");
  }

  // HTML element yasash uchun yordamchi: el("div", {class: "x"}, ["matn", boshqaElement])
  // Matn textContent orqali qo'yiladi, shuning uchun foydalanuvchi yozgan matn xavfsiz.
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  // SVG ikonka yasaydi: icon("trash") -> <svg class="ico"><use href="#i-trash"/></svg>
  function icon(name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "ico");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#i-" + name);
    svg.appendChild(use);
    return svg;
  }

  /* ---------- 2. Saqlash (telefon yoki brauzer xotirasi) ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // state = { days: { "2026-10-09": [vazifa, ...] }, seeded: true, notify: false }
  var state = load() || { days: {}, seeded: false, notify: false };
  if (!state.days) state.days = {};

  // Birinchi ochilishda namuna vazifalar ("namuna" deb belgilanadi, keyin o'chirish mumkin)
  if (!state.seeded) {
    var samples = [
      ["Dasturlash: HTML va CSS mashqlari", "09:00", "11:00", "kod"],
      ["Tushlik va dam olish", "13:00", "14:00", "dam"],
      ["Darsga tayyorlanish", "15:00", "16:30", "dars"],
      ["Yugurish", "18:00", "18:45", "sport"]
    ];
    state.days[keyOf(new Date())] = samples.map(function (s) {
      return { id: uid(), title: s[0], start: s[1], end: s[2], cat: s[3], done: false, sample: true };
    });
    state.seeded = true;
    save();
  }

  /* ---------- 3. Holat va hisob-kitoblar ---------- */
  var view = new Date(); view.setHours(12, 0, 0, 0); // hozir ko'rilayotgan kun
  var editingId = null;                               // tahrirlanayotgan vazifa id si
  var notified = {};                                  // boshlanish xabari berilganlar
  var audioCtx = null;                                // tovush uchun

  function viewKey() { return keyOf(view); }
  function dayList(key) { return state.days[key] || (state.days[key] = []); }
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      return toMin(a.start) - toMin(b.start) || (a.end ? toMin(a.end) : 0) - (b.end ? toMin(b.end) : 0);
    });
  }
  function durOf(t) { return t.end ? toMin(t.end) - toMin(t.start) : 0; }

  // Vazifa holati: done | now | wait | late
  function statusOf(t, key, todayKey, nowMin) {
    if (t.done) return "done";
    if (key < todayKey) return "late";
    if (key > todayKey) return "wait";
    var s = toMin(t.start), e = t.end ? toMin(t.end) : s + 30;
    if (nowMin < s) return "wait";
    return nowMin < e ? "now" : "late";
  }

  // Vaqti bir-biriga kesishgan vazifalarning id lari
  function overlaps(list) {
    var ids = {};
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var ae = a.end ? toMin(a.end) : toMin(a.start) + 1;
        var be = b.end ? toMin(b.end) : toMin(b.start) + 1;
        if (toMin(a.start) < be && toMin(b.start) < ae) { ids[a.id] = true; ids[b.id] = true; }
      }
    }
    return ids;
  }

  /* ---------- 4. Ekranga chizish ---------- */
  function render() {
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var todayKey = keyOf(now);
    var key = viewKey();
    var isToday = key === todayKey;

    $("clock").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());

    // Sana sarlavhasi: "Juma, 9-oktabr" va pastida "bugun · 2026"
    var yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    var rel = "";
    if (isToday) rel = "bugun";
    else if (key === keyOf(yesterday)) rel = "kecha";
    else if (key === keyOf(tomorrow)) rel = "ertaga";
    var title = $("dateTitle");
    title.textContent = WEEK[view.getDay()] + ", " + view.getDate() + "-" + MONTH[view.getMonth()];
    title.appendChild(el("small", {}, [(rel ? rel + " · " : "") + view.getFullYear()]));
    $("todayBtn").disabled = isToday;

    var list = sorted(dayList(key));

    // Natijalar
    var done = list.filter(function (x) { return x.done; }).length;
    var total = list.length;
    var pct = total ? Math.round(done / total * 100) : 0;
    var planned = list.reduce(function (s, x) { return s + durOf(x); }, 0);
    var left = list.reduce(function (s, x) { return s + (x.done ? 0 : durOf(x)); }, 0);
    $("ringNum").textContent = pct + "%";
    $("ringFg").style.strokeDashoffset = String(RING_LENGTH * (1 - pct / 100));
    $("ring").setAttribute("aria-valuenow", String(pct));
    $("stDone").textContent = done + " / " + total;
    $("stPlan").textContent = fmtDur(planned);
    $("stLeft").textContent = fmtDur(left);

    renderNextUp(list, key, todayKey, nowMin);

    // Jadval
    var box = $("list");
    box.replaceChildren();
    if (!list.length) {
      box.appendChild(el("li", { class: "empty" }, [
        el("img", { src: "img/empty.svg", alt: "", width: "220", height: "165" }),
        el("strong", {}, ["Bu kun uchun reja yo'q"]),
        el("span", {}, ["Formadan birinchi vazifani qo'shing."])
      ]));
    } else {
      var clash = overlaps(list);
      var nowPlaced = !isToday; // "Hozir" chizig'i faqat bugun uchun
      list.forEach(function (task) {
        if (!nowPlaced && toMin(task.start) > nowMin) {
          box.appendChild(nowLine(now));
          nowPlaced = true;
        }
        box.appendChild(itemEl(task, statusOf(task, key, todayKey, nowMin), !!clash[task.id]));
      });
      if (!nowPlaced) box.appendChild(nowLine(now));
    }

    var hasSamples = Object.keys(state.days).some(function (k) {
      return state.days[k].some(function (x) { return x.sample; });
    });
    $("clearSamples").hidden = !hasSamples;
    updateNotifyButton();
  }

  // Yuqori qismdagi "Keyingi vazifa" matni
  function renderNextUp(list, key, todayKey, nowMin) {
    var out = $("nextUp");
    if (key !== todayKey) { out.textContent = list.length ? list.length + " ta vazifa rejalashtirilgan." : "Bu kunda reja yo'q."; return; }
    var current = null, upcoming = null;
    list.forEach(function (t) {
      if (t.done) return;
      var st = statusOf(t, key, todayKey, nowMin);
      if (st === "now" && !current) current = t;
      if (st === "wait" && !upcoming) upcoming = t;
    });
    if (current) {
      out.textContent = current.end
        ? "Hozir: " + current.title + ". Tugashiga " + fmtDur(toMin(current.end) - nowMin) + " qoldi."
        : "Hozir: " + current.title + ".";
    } else if (upcoming) {
      out.textContent = "Keyingi: " + upcoming.title + ", " + upcoming.start + " da. " + fmtDur(toMin(upcoming.start) - nowMin) + " qoldi.";
    } else if (list.length) {
      out.textContent = "Bugungi vazifalar tugadi. Yangi vazifa qo'shishingiz mumkin.";
    } else {
      out.textContent = "Bugun uchun birinchi vazifani qo'shing.";
    }
  }

  function nowLine(now) {
    return el("li", { class: "nowline mono", "aria-label": "Hozirgi vaqt" }, ["Hozir " + pad(now.getHours()) + ":" + pad(now.getMinutes())]);
  }

  // Bitta vazifa kartasi
  function itemEl(task, st, clash) {
    var cat = CATS[task.cat] || CATS.boshqa;

    var check = el("button", {
      class: "check", type: "button",
      "aria-pressed": String(task.done),
      "aria-label": (task.done ? "Bajarilmagan deb belgilash: " : "Bajarildi deb belgilash: ") + task.title,
      onclick: function () { toggle(task.id); }
    }, [icon("check")]);

    var meta = el("div", { class: "meta" }, [
      el("span", { class: "pill " + st }, [STATUS_TEXT[st]]),
      el("span", { class: "kind" }, [cat.name]),
      clash ? el("span", { class: "warn" }, [icon("warn"), "Vaqti kesishadi"]) : null,
      task.sample ? el("span", { class: "tag" }, ["namuna"]) : null
    ]);

    var acts = el("div", { class: "acts" }, [
      el("button", { class: "icon-btn", type: "button", "aria-label": "Tahrirlash: " + task.title, onclick: function () { startEdit(task.id); } }, [icon("pencil")]),
      el("button", { class: "icon-btn del", type: "button", "aria-label": "O'chirish: " + task.title, onclick: function () { remove(task.id); } }, [icon("trash")])
    ]);

    var range = task.end ? task.start + " – " + task.end : task.start;
    var when = el("div", { class: "when" }, [
      el("span", { class: "range mono" }, [range]),
      task.end ? el("span", {}, [fmtDur(durOf(task))]) : null
    ]);

    var cls = "item cat-" + (CATS[task.cat] ? task.cat : "boshqa") + (task.done ? " is-done" : "") + (st === "now" ? " is-now" : "");
    return el("li", { class: cls }, [
      el("div", { class: "tile" }, [icon(cat.icon)]),
      el("div", { class: "main" }, [when, el("div", { class: "name" }, [task.title]), meta, acts]),
      check
    ]);
  }

  /* ---------- 5. Amallar ---------- */
  function findTask(id) {
    return dayList(viewKey()).filter(function (x) { return x.id === id; })[0];
  }

  function toggle(id) {
    var t = findTask(id);
    if (!t) return;
    t.done = !t.done;
    save();
    render();
  }

  function remove(id) {
    var key = viewKey();
    var arr = dayList(key);
    var idx = arr.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    var removed = arr.splice(idx, 1)[0];
    if (editingId === id) stopEdit();
    save();
    render();
    toast("O'chirildi: " + removed.title, "Qaytarish", function () {
      var a = dayList(key);
      a.splice(Math.min(idx, a.length), 0, removed);
      save();
      render();
    });
  }

  function setFormTitle(text, iconName) {
    var h = $("formTitle");
    h.replaceChildren(icon(iconName), el("span", {}, [text]));
  }
  function setCat(value) {
    var radios = document.querySelectorAll('input[name="cat"]');
    radios.forEach(function (r) { r.checked = r.value === value; });
  }
  function getCat() {
    var r = document.querySelector('input[name="cat"]:checked');
    return r ? r.value : "boshqa";
  }

  function startEdit(id) {
    var t = findTask(id);
    if (!t) return;
    editingId = id;
    $("title").value = t.title;
    $("start").value = t.start;
    $("end").value = t.end || "";
    setCat(t.cat);
    setFormTitle("Vazifani tahrirlash", "pencil");
    $("submitBtn").textContent = "Saqlash";
    $("cancelBtn").hidden = false;
    $("formError").textContent = "";
    $("title").focus();
    $("taskForm").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function stopEdit() {
    editingId = null;
    setFormTitle("Yangi vazifa", "plus");
    $("submitBtn").textContent = "Qo'shish";
    $("cancelBtn").hidden = true;
    $("formError").textContent = "";
    $("title").value = "";
    setDefaults();
  }

  // Formadagi vaqtni to'ldiradi: keyingi yarim soat boshlanadi, davomiyligi 1 soat
  function setDefaults(fromMinute) {
    var now = new Date();
    var s = fromMinute !== undefined ? fromMinute : Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30;
    s = Math.min(s, 1380);
    $("start").value = fromMin(s);
    $("end").value = fromMin(Math.min(s + 60, 1439));
  }

  // Forma yuborilganda: tekshirish, keyin qo'shish yoki saqlash
  $("taskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var title = $("title").value.trim();
    var start = $("start").value;
    var end = $("end").value;
    var cat = getCat();
    var err = $("formError");

    if (!title) { err.textContent = "Vazifa nomini yozing."; $("title").focus(); return; }
    if (!start) { err.textContent = "Boshlanish vaqtini tanlang."; $("start").focus(); return; }
    if (end && toMin(end) <= toMin(start)) { err.textContent = "Tugash vaqti boshlanishdan keyin bo'lishi kerak."; $("end").focus(); return; }
    err.textContent = "";

    if (editingId) {
      var t = findTask(editingId);
      if (t) { t.title = title; t.start = start; t.end = end; t.cat = cat; delete t.sample; }
      stopEdit();
    } else {
      dayList(viewKey()).push({ id: uid(), title: title, start: start, end: end, cat: cat, done: false });
      $("title").value = "";
      setDefaults(end ? toMin(end) : toMin(start) + 60);
      $("title").focus();
    }
    save();
    render();
  });
  $("cancelBtn").addEventListener("click", stopEdit);

  // Kunlar bo'yicha o'tish
  function shift(n) {
    view.setDate(view.getDate() + n);
    if (editingId) stopEdit();
    render();
  }
  $("prevDay").addEventListener("click", function () { shift(-1); });
  $("nextDay").addEventListener("click", function () { shift(1); });
  $("todayBtn").addEventListener("click", function () {
    view = new Date(); view.setHours(12, 0, 0, 0);
    if (editingId) stopEdit();
    render();
  });

  $("clearSamples").addEventListener("click", function () {
    Object.keys(state.days).forEach(function (k) {
      state.days[k] = state.days[k].filter(function (x) { return !x.sample; });
    });
    save();
    render();
  });

  /* ---------- 6. Xabarlar, eslatmalar va soat ---------- */
  function toast(msg, actionLabel, action) {
    var node = el("div", { class: "toast", role: "status" }, [el("span", {}, [msg])]);
    if (actionLabel) {
      node.appendChild(el("button", { type: "button", onclick: function () { action(); node.remove(); } }, [actionLabel]));
    }
    $("toasts").appendChild(node);
    setTimeout(function () { node.remove(); }, actionLabel ? 6000 : 8000);
  }

  // Qisqa signal tovushi (foydalanuvchi "Eslatma" tugmasini bosgandan keyin ishlaydi)
  function beep() {
    try {
      if (!audioCtx) return;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
  }

  function updateNotifyButton() {
    var on = !!state.notify;
    $("notifyBtn").setAttribute("aria-pressed", String(on));
    $("notifyText").textContent = on ? "Eslatma yoqilgan" : "Eslatma";
  }

  // Eslatmani yoqish/o'chirish. Brauzer ruxsat so'rashi mumkin.
  $("notifyBtn").addEventListener("click", function () {
    state.notify = !state.notify;
    if (state.notify) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !audioCtx) audioCtx = new AC();
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      } catch (e) {}
      try {
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
      } catch (e) {}
      beep();
      toast("Eslatma yoqildi. Vazifa vaqti kelganda signal beriladi.");
    } else {
      toast("Eslatma o'chirildi.");
    }
    save();
    updateNotifyButton();
  });

  function announce(task) {
    toast("Boshlanish vaqti: " + task.title);
    if (!state.notify) return;
    beep();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Kunlik reja", { body: task.start + " — " + task.title, icon: "img/icon-192.png" });
      }
    } catch (e) {}
  }

  // Har 15 soniyada: soatni yangilaydi, vaqti kelgan vazifani e'lon qiladi
  function tick() {
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var todayKey = keyOf(now);
    (state.days[todayKey] || []).forEach(function (t) {
      var id = todayKey + t.id;
      if (!t.done && toMin(t.start) === nowMin && !notified[id]) {
        notified[id] = true;
        announce(t);
      }
    });
    render();
  }

  // Ishga tushirish
  setDefaults();
  render();
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });

  // Oflayn ishlashi uchun (faqat http/https orqali ochilganda; APK ichida kerak emas)
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
