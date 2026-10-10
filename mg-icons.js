/* MediaGrabber Pro – SVG icons instead of emoji, everywhere (main app, VIP, landing pages, installed app).
   Every emoji / pictograph that appears in the page text – including text created later by scripts – is replaced
   by a small inline SVG that takes the surrounding text colour. Where an icon cannot be shown (page title,
   dropdown options, placeholders, tooltips) the emoji is simply removed. Nothing is loaded from the network. */
(function () {
  'use strict';
  var P = {
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    filetext: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    box: '<path d="M21 16V8l-9-5-9 5v8l9 5z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M14 9l2 2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4a4 4 0 0 0 4-4C21 6 17 2 12 2z"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkcircle: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><polyline points="22 4 12 14 9 11"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    xcircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    left: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    right: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    lr: '<line x1="3" y1="12" x2="21" y2="12"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
    undo: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
    star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>',
    diamond: '<path d="M12 2l10 10-10 10L2 12z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M11 3L8 9l4 12 4-12-3-6"/>',
    sparkle: '<path d="M12 2l2.2 7.3L22 12l-7.8 2.7L12 22l-2.2-7.3L2 12l7.8-2.7z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    crown: '<path d="M2 18l2-10 5 5 3-9 3 9 5-5 2 10z"/><line x1="2" y1="21" x2="22" y2="21"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    compress: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/>',
    wifi: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    play: '<polygon points="6 4 20 12 6 20"/>',
    back: '<polygon points="18 4 4 12 18 20"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.6 1 1.4 1 2.3h6c0-.9.4-1.7 1-2.3A7 7 0 0 0 12 2z"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    flame: '<path d="M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    eject: '<polygon points="5 15 12 5 19 15"/><line x1="5" y1="19" x2="19" y2="19"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    access: '<circle cx="12" cy="4" r="2"/><path d="M12 7v6l4 4M12 13l-4 4M6 9h12"/>',
    infinity: '<path d="M12 12c2-2.7 3.5-4 5.5-4a4 4 0 0 1 0 8c-2 0-3.5-1.3-5.5-4zm0 0c-2-2.7-3.5-4-5.5-4a4 4 0 0 0 0 8c2 0 3.5-1.3 5.5-4z"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>',
    flask: '<path d="M9 3h6M10 3v6L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-11V3"/>',
    ruler: '<path d="M3 21V3l18 18z"/>'
  };
  var FILLED = { star: 1, diamond: 1, sparkle: 1, play: 1, back: 1, bolt: 0 };
  var OUTLINE_VARIANT = { '\u2606': 'star', '\u2727': 'sparkle' };       // ☆ ✧ stay outlined
  var MAP = {
    '\u2726': ['sparkle', 1], '\u2727': ['sparkle'], '\u2728': ['sparkle', 1], '\u2715': ['x'], '\u2716': ['x'], '\u274C': ['xcircle'], '\u26A0': ['alert'],
    '\u2190': ['left'], '\u2192': ['right'], '\u2191': ['up'], '\u2194': ['lr'], '\u21BB': ['refresh'], '\u21A9': ['undo'],
    '\u2605': ['star', 1], '\u2B50': ['star', 1], '\u2606': ['star'], '\u25C6': ['diamond', 1], '\u2713': ['check'], '\u2714': ['check'], '\u2705': ['checkcircle'],
    '\uD83D\uDD12': ['lock'], '\uD83D\uDD13': ['unlock'], '\uD83D\uDD11': ['key'], '\uD83D\uDCC4': ['file'], '\uD83D\uDCDD': ['filetext'], '\uD83D\uDCCB': ['clipboard'],
    '\uD83D\uDCD5': ['book'], '\uD83D\uDCD6': ['book'], '\uD83D\uDCDA': ['book'], '\uD83D\uDCC1': ['folder'], '\uD83D\uDCC2': ['folder'], '\uD83D\uDCE6': ['box'],
    '\uD83D\uDCBE': ['save'], '\uD83C\uDFA8': ['palette'], '\u26A1': ['bolt'], '\uD83D\uDD0D': ['search'], '\uD83D\uDD2C': ['search'], '\uD83D\uDDBC': ['image'],
    '\u2702': ['scissors'], '\uD83D\uDCF2': ['download'], '\u2B07': ['download'], '\uD83D\uDCE5': ['download'], '\uD83D\uDCE4': ['upload'], '\uD83D\uDCAC': ['message'],
    '\uD83D\uDC51': ['crown'], '\uD83D\uDC64': ['user'], '\uD83D\uDDDC': ['compress'], '\u2709': ['mail'], '\uD83D\uDCE7': ['mail'], '\uD83D\uDCE1': ['wifi'],
    '\uD83D\uDCDE': ['phone'], '\uD83D\uDD58': ['clock'], '\uD83D\uDD52': ['clock'], '\u23F3': ['hourglass'], '\uD83D\uDDD1': ['trash'], '\uD83D\uDCF7': ['camera'],
    '\u25B6': ['play', 1], '\u25C0': ['back', 1], '\uD83D\uDE80': ['rocket'], '\uD83D\uDD14': ['bell'], '\uD83E\uDDE0': ['cpu'], '\uD83D\uDCA1': ['bulb'],
    '\uD83D\uDC8E': ['gem'], '\uD83D\uDC63': ['dot', 1], '\uD83C\uDF10': ['globe'], '\uD83C\uDF0D': ['globe'], '\uD83C\uDF19': ['moon'], '\u2600': ['sun'],
    '\uD83D\uDD19': ['left'], '\uD83D\uDD17': ['link'], '\uD83D\uDD25': ['flame'], '\u2795': ['plus'], '\u23CF': ['eject'], '\uD83D\uDEE1': ['shield'],
    '\u2328': ['keyboard'], '\u267F': ['access'], '\u267E': ['infinity'], '\uD83D\uDCCD': ['pin'], '\u2699': ['gear'], '\uD83D\uDEAB': ['ban'],
    '\uD83E\uDDEA': ['flask'], '\uD83D\uDCD0': ['ruler']
  };
  var keys = Object.keys(MAP).map(function (k) { return k.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'); }).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.join('|') + ')\\uFE0F?', 'g');
  // anything pictographic that has no icon is removed so no emoji can ever show
  var LEFT = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  var ANY = new RegExp(RE.source + '|' + LEFT.source, 'gu');
  var TEST = new RegExp(RE.source + '|' + LEFT.source, 'u');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, SVG: 1, svg: 1, CODE: 0 };
  var STRIP = { OPTION: 1, TITLE: 1 };

  function svg(name, filled) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'mg-i'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('fill', filled ? 'currentColor' : 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('style', 'width:1.1em;height:1.1em;vertical-align:-.18em;display:inline-block;flex:none;margin:0 .12em');
    s.innerHTML = P[name] || P.dot;
    return s;
  }
  function stripText(t) { return t.replace(ANY, '').replace(/\s{2,}/g, ' ').replace(/^\s+(?=\S)/, function (m) { return m; }); }

  function handleText(node) {
    var v = node.nodeValue; if (!v || !TEST.test(v)) return;
    var p = node.parentNode; if (!p) return;
    var tag = p.nodeName;
    if (STRIP[tag]) { node.nodeValue = v.replace(ANY, '').replace(/^\s+/, ''); return; }
    if (SKIP[tag] || (p.isContentEditable)) return;
    var frag = document.createDocumentFragment(), last = 0, m;
    ANY.lastIndex = 0;
    while ((m = ANY.exec(v))) {
      if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
      var ch = m[0].replace(/\uFE0F/g, ''), spec = MAP[ch];
      if (spec) frag.appendChild(svg(spec[0], spec[1]));
      last = m.index + m[0].length;
    }
    if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
    p.replaceChild(frag, node);
  }
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'label'];
  function handleAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && TEST.test(v)) el.setAttribute(ATTRS[i], v.replace(ANY, '').replace(/^\s+/, ''));
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { handleText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP[root.nodeName]) return; handleAttrs(root); }
    var tw = document.createTreeWalker(root, 5 /* elements + text */, null), n, texts = [];
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) texts.push(n);
      else if (SKIP[n.nodeName]) { /* children skipped below */ } else handleAttrs(n);
    }
    texts.forEach(handleText);
  }
  function stripTitle() { if (document.title && TEST.test(document.title)) document.title = document.title.replace(ANY, '').trim(); }

  var obs = new MutationObserver(function (list) {
    obs.disconnect();
    try {
      list.forEach(function (m) {
        if (m.type === 'characterData') handleText(m.target);
        else if (m.type === 'attributes') handleAttrs(m.target);
        else m.addedNodes.forEach(walk);
      });
      stripTitle();
    } finally { start(); }
  });
  function start() { obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
  start();
  function full() { walk(document.documentElement); stripTitle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', full); else full();
  window.mgIcons = { walk: walk };
})();
