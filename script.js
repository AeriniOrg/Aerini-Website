(function(){
  "use strict";
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if(nav){
    window.addEventListener('scroll', function(){
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive:true });
  }
  if(navToggle && nav){
    navToggle.addEventListener('click', function(){
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  if(navLinks && nav && navToggle){
    navLinks.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded','false'); });
    });
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
        if(other!==item){ other.classList.remove('is-open'); other.querySelector('.faq-a').style.maxHeight = null; other.querySelector('.faq-q').setAttribute('aria-expanded', 'false'); }
      });
      if(isOpen){ item.classList.remove('is-open'); a.style.maxHeight = null; q.setAttribute('aria-expanded', 'false'); }
      else { item.classList.add('is-open'); a.style.maxHeight = a.scrollHeight + 'px'; q.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---------- smart download ---------- */
  var GH_REPO = 'Panchak2d/Aerini';
  var GH_RELEASES_API = 'https://api.github.com/repos/' + GH_REPO + '/releases/latest';
  var ASSET_PATTERN = { windows: /-setup\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
  var OS_LABEL = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  function detectOS(){
    var ua = navigator.userAgent || '', plat = navigator.platform || '';
    if(/Win/.test(plat) || /Windows/.test(ua)) return 'windows';
    if(/Mac/.test(plat) || /Macintosh/.test(ua)) return 'macos';
    if(/Linux|X11/.test(plat) || /Linux/.test(ua)) return 'linux';
    return null;
  }

  function findAsset(assets, os){
    var candidates = [];
    for(var i=0;i<assets.length;i++){ if(ASSET_PATTERN[os].test(assets[i].name)) candidates.push(assets[i]); }
    if(candidates.length < 2) return candidates[0] || null;
    for(var j=0;j<candidates.length;j++){
      if(!/arm64|aarch64/i.test(candidates[j].name)) return candidates[j];
    }
    return candidates[0];
  }

  function initSmartDownload(){
    var ctas = document.querySelectorAll('[data-role="get-aerini-cta"]');
    var cards = document.querySelectorAll('[data-platform]');
    var detected = detectOS();
    if(!('fetch' in window)) return;

    fetch(GH_RELEASES_API, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function(res){ if(!res.ok) throw new Error('release lookup failed'); return res.json(); })
      .then(function(release){
        var assets = release.assets || [];
        var version = release.tag_name || '';

        cards.forEach(function(card){
          var os = card.getAttribute('data-platform');
          var asset = findAsset(assets, os);
          var link = card.querySelector('a');
          if(!asset || !link) return;
          link.href = asset.browser_download_url;
          link.textContent = 'Download ' + version + ' \u2192';
          link.removeAttribute('target');
          link.removeAttribute('rel');
        });

        if(detected){
          var heroAsset = findAsset(assets, detected);
          if(heroAsset){
            ctas.forEach(function(cta){
              cta.href = heroAsset.browser_download_url;
              var label = cta.querySelector('.cta-label');
              if(label) label.textContent = 'Get Aerini for ' + OS_LABEL[detected];
            });
          }
        }
      })
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
  function initHeroGraph(){
    if(!heroCanvas) return;
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

  /* ---------- rebuild both graphs on resize; these need it separately since they position nodes in px, not on a canvas grid ---------- */
  var graphResizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(graphResizeTimer);
    graphResizeTimer = setTimeout(function(){ initHeroGraph(); initDemoGraph(); }, 200);
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
    if(fineHover){
      document.addEventListener('pointermove', function(e){
        var el = e.target.closest('.spot');
        if(!el) return;
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX-rect.left)/rect.width*100)+'%');
        el.style.setProperty('--my', ((e.clientY-rect.top)/rect.height*100)+'%');
      }, { passive:true });
    } else {
      document.addEventListener('pointerdown', function(e){
        if(e.pointerType!=='touch') return;
        var el = e.target.closest('.spot');
        if(!el) return;
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX-rect.left)/rect.width*100)+'%');
        el.style.setProperty('--my', ((e.clientY-rect.top)/rect.height*100)+'%');
        el.classList.add('is-tapped');
        setTimeout(function(){ el.classList.remove('is-tapped'); }, 550);
      }, { passive:true });
    }
  })();
})();
