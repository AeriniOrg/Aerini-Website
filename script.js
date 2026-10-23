(function(){
  "use strict";
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if(nav){
    var navScrolled = false;
    window.addEventListener('scroll', function(){
      var scrolled = window.scrollY > 8;
      if(scrolled === navScrolled) return;
      navScrolled = scrolled;
      nav.classList.toggle('is-scrolled', scrolled);
    }, { passive:true });
  }
  /* The menu is a full-screen drawer below the breakpoint in styles.css. While it is open the page behind it is
     locked (html.nav-open), and it closes on Escape, on choosing a link, and when the viewport grows past the
     breakpoint, so a stale open state never survives a rotation. */
  if(nav && navToggle){
    var setNav = function(open){
      nav.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    navToggle.addEventListener('click', function(){ setNav(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && nav.classList.contains('is-open')){ setNav(false); navToggle.focus(); }
    });
    if(navLinks){
      navLinks.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setNav(false); }); });
    }
    var wideMQ = window.matchMedia('(min-width: 1041px)');
    var onWide = function(){ if(wideMQ.matches) setNav(false); };
    if(wideMQ.addEventListener) wideMQ.addEventListener('change', onWide);
    else if(wideMQ.addListener) wideMQ.addListener(onWide);
  }

  /* ---------- year ---------- */
  var yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- checkout link guard ---------- */
  document.querySelectorAll('[data-checkout-fallback]').forEach(function(a){
    if(a.getAttribute('href').indexOf('__') === 0){
      a.removeAttribute('data-polar-checkout');
      a.href = a.getAttribute('data-checkout-fallback');
      a.textContent = 'Email us to buy a license';
      a.title = 'Online checkout isn\'t live yet — this opens an email instead.';
    }
  });

  /* ---------- scroll reveal ---------- */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin:'0px 0px -60px 0px' });
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('is-visible'); });
  }

  /* ---------- fact ticker ---------- */
  var facts = [
    '40 BUILT-IN NODES', 'AGPL-3.0 LICENSED', 'ZERO TELEMETRY', 'RUST WORKFLOW ENGINE',
    'WASM-SANDBOXED PLUGINS', 'MCP SERVER FOR AI AGENTS', 'NO ACCOUNT REQUIRED', 'WINDOWS · MACOS · LINUX · ARM', 'RUNS AS A DESKTOP APP OR HEADLESS SERVER'
  ];
  var tickerEl = document.getElementById('ticker');
  if(tickerEl){
    for(var r=0;r<2;r++){ facts.forEach(function(f){ var sp = document.createElement('span'); sp.textContent = f; tickerEl.appendChild(sp); }); }
  }

  /* ---------- copy buttons for command snippets ---------- */
  document.querySelectorAll('[data-copy-target]').forEach(function(btn){
    var label = btn.textContent, timer;
    function flash(text, ok){
      btn.textContent = text;
      btn.classList.toggle('is-done', ok);
      clearTimeout(timer);
      timer = setTimeout(function(){ btn.textContent = label; btn.classList.remove('is-done'); }, 2200);
    }
    btn.addEventListener('click', function(){
      var src = document.getElementById(btn.getAttribute('data-copy-target'));
      if(!src) return;
      var text = src.textContent;
      function selectIt(){
        var range = document.createRange(); range.selectNodeContents(src);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        flash('Selected: copy it', false);
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){ flash('Copied', true); }, selectIt);
      } else { selectIt(); }
    });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(function(item, i){
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    a.id = 'faq-a-' + i;
    q.setAttribute('aria-expanded', 'false');
    q.setAttribute('aria-controls', a.id);
    q.addEventListener('click', function(){
      var isOpen = item.classList.contains('is-open');
      document.querySelectorAll('.faq-item.is-open').forEach(function(other){
        if(other!==item){ other.classList.remove('is-open'); other.querySelector('.faq-q').setAttribute('aria-expanded', 'false'); }
      });
      item.classList.toggle('is-open', !isOpen);
      q.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
  });

  /* ---------- smart download ---------- */
  var GH_REPO = 'Panchak2d/Aerini';
  var repoArchived = false;
  var DOWNLOAD_PREFIX = 'https://github.com/' + GH_REPO + '/releases/download/';
  var TAG_RE = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/;
  var ASSET_PATTERN = { windows: /-setup\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
  var OS_LABEL = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  var RELEASE_CACHE_KEY = 'aerini_release', RELEASE_TTL = 60*60*1000;

  /* Phones, tablets and Chromebooks cannot run the desktop installers: return null so the generic CTA stays. */
  function detectOS(){
    var ua = navigator.userAgent || '', plat = navigator.platform || '';
    if(/Android|iPhone|iPad|iPod|CrOS/.test(ua)) return null;
    if(/Win/.test(plat) || /Windows/.test(ua)) return 'windows';
    if(/Mac/.test(plat) || /Macintosh/.test(ua)) return (navigator.maxTouchPoints > 1) ? null : 'macos'; /* iPadOS reports a Mac platform */
    if(/Linux|X11/.test(plat) || /Linux/.test(ua)) return 'linux';
    return null;
  }
  var linuxArm = /aarch64|arm64|armv[78]/i.test((navigator.userAgent || '') + ' ' + (navigator.platform || ''));

  function findAsset(assets, os){
    var candidates = [];
    for(var i=0;i<assets.length;i++){ if(ASSET_PATTERN[os].test(assets[i].name)) candidates.push(assets[i]); }
    if(candidates.length < 2) return candidates[0] || null;
    var wantArm = (os === 'macos') || (os === 'linux' && linuxArm);
    for(var j=0;j<candidates.length;j++){
      if(/arm64|aarch64/i.test(candidates[j].name) === wantArm) return candidates[j];
    }
    return candidates[0];
  }

  /* Only accept installer URLs that live under this repository's release downloads. */
  function trustedAssets(list){
    var out = [];
    (list || []).forEach(function(a){
      if(a && typeof a.name === 'string' && typeof a.url === 'string' && a.url.indexOf(DOWNLOAD_PREFIX) === 0 && /^[\w.+\-]+$/.test(a.name)) out.push({ name: a.name, url: a.url });
    });
    return out;
  }

  function readReleaseCache(){
    try{
      var c = JSON.parse(localStorage.getItem(RELEASE_CACHE_KEY) || 'null');
      if(c && typeof c.ts === 'number' && Date.now() - c.ts < RELEASE_TTL && TAG_RE.test(c.tag)) return c;
    } catch(e){}
    return null;
  }
  function writeReleaseCache(tag, assets){
    try{ localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ ts: Date.now(), tag: tag, assets: assets })); } catch(e){}
  }

  /* MCP archives are named <program>_<version>_<target>.tar.gz (.zip on Windows). Matching the program name up to
     the underscore keeps "aerini-mcp" from picking up "aerini-mcp-offline". */
  function findMcpAsset(assets, program, target){
    for(var i=0;i<assets.length;i++){
      var n = assets[i].name;
      if(n.indexOf(program + '_') === 0 && /\.(tar\.gz|zip)$/.test(n) && n.indexOf('_' + target + '.') > 0) return assets[i];
    }
    return null;
  }

  function findAssetByName(assets, name){
    for(var i=0;i<assets.length;i++){ if(assets[i].name === name) return assets[i]; }
    return null;
  }

  function applyMcpLinks(assets){
    var links = document.querySelectorAll('a[data-mcp-target]');
    for(var i=0;i<links.length;i++){
      var isSum = links[i].hasAttribute('data-mcp-sha');
      var program = links[i].getAttribute(isSum ? 'data-mcp-sha' : 'data-mcp');
      var asset = findMcpAsset(assets, program, links[i].getAttribute('data-mcp-target'));
      if(asset && isSum) asset = findAssetByName(assets, asset.name + '.sha256');
      if(!asset) continue;
      links[i].href = asset.url;
      links[i].removeAttribute('target');
      links[i].removeAttribute('rel');
    }
  }

  function applyRelease(tag, assets, ctas, cards, detected){
    cards.forEach(function(card){
      var os = card.getAttribute('data-platform');
      var asset = findAsset(assets, os);
      var link = card.querySelector('a');
      if(!asset || !link) return;
      link.href = asset.url;
      link.textContent = 'Download ' + tag + ' \u2192';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    });
    applyMcpLinks(assets);
    if(detected){
      var heroAsset = findAsset(assets, detected);
      if(heroAsset){
        ctas.forEach(function(cta){
          cta.href = heroAsset.url;
          var label = cta.querySelector('.cta-label');
          if(label) label.textContent = 'Get Aerini for ' + OS_LABEL[detected];
        });
      }
    }
  }

  var GH_RELEASES_LIST_API = 'https://api.github.com/repos/' + GH_REPO + '/releases?per_page=5';

  function normalizeRelease(tag, list){
    if(typeof tag !== 'string' || !TAG_RE.test(tag)) return null;
    var assets = trustedAssets(list);
    return assets.length ? { tag: tag, assets: assets } : null;
  }

  /* 1. release.json: written at deploy time from the newest published release (pre-releases included). Same
        origin, so no third-party request and no API rate limit. */
  function releaseFromSite(){
    return fetch('release.json', { cache: 'no-cache' })
      .then(function(res){ if(!res.ok) throw new Error('no release.json'); return res.json(); })
      .then(function(r){ return normalizeRelease(r && r.tag, r && r.assets); });
  }

  /* 2. GitHub API fallback (local dev, or the deploy step could not reach GitHub). The list endpoint is used
        instead of /releases/latest because that one skips pre-releases, which would break the buttons for a
        pre-1.0 project. Cached for an hour to stay far below the unauthenticated rate limit. */
  function releaseFromApi(){
    var cached = readReleaseCache();
    if(cached) return Promise.resolve(normalizeRelease(cached.tag, cached.assets));
    return fetch(GH_RELEASES_LIST_API, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function(res){ if(!res.ok) throw new Error('release lookup failed'); return res.json(); })
      .then(function(list){
        for(var i=0;i<list.length;i++){
          if(!list[i] || list[i].draft) continue;
          var rel = normalizeRelease(list[i].tag_name, (list[i].assets || []).map(function(a){ return { name: a.name, url: a.browser_download_url }; }));
          if(rel){ writeReleaseCache(rel.tag, rel.assets); return rel; }
        }
        return null;
      });
  }

  function initSmartDownload(){
    var ctas = document.querySelectorAll('[data-role="get-aerini-cta"]');
    var cards = document.querySelectorAll('[data-platform]');
    var detected = detectOS();
    if(!('fetch' in window)) return;
    if(!ctas.length && !cards.length) return;

    releaseFromSite()
      .catch(function(){ return null; })
      .then(function(rel){ return rel || releaseFromApi(); })
      .then(function(rel){ if(rel) applyRelease(rel.tag, rel.assets, ctas, cards, detected); })
      /* Repo private, no release published yet, offline, or GitHub API
         rate-limited: every CTA and platform card already has a working
         fallback href in the markup, so there is nothing to recover here. */
      .catch(function(){});
  }
  initSmartDownload();

  /* ---------- node graph builder (shared by hero + demo) ---------- */
  function buildGraph(container, opts){
    container.innerHTML = ''; /* safe to call again on resize: clears the previous build first */
    var w = container.clientWidth, h = container.clientHeight;
    var positions = opts.positions;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS,'svg');
    svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
    svg.style.position='absolute'; svg.style.inset='0';
    container.appendChild(svg);

    function wirePath(a,b){
      if(opts.vertical){
        var x1=a.x+a.w/2, y1=a.y+(a.h||64), x2=b.x+b.w/2, y2=b.y;
        var my=(y1+y2)/2;
        return 'M'+x1+','+y1+' C'+x1+','+my+' '+x2+','+my+' '+x2+','+y2;
      }
      var hx1=a.x+a.w, hy1=a.y+22, hx2=b.x, hy2=b.y+22;
      var hmx=(hx1+hx2)/2;
      return 'M'+hx1+','+hy1+' C'+hmx+','+hy1+' '+hmx+','+hy2+' '+hx2+','+hy2;
    }

    var wires = [];
    opts.edges.forEach(function(edge){
      var a = positions[edge[0]], b = positions[edge[1]];
      var path = document.createElementNS(svgNS,'path');
      path.setAttribute('d', wirePath(a,b));
      path.setAttribute('class','hg-wire');
      path.setAttribute('stroke-dasharray', opts.dashed ? '4 4' : 'none');
      svg.appendChild(path);
      var pulse = document.createElementNS(svgNS,'circle');
      pulse.setAttribute('r','3.5'); pulse.setAttribute('class','hg-pulse');
      svg.appendChild(pulse);
      wires.push({ path: path, pulse: pulse, len: path.getTotalLength() });
    });

    var nodeEls = {};
    Object.keys(positions).forEach(function(key){
      var p = positions[key];
      var el = document.createElement('div');
      el.className = 'hg-node';
      el.style.left = p.x+'px'; el.style.top = p.y+'px'; el.style.width = p.w+'px';
      el.innerHTML =
        '<div class="hg-node-head"><span class="name">'+p.title+'</span><span class="hg-port" data-role="port"></span></div>'+
        '<div class="hg-node-body" data-role="body">'+p.body+'</div>';
      container.appendChild(el);
      nodeEls[key] = el;
    });

    return { wires: wires, nodes: nodeEls };
  }

  function animateRun(graph, order, onStep, onDone){
    if(reduceMotion){
      order.forEach(function(k){ var n=graph.nodes[k]; if(n) n.querySelector('[data-role=port]').classList.add('live'); });
      graph.wires.forEach(function(w){ w.path.classList.add('live'); });
      if(onDone) onDone();
      return;
    }
    var i = 0;
    function step(){
      if(i >= order.length){ if(onDone) onDone(); return; }
      var key = order[i];
      var n = graph.nodes[key];
      if(n) n.querySelector('[data-role=port]').classList.add('live');
      if(onStep) onStep(key, i);
      if(i < graph.wires.length){
        var w = graph.wires[i];
        w.path.classList.add('live');
        w.pulse.style.opacity = '1';
        var t0 = null;
        function frame(ts){
          if(!t0) t0 = ts;
          var p = Math.min((ts-t0)/650, 1);
          var pt = w.path.getPointAtLength(p * w.len);
          w.pulse.setAttribute('cx', pt.x); w.pulse.setAttribute('cy', pt.y);
          if(p < 1) requestAnimationFrame(frame);
          else { w.pulse.style.opacity = '0'; i++; setTimeout(step, 120); }
        }
        requestAnimationFrame(frame);
      } else { i++; setTimeout(step, 120); }
    }
    step();
  }

  /* ---------- run once fonts are loaded and a layout pass has completed ---------- */
  function whenLayoutSettled(fn){
    function run(){ requestAnimationFrame(function(){ requestAnimationFrame(fn); }); }
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(run); } else { run(); }
  }

  /* ---------- hero mini graph (ambient, auto-loops) ---------- */
  var heroCanvas = document.getElementById('heroCanvas');
  var heroGen = 0;
  /* single observer for the life of the page (not recreated per initHeroGraph
     call) so a resize rebuild can't pile up duplicate observers on the same
     element; heroLoop reads this instead of animating while off-screen */
  var heroVisible = false;
  if(heroCanvas && 'IntersectionObserver' in window){
    new IntersectionObserver(function(entries){ heroVisible = entries[0].isIntersecting; }, { threshold:0.01 }).observe(heroCanvas);
  } else if(heroCanvas){
    heroVisible = true;
  }
  var graphBuiltWidth = 0;
  function initHeroGraph(){
    if(!heroCanvas) return;
    graphBuiltWidth = document.documentElement.clientWidth;
    var gen = ++heroGen;
    var hw = heroCanvas.clientWidth, hh = heroCanvas.clientHeight;
    var hIsNarrow = hw < 420;
    var hCard = 128;
    var heroPositions;
    if(hIsNarrow){
      var hNarrowW = hw - 32;
      heroPositions = {
        start: { x: 16, y: 16,  w:hNarrowW, h:64, title:'Start', body:'trigger · manual' },
        fetch: { x: 16, y: 144, w:hNarrowW, h:64, title:'Fetch Data', body:'action · https' },
        show:  { x: 16, y: 272, w:hNarrowW, h:64, title:'Show Result', body:'utility · display' }
      };
    } else {
      heroPositions = {
        start: { x: 14,             y: hh*0.20, w:hCard, title:'Start', body:'trigger · manual' },
        fetch: { x: (hw-hCard)/2,   y: hh*0.42, w:hCard, title:'Fetch Data', body:'action · https' },
        show:  { x: hw-hCard-14,    y: hh*0.64, w:hCard, title:'Show Result', body:'utility · display' }
      };
    }
    var heroGraph = buildGraph(heroCanvas, { positions: heroPositions, edges: [['start','fetch'],['fetch','show']], vertical: hIsNarrow });
    function heroLoop(){
      if(gen !== heroGen) return;
      if(!heroVisible){ setTimeout(heroLoop, 1800); return; }
      Object.keys(heroGraph.nodes).forEach(function(k){ heroGraph.nodes[k].querySelector('[data-role=port]').classList.remove('live'); });
      heroGraph.wires.forEach(function(w){ w.path.classList.remove('live'); });
      animateRun(heroGraph, ['start','fetch','show'], null, function(){
        if(gen === heroGen) setTimeout(heroLoop, 1800);
      });
    }
    setTimeout(heroLoop, 900);
  }
  whenLayoutSettled(initHeroGraph);

  /* ---------- interactive "how it works" demo ---------- */
  var demoCanvas = document.getElementById('demoCanvas');
  var demoRunBtn = document.getElementById('demoRun');
  var demoStatusLine = document.getElementById('demoStatusLine');
  var demoMemLine = document.getElementById('demoMemLine');
  var demoGraph = null, demoGen = 0, demoRunning = false;

  function initDemoGraph(){
    if(!demoCanvas) return;
    graphBuiltWidth = document.documentElement.clientWidth;
    var gen = ++demoGen;
    var dw = demoCanvas.clientWidth, dh = demoCanvas.clientHeight;
    var isNarrow = dw < 620;
    var narrowW = dw - 32;
    var demoPositions = isNarrow ? {
      start: { x: 16, y: 20,  w:narrowW, h:64, title:'Start', body:'{&quot;ts&quot;: pending}' },
      fetch: { x: 16, y: 148, w:narrowW, h:64, title:'Fetch Data', body:'GET /status' },
      show:  { x: 16, y: 276, w:narrowW, h:64, title:'Show Result', body:'awaiting run…' }
    } : {
      start: { x: 30,        y: dh/2-24, w:172, title:'Start', body:'{&quot;ts&quot;: pending}' },
      fetch: { x: dw/2-86,   y: dh/2-24, w:172, title:'Fetch Data', body:'GET /status' },
      show:  { x: dw-200,    y: dh/2-24, w:172, title:'Show Result', body:'awaiting run…' }
    };
    demoCanvas.style.height = isNarrow ? '380px' : '';
    var graph = buildGraph(demoCanvas, { positions: demoPositions, edges: [['start','fetch'],['fetch','show']], vertical: isNarrow });
    Object.keys(graph.nodes).forEach(function(k){
      var el = graph.nodes[k]; el.classList.add('demo-node');
      el.querySelector('.hg-node-head').classList.add('demo-node-head');
      el.querySelector('[data-role=body]').classList.add('demo-node-body');
    });
    demoGraph = graph;
    demoRunning = false;
    if(gen === demoGen && demoRunBtn) demoRunBtn.classList.remove('running');
  }
  whenLayoutSettled(initDemoGraph);

  if(demoCanvas && demoRunBtn){
    demoRunBtn.addEventListener('click', function(){
      if(demoRunning || !demoGraph) return;
      var gen = demoGen, graph = demoGraph;
      demoRunning = true;
      demoRunBtn.classList.add('running');
      demoStatusLine.innerHTML = 'STATUS <b>running</b>';

      Object.keys(graph.nodes).forEach(function(k){ graph.nodes[k].querySelector('[data-role=port]').classList.remove('live'); });
      graph.wires.forEach(function(w){ w.path.classList.remove('live'); });

      var now = new Date();
      var ts = now.toISOString().slice(0,19).replace('T',' ');

      animateRun(graph, ['start','fetch','show'], function(key){
        if(key==='start'){ graph.nodes.start.querySelector('[data-role=body]').textContent = '{"ts": "'+ts+'"}'; }
        if(key==='fetch'){ graph.nodes.fetch.querySelector('[data-role=body]').textContent = '200 OK · 0.4s'; demoMemLine.innerHTML = 'MEM <b>18.2 KB</b>'; }
        if(key==='show'){ graph.nodes.show.querySelector('[data-role=body]').textContent = 'rendered at '+ts.slice(11); }
      }, function(){
        if(gen !== demoGen) return;
        demoRunning = false;
        demoRunBtn.classList.remove('running');
        demoStatusLine.innerHTML = 'STATUS <b>success</b>';
      });
    });
  }

  /* ---------- rebuild both graphs when the width changes; ASCII canvases handle their own resize below, these need it separately since they position nodes in px, not on a canvas grid. Height-only resizes (mobile address bar showing/hiding while scrolling) change nothing they depend on, so they are ignored ---------- */
  var graphResizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(graphResizeTimer);
    graphResizeTimer = setTimeout(function(){
      if(document.documentElement.clientWidth === graphBuiltWidth) return;
      initHeroGraph(); initDemoGraph();
    }, 200);
  });

  /* ---------- mobile mode flag ---------- */
  var mobileMQ = window.matchMedia('(max-width: 640px)');
  function syncMobileFlag(){ document.body.classList.toggle('is-mobile', mobileMQ.matches); }
  syncMobileFlag();
  if(mobileMQ.addEventListener) mobileMQ.addEventListener('change', syncMobileFlag);
  else if(mobileMQ.addListener) mobileMQ.addListener(syncMobileFlag);

  /* ---------- mobile bottom CTA bar ---------- */
  var mobileCtaBar = document.getElementById('mobileCtaBar');
  var getAerini = document.getElementById('get-aerini');
  var heroEl = document.querySelector('.hero');
  var footerEl = document.querySelector('footer');
  var mobileCtaLink = mobileCtaBar && mobileCtaBar.querySelector('a');
  if(mobileCtaLink) mobileCtaLink.tabIndex = -1;
  if(mobileCtaBar && getAerini && heroEl && footerEl && 'IntersectionObserver' in window){
    var pastHero = false, atTarget = false, atFooter = false;
    function syncCta(){
      var visible = pastHero && !atTarget && !atFooter;
      mobileCtaBar.classList.toggle('is-visible', visible);
      if(mobileCtaLink) mobileCtaLink.tabIndex = visible ? 0 : -1;
    }
    new IntersectionObserver(function(entries){ pastHero = !entries[0].isIntersecting; syncCta(); }).observe(heroEl);
    new IntersectionObserver(function(entries){ atTarget = entries[0].isIntersecting; syncCta(); }).observe(getAerini);
    new IntersectionObserver(function(entries){ atFooter = entries[0].isIntersecting; syncCta(); }).observe(footerEl);
  }

  /* ---------- card hover spotlight (desktop) / tap flash (touch) ---------- */
  (function(){
    var spotEls = document.querySelectorAll('.ladder-step, .poll-card, .license-card, .cap-card, .platform-card, .support-col');
    if(!spotEls.length) return;
    spotEls.forEach(function(el){ el.classList.add('spot'); });
    var fineHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var pending = null, frameQueued = false;
    function paintSpot(){
      frameQueued = false;
      var p = pending;
      pending = null;
      if(!p) return;
      var rect = p.el.getBoundingClientRect();
      p.el.style.setProperty('--mx', ((p.x-rect.left)/rect.width*100)+'%');
      p.el.style.setProperty('--my', ((p.y-rect.top)/rect.height*100)+'%');
    }
    function queueSpot(el, e){
      pending = { el: el, x: e.clientX, y: e.clientY };
      if(!frameQueued){ frameQueued = true; requestAnimationFrame(paintSpot); }
    }
    if(fineHover){
      document.addEventListener('pointermove', function(e){
        var el = e.target.closest('.spot');
        if(el) queueSpot(el, e);
      }, { passive:true });
    } else {
      document.addEventListener('pointerdown', function(e){
        if(e.pointerType!=='touch') return;
        var el = e.target.closest('.spot');
        if(!el) return;
        queueSpot(el, e);
        el.classList.add('is-tapped');
        setTimeout(function(){ el.classList.remove('is-tapped'); }, 550);
      }, { passive:true });
    }
  })();

  /* ---------- animated ASCII art (shared engine) ---------- */
  var asciiReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RAMP = ' .:+*#@';
  function hexToRgb(hex, fallback){
    hex = (hex || '').trim();
    if(!/^#[0-9a-fA-F]{6}$/.test(hex)) hex = fallback;
    return parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16);
  }
  var rootStyle = getComputedStyle(document.documentElement);
  var COLOR_PEAK = hexToRgb(rootStyle.getPropertyValue('--k-logic'), '#34d399');
  var COLOR_BASE = hexToRgb(rootStyle.getPropertyValue('--text-2'), '#9aa4b2');
  var COLOR_TRIGGER = hexToRgb(rootStyle.getPropertyValue('--k-trigger'), '#8aa9c9');
  var COLOR_ACTION  = hexToRgb(rootStyle.getPropertyValue('--k-action'),  '#4d9eff');
  var COLOR_LOGIC   = hexToRgb(rootStyle.getPropertyValue('--k-logic'),   '#34d399');
  var COLOR_AI      = hexToRgb(rootStyle.getPropertyValue('--k-ai'),      '#a78bfa');

  function distToSeg(px,py,x1,y1,x2,y2){
    var dx=x2-x1, dy=y2-y1;
    var len2=dx*dx+dy*dy;
    var u = len2>0 ? ((px-x1)*dx+(py-y1)*dy)/len2 : 0;
    u = Math.max(0, Math.min(1, u));
    var ex=x1+u*dx, ey=y1+u*dy;
    return { d: Math.hypot(px-ex, py-ey), u: u };
  }

  function makeCharCanvas(canvas, cols, rows){
    var mobile = document.body.classList.contains('is-mobile');
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    lastCtx = null; /* resizing the bitmap reset the context's fillStyle */
    var cw = w / cols, ch = h / rows;
    ctx.font = Math.ceil(ch) + 'px monospace';
    ctx.textBaseline = 'top';
    return { ctx: ctx, cw: cw, ch: ch, w: w, h: h };
  }

  var STYLE_CACHE = {};
  function fillFor(color, brightness){
    var a = Math.round(Math.min(brightness,1) * 100);
    var row = STYLE_CACHE[color] || (STYLE_CACHE[color] = []);
    return row[a] || (row[a] = 'rgba(' + color + ',' + (a / 100).toFixed(2) + ')');
  }

  var lastCtx = null, lastFill = '';
  function putChar(ctx, col, row, cw, ch, glyph, brightness, colorOverride){
    if(brightness <= 0.03) return;
    var fill = fillFor(colorOverride || (brightness > 0.55 ? COLOR_PEAK : COLOR_BASE), brightness);
    if(ctx !== lastCtx || fill !== lastFill){ ctx.fillStyle = fill; lastCtx = ctx; lastFill = fill; }
    ctx.fillText(glyph, col * cw, row * ch);
  }

  /* One pointer tracker per scene, attached once. The handlers only record the latest client position; read() turns it
     into canvas-relative coordinates, and a scene calls it once per rendered frame, so pointer movement never forces layout. */
  function trackPointer(target, canvas, trackY, touchDelay){
    var p = { active:false, nx:0, ny:0, has:false, cx:0, cy:0, timer:null };
    function record(e){ p.cx = e.clientX; p.cy = e.clientY; p.has = true; }
    target.addEventListener('pointermove', function(e){
      if(p.timer){ clearTimeout(p.timer); p.timer = null; }
      record(e);
    }, { passive:true });
    target.addEventListener('pointerdown', record, { passive:true });
    target.addEventListener('pointerleave', function(e){
      if(e.pointerType === 'touch'){ p.timer = setTimeout(function(){ p.has = false; }, touchDelay); }
      else { p.has = false; }
    }, { passive:true });
    p.read = function(){
      p.active = false;
      if(!p.has) return;
      var rect = canvas.getBoundingClientRect();
      if(rect.width <= 0 || (trackY && rect.height <= 0)) return;
      var nx = (p.cx - rect.left) / rect.width, ny = (p.cy - rect.top) / rect.height;
      if(nx < 0 || nx > 1 || (trackY && (ny < 0 || ny > 1))) return;
      p.active = true; p.nx = nx; p.ny = ny;
    };
    return p;
  }

  /* A scene is built lazily the first time its canvas is on screen and rebuilt only when its size or breakpoint changed. */
  function runScene(canvas, setup, pointerOpts){
    if(!canvas || !canvas.getContext) return;
    var pointer = pointerOpts ? trackPointer(pointerOpts.target, canvas, pointerOpts.trackY, pointerOpts.touchDelay) : null;
    var state = null, builtFor = '';
    var running = false, raf = null, lastFrame = 0, relayoutTimer;
    function layoutKey(){
      var rect = canvas.getBoundingClientRect();
      return Math.round(rect.width) + 'x' + Math.round(rect.height) + (document.body.classList.contains('is-mobile') ? 'm' : 'd');
    }
    function build(){ state = setup(canvas, pointer); builtFor = layoutKey(); }
    function frame(now){
      raf = null;
      if(!running) return;
      if(now - lastFrame >= state.frameInterval){
        lastFrame = now;
        if(state.render(now / 1000) === false){ running = false; return; }
      }
      raf = requestAnimationFrame(frame);
    }
    function start(){
      if(running) return;
      if(!state || layoutKey() !== builtFor) build();
      running = true;
      state.render(0);
      if(!asciiReduceMotion) raf = requestAnimationFrame(frame);
    }
    function stop(){ running = false; if(raf){ cancelAnimationFrame(raf); raf = null; } }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){ if(entries[0].isIntersecting) start(); else stop(); }, { threshold: 0.01 }).observe(canvas);
    } else { start(); }
    function relayout(){
      if(!running || layoutKey() === builtFor) return;
      build();
      state.render(0);
    }
    function scheduleRelayout(){ clearTimeout(relayoutTimer); relayoutTimer = setTimeout(relayout, 200); }
    if('ResizeObserver' in window){ new ResizeObserver(scheduleRelayout).observe(canvas); }
    else { window.addEventListener('resize', scheduleRelayout); }
  }

  /* primary: oscilloscope-style pulse trace, below "What it is" — the engine is alive, running unattended */
  function setupHeartbeat(canvas, pointer){
    var mobile = document.body.classList.contains('is-mobile');
    var cols = mobile ? 46 : 74, rows = mobile ? 24 : 36;
    var g = makeCharCanvas(canvas, cols, rows);
    var pts = [
      [0.00,0],[0.10,0.04],[0.16,-0.04],[0.19,0],
      [0.22,0.95],[0.26,-0.75],[0.29,0.18],[0.34,0.02],
      [0.42,0.32],[0.50,0],[1.00,0]
    ];
    function wave(x){
      x = ((x%1)+1)%1;
      for(var i=0;i<pts.length-1;i++){
        var a=pts[i], b=pts[i+1];
        if(x>=a[0] && x<=b[0]){
          var u = (b[0]===a[0]) ? 0 : (x-a[0])/(b[0]-a[0]);
          return a[1]+(b[1]-a[1])*u;
        }
      }
      return 0;
    }
    var beatsVisible = mobile ? 2.4 : 3.4, speed = 0.22;

    return {
      frameInterval: mobile ? 1000/24 : 1000/30,
      render: function(t){
        g.ctx.clearRect(0,0,g.w,g.h);
        if(repoArchived){
          var flatRow = Math.round(rows/2);
          for(var fc=0; fc<cols; fc++){ putChar(g.ctx, fc, flatRow, g.cw, g.ch, '\u2500', 0.3, COLOR_BASE); }
          return false;
        }
        pointer.read();
        var pointerCol = pointer.active ? Math.max(0, Math.min(cols-1, Math.round(pointer.nx*cols - 0.5))) : -1;
        var mid = Math.round(rows/2);
        for(var gc=0; gc<cols; gc+=3){ putChar(g.ctx, gc, mid, g.cw, g.ch, '\u00B7', 0.1); }
        var prevRow = null;
        for(var c=0;c<cols;c++){
          var px=(c+0.5)/cols;
          var wv = wave(px*beatsVisible - t*speed);
          var targetRow = rows/2 - wv*(rows*0.36);
          var tr = Math.max(0, Math.min(rows-1, Math.round(targetRow)));
          if(prevRow!==null && Math.abs(tr-prevRow)>1){
            var lo=Math.min(prevRow,tr), hi=Math.max(prevRow,tr);
            for(var r=lo+1;r<hi;r++){ putChar(g.ctx, c, r, g.cw, g.ch, '\u2502', 0.4); }
          }
          var peakBright = Math.min(1, 0.55 + Math.abs(wv)*0.5);
          var glyph = RAMP[Math.max(0,Math.min(RAMP.length-1,Math.floor(peakBright*(RAMP.length-1))))];
          putChar(g.ctx, c, tr, g.cw, g.ch, glyph, peakBright);
          prevRow = tr;
          if(c===pointerCol){
            for(var pr=0; pr<rows; pr++){ if(pr!==tr) putChar(g.ctx, c, pr, g.cw, g.ch, '\u00B7', 0.16); }
            putChar(g.ctx, c, tr, g.cw, g.ch, '\u25C6', 1, COLOR_PEAK);
          }
        }
        var lastPx = (cols-0.5)/cols;
        var lastWv = wave(lastPx*beatsVisible - t*speed);
        var lastRow = Math.max(0, Math.min(rows-1, Math.round(rows/2 - lastWv*(rows*0.36))));
        putChar(g.ctx, cols-1, lastRow, g.cw, g.ch, '\u2588', 1, COLOR_PEAK);
      }
    };
  }

  /* ambient: sealed independent loops, no shared hub, behind "Why Aerini" */
  function setupNetwork(canvas){
    var mobile = document.body.classList.contains('is-mobile');
    var cols = mobile ? 40 : 64, rows = mobile ? 24 : 38;
    var g = makeCharCanvas(canvas, cols, rows);
    var boxes = [
      {cx:0.15,cy:0.22,s:0.075,sp:0.16,ph:0.00},
      {cx:0.83,cy:0.18,s:0.055,sp:0.21,ph:0.42},
      {cx:0.50,cy:0.52,s:0.090,sp:0.12,ph:0.71},
      {cx:0.18,cy:0.80,s:0.065,sp:0.19,ph:0.18},
      {cx:0.86,cy:0.82,s:0.060,sp:0.24,ph:0.55}
    ];
    var loops = boxes.map(function(b){
      var x1=b.cx-b.s, x2=b.cx+b.s, y1=b.cy-b.s, y2=b.cy+b.s;
      return {
        sp: b.sp, ph: b.ph,
        edges: [
          {x1:x1,y1:y1,x2:x2,y2:y1,p0:0.00},
          {x1:x2,y1:y1,x2:x2,y2:y2,p0:0.25},
          {x1:x2,y1:y2,x2:x1,y2:y2,p0:0.50},
          {x1:x1,y1:y2,x2:x1,y2:y1,p0:0.75}
        ]
      };
    });
    /* A cell only reaches the first visible glyph (brightness 1/6 of the ramp) when it lies within about 0.038 of a loop
       edge, and that distance never changes. Collect those (cell, loop, edge position, falloff) entries once per layout;
       a frame then only advances each loop's phase and revisits the entries instead of every cell against every edge. */
    var minGlow = 1 / (RAMP.length - 1);
    var entryCell = [], entryLoop = [], entryPos = [], entryFalloff = [];
    for(var r=0;r<rows;r++){
      for(var c=0;c<cols;c++){
        var px=(c+0.5)/cols, py=(r+0.5)/rows;
        for(var L=0;L<loops.length;L++){
          for(var i=0;i<4;i++){
            var e=loops[L].edges[i];
            var res=distToSeg(px,py,e.x1,e.y1,e.x2,e.y2);
            var falloff=Math.max(0,1-res.d*22);
            if(falloff < minGlow) continue;
            entryCell.push(r*cols+c); entryLoop.push(L); entryPos.push(e.p0+res.u*0.25); entryFalloff.push(falloff);
          }
        }
      }
    }
    var entries = entryCell.length;
    var bright = new Float64Array(cols*rows);
    var phases = new Float64Array(loops.length);
    return {
      frameInterval: mobile ? 1000/12 : 1000/20,
      render: function(t){
        g.ctx.clearRect(0,0,g.w,g.h);
        bright.fill(0);
        for(var L=0;L<loops.length;L++){ phases[L]=((t*loops[L].sp+loops[L].ph)%1+1)%1; }
        for(var k=0;k<entries;k++){
          var dphase=Math.abs(entryPos[k]-phases[entryLoop[k]]); dphase=Math.min(dphase,1-dphase);
          var glow=Math.max(0,1-dphase*9)*entryFalloff[k];
          if(glow>bright[entryCell[k]]) bright[entryCell[k]]=glow;
        }
        for(var cell=0;cell<bright.length;cell++){
          var b=bright[cell];
          if(b<minGlow) continue;
          var row=(cell/cols)|0;
          putChar(g.ctx, cell-row*cols, row, g.cw, g.ch, RAMP[Math.floor(b*(RAMP.length-1))], b);
        }
      }
    };
  }

  /* banyan-style world tree behind "Community": a solid lobed canopy on a
     forking trunk, a small root fan, and two aerial roots reaching the
     ground — one tree standing in for many contributors */
  function buildTree(cols, rows, boxAspect){
    var seed = 1337;
    function rng(){
      seed = (seed + 0x6D2B79F5) | 0;
      var x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    }
    // Correction is driven by the box's actual measured aspect, not by
    // cols/rows -- those are just grid resolution and don't reliably track
    // the CSS breakpoint that reshapes the box (they're set at different
    // widths). Clamped so a very short box still fits the canopy.
    var aspect = Math.min(boxAspect, 1.5);
    function glyphFor(dx, dy){
      // dx,dy are already visually-proportioned (aspect applied by the caller)
      var deg = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI;
      if(deg < 24) return '\u2500';
      if(deg > 66) return '\u2502';
      return (dx > 0) === (dy > 0) ? '\u2572' : '\u2571';
    }

    var branches = [], blobs = [], roots = [], aerials = [];
    var baseX = 0.5, baseY = 0.95;

    var trunkTopX = baseX + (rng()-0.5)*0.02, trunkTopY = baseY - 0.20*aspect;
    var midY = baseY - 0.10*aspect;
    branches.push({x1:baseX,y1:baseY,x2:baseX,y2:midY,glyph:glyphFor(0,midY-baseY),off:0,depth:0});
    branches.push({x1:baseX,y1:midY,x2:trunkTopX,y2:trunkTopY,glyph:glyphFor(trunkTopX-baseX,trunkTopY-midY),off:0.18,depth:0});

    // Banyan reference: more, flatter/wider-spreading limbs than an upright
    // shade tree, and aerial prop roots dropping from most of them (not just
    // the two outer limbs) rather than a single trunk. Kept vertically
    // compact -- a banyan reads as wide, not tall -- which is also what
    // keeps it clear of the clamp above on short boxes.
    var LIMBS = 7, spanDeg = 162;
    for(var i=0;i<LIMBS;i++){
      var tDeg = -spanDeg/2 + (spanDeg/(LIMBS-1))*i + (rng()-0.5)*8;
      var a = tDeg * Math.PI/180;
      var len = 0.16 + rng()*0.05;
      var mx = trunkTopX + Math.sin(a)*len, my = trunkTopY - Math.cos(a)*len*aspect;
      branches.push({x1:trunkTopX,y1:trunkTopY,x2:mx,y2:my,glyph:glyphFor(mx-trunkTopX,my-trunkTopY),off:0.4+i*0.06,depth:1});
      var a2 = a + (rng()-0.5)*0.3, len2 = len*0.55;
      var sx = mx + Math.sin(a2)*len2, sy = my - Math.cos(a2)*len2*aspect;
      branches.push({x1:mx,y1:my,x2:sx,y2:sy,glyph:glyphFor(sx-mx,sy-my),off:0.75+i*0.06,depth:2});

      // more, larger, tighter-clustered blobs per limb -> full foliage
      // instead of a scatter of separate leaf-clumps
      var band = i < 2 ? 0 : i < 3 ? 1 : i < 6 ? 2 : 3;
      var blobCount = 5 + Math.floor(rng()*3);
      for(var b=0;b<blobCount;b++){
        var r = 0.085 + rng()*0.055;
        blobs.push({
          cx: sx + (rng()-0.5)*0.11, cy: sy - (rng()*0.07 + 0.012)*aspect,
          r: r, ry: r/aspect, band: band, phase: rng()*6.283
        });
      }
      if(rng() < 0.8){
        aerials.push({x: sx + (rng()-0.5)*0.02, y1: sy, y2: baseY - 0.005 - rng()*0.015});
      }
    }

    var ROOTS = 3;
    for(var j=0;j<ROOTS;j++){
      var rDeg = -50 + (100/(ROOTS-1))*j + (rng()-0.5)*8;
      var ra = Math.PI + rDeg*Math.PI/180, rlen = 0.05 + rng()*0.02;
      var rx = baseX + Math.sin(ra)*rlen, ry = baseY - Math.cos(ra)*rlen*aspect;
      roots.push({x1:baseX,y1:baseY,x2:rx,y2:ry,glyph:glyphFor(rx-baseX,ry-baseY)});
    }

    return { branches:branches, blobs:blobs, roots:roots, aerials:aerials, groundY: baseY };
  }

  function setupBranch(canvas, pointer){
    var mobile = document.body.classList.contains('is-mobile');
    var cols = mobile ? 48 : 54, rows = mobile ? 24 : 54;
    var g = makeCharCanvas(canvas, cols, rows);
    var tree = buildTree(cols, rows, g.w / g.h);
    var groundRow = Math.round(tree.groundY * rows);
    var bandColors = [COLOR_TRIGGER, COLOR_ACTION, COLOR_LOGIC, COLOR_AI];
    // A segment thinner than one character cell skips grid cells at a
    // diagonal and reads as broken dashes instead of a continuous line.
    var minWidth = Math.max(1/cols, 1/rows) * 0.85;
    // width only depends on e.depth, which is fixed per branch -- precompute
    // once instead of recomputing it for every cell the render loop visits.
    // Bounding boxes (padded by each shape's own threshold) let the per-cell
    // loop below skip the expensive distance math entirely for anything that
    // provably can't be within range of a given cell.
    tree.branches.forEach(function(e){
      e.width = Math.max(minWidth, 0.027 - e.depth*0.007);
      e.bx0 = Math.min(e.x1,e.x2) - e.width; e.bx1 = Math.max(e.x1,e.x2) + e.width;
      e.by0 = Math.min(e.y1,e.y2) - e.width; e.by1 = Math.max(e.y1,e.y2) + e.width;
    });
    tree.roots.forEach(function(re){
      re.bx0 = Math.min(re.x1,re.x2) - 0.011; re.bx1 = Math.max(re.x1,re.x2) + 0.011;
      re.by0 = Math.min(re.y1,re.y2) - 0.011; re.by1 = Math.max(re.y1,re.y2) + 0.011;
    });

    // Which shapes cover a cell never changes for a given layout; only the canopy shimmer, the travelling branch pulse
    // and the pointer glow vary per frame. Resolve the coverage once here so render() skips empty cells and does no
    // distance math.
    var cells = [];
    for(var r=0;r<rows;r++){
      for(var c=0;c<cols;c++){
        var px=(c+0.5)/cols, py=(r+0.5)/rows;
        var cell = { c:c, r:r, px:px, py:py, blob:-1, base:0, color:null, hits:[], roots:[], aerial:false, ground:false };

        var bestNd=Infinity, bestBlob=-1;
        for(var i=0;i<tree.blobs.length;i++){
          var bl=tree.blobs[i];
          if(px<bl.cx-bl.r || px>bl.cx+bl.r || py<bl.cy-bl.ry || py>bl.cy+bl.ry) continue;
          var nd=Math.hypot((px-bl.cx)/bl.r, (py-bl.cy)/bl.ry);
          if(nd<bestNd){ bestNd=nd; bestBlob=i; }
        }
        if(bestBlob>=0 && bestNd<1){
          var edge=0.22;
          cell.blob=bestBlob;
          cell.base = bestNd<(1-edge) ? 0.99 : 0.99*(1-(bestNd-(1-edge))/edge);
          cell.color = bandColors[tree.blobs[bestBlob].band];
        }
        for(var k=0;k<tree.branches.length;k++){
          var e=tree.branches[k];
          if(px<e.bx0 || px>e.bx1 || py<e.by0 || py>e.by1) continue;
          var res=distToSeg(px,py,e.x1,e.y1,e.x2,e.y2);
          if(res.d<e.width){ cell.hits.push(k, 0.82+0.18*(1-res.d/e.width), res.u); }
        }
        for(var m=0;m<tree.roots.length;m++){
          var re=tree.roots[m];
          if(px<re.bx0 || px>re.bx1 || py<re.by0 || py>re.by1) continue;
          if(distToSeg(px,py,re.x1,re.y1,re.x2,re.y2).d<0.011) cell.roots.push(m);
        }
        for(var n=0;n<tree.aerials.length;n++){
          var ae=tree.aerials[n];
          if(py>ae.y1 && py<ae.y2){
            var at=(py-ae.y1)/(ae.y2-ae.y1);
            var aw=0.005 + Math.max(0,at-0.55)*0.018;
            if(Math.abs(px-ae.x)<aw) cell.aerial=true;
          }
        }
        cell.ground = r>=groundRow-1 && r<=groundRow+1 && (c%2===0);
        if(cell.blob>=0 || cell.hits.length || cell.roots.length || cell.aerial || cell.ground) cells.push(cell);
      }
    }
    var blobShimmer = new Float64Array(tree.blobs.length);
    var pulseTime = new Float64Array(tree.branches.length);

    return {
      frameInterval: mobile ? 1000/12 : 1000/20,
      render: function(t){
        g.ctx.clearRect(0,0,g.w,g.h);
        pointer.read();
        var pointerOn = pointer.active, pointerX = pointer.nx, pointerY = pointer.ny;
        for(var bi=0;bi<blobShimmer.length;bi++){ blobShimmer[bi]=Math.sin(t*0.5+tree.blobs[bi].phase); }
        for(var bk=0;bk<pulseTime.length;bk++){ pulseTime[bk]=(((t*0.4)-tree.branches[bk].off)%2.2+2.2)%2.2; }
        for(var ci=0;ci<cells.length;ci++){
          var cl=cells[ci], bright=0, glyph=null, color=null;

          if(cl.blob>=0){
            var b = cl.base + 0.06*blobShimmer[cl.blob];
            if(pointerOn){
              var pd=Math.hypot(cl.px-pointerX,cl.py-pointerY);
              if(pd<0.12) b += (1-pd/0.12)*0.35;
            }
            bright=Math.max(0,b); color=cl.color;
          }
          for(var h=0;h<cl.hits.length;h+=3){
            var bk2=cl.hits[h], lb=cl.hits[h+1], localT=pulseTime[bk2];
            if(localT<0.5){ lb=Math.max(lb, lb+Math.max(0,1-Math.abs(cl.hits[h+2]-localT/0.5)*5)*0.18); }
            if(lb>=bright){ bright=Math.max(bright,lb); color=COLOR_BASE; glyph=tree.branches[bk2].glyph; }
          }
          for(var rr=0;rr<cl.roots.length;rr++){
            if(0.7>=bright){ bright=Math.max(bright,0.7); color=COLOR_TRIGGER; glyph=tree.roots[cl.roots[rr]].glyph; }
          }
          if(cl.aerial && 0.4>=bright){ bright=Math.max(bright,0.4); color=COLOR_TRIGGER; glyph='│'; }
          if(bright<0.07 && cl.ground){ bright=0.2; glyph='·'; color=COLOR_BASE; }
          if(bright<=0.03) continue;
          if(glyph===null){ glyph = RAMP[Math.max(0,Math.min(RAMP.length-1,Math.floor(bright*(RAMP.length-1))))]; }
          if(glyph===' ') continue;
          putChar(g.ctx, cl.c, cl.r, g.cw, g.ch, glyph, bright, color);
        }
      }
    };
  }

  (function checkRepoArchived(){
    var caption = document.getElementById('pulseCaption');
    if(!caption) return;
    function applyDead(){
      repoArchived = true;
      if(caption){
        caption.textContent = '\u00B7 archived \u2014 this pulse stopped when the repository did \u00B7';
        caption.classList.add('is-archived');
      }
    }
    var cacheKey = 'aerini_repo_status', ttl = 6*60*60*1000, cached = null;
    try{
      var raw = localStorage.getItem(cacheKey);
      if(raw){ cached = JSON.parse(raw); if(Date.now() - cached.ts > ttl) cached = null; }
    } catch(e){ cached = null; }
    if(cached){ if(cached.archived) applyDead(); return; }
    if(!('fetch' in window)) return;
    fetch('https://api.github.com/repos/' + GH_REPO).then(function(res){
      if(!res.ok) throw new Error('status ' + res.status);
      return res.json();
    }).then(function(data){
      var archived = !!data.archived;
      try{ localStorage.setItem(cacheKey, JSON.stringify({ archived: archived, ts: Date.now() })); } catch(e){}
      if(archived) applyDead();
    }).catch(function(){});
  })();

  var wireframeCanvas = document.getElementById('asciiWireframe');
  var branchCanvas = document.getElementById('asciiBranch');
  runScene(wireframeCanvas, setupHeartbeat, wireframeCanvas && { target: wireframeCanvas.closest('.ascii-feature') || wireframeCanvas, trackY: false, touchDelay: 650 });
  runScene(document.getElementById('asciiNetwork'), setupNetwork);
  runScene(branchCanvas, setupBranch, branchCanvas && { target: branchCanvas.closest('section') || branchCanvas, trackY: true, touchDelay: 700 });
})();
