/* ============================================================
   知识星图 · 3D Knowledge Cosmos
   Stack (pinned UMD): three@0.128.0 + 3d-force-graph@1.70.0
   Features: GLSL nebula skybox, starfield, UnrealBloom glow,
   custom sprite nodes, CJK labels, same-group focus semantics.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- stable unique color per group (golden angle) ---------- */
  function colorFor(g) {
    var h = ((Number(g) || 0) * 137.508) % 360;
    return 'hsl(' + h.toFixed(1) + ',84%,63%)';
  }
  function sid(v) { return (v && typeof v === 'object') ? v.id : v; }

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- loading UI ---------- */
  var loadEl = document.getElementById('loading');
  var loadText = document.getElementById('load-text');
  function setLoad(t) { if (loadText) loadText.textContent = t; }
  setTimeout(function () {
    if (loadEl && loadEl.className.indexOf('hidden') < 0) {
      loadEl.innerHTML = '<div style="color:#f72585;font:13px/1.8 sans-serif;text-align:center">加载超时 · Timeout<br><a href="graph.html" style="color:#4cc9f0">点击重试 Retry</a></div>';
    }
  }, 15000);

  function fatal(err) {
    console.error('Graph error:', err);
    console.log('THREE:', typeof THREE, '| ForceGraph3D:', typeof ForceGraph3D);
    if (typeof THREE !== 'undefined') {
      try { new THREE.WebGLRenderer(); console.log('WebGL: OK'); } catch (e) { console.log('WebGL: FAIL', e); }
    }
    if (loadEl) {
      loadEl.classList.remove('hidden');
      loadEl.innerHTML = '<div style="color:#f72585;font-size:14px;padding:24px;max-width:520px;line-height:1.9">' +
        '<b>星图引擎点火失败 · Graph Error</b><br>' + (err && err.message ? err.message : err) +
        '<br><br><i>按 F12 查看控制台细节</i><br>' +
        '<a href="graph.html" style="color:#4cc9f0">重试 Retry</a> · <a href="index.html" style="color:#4cc9f0">返回首页 Home</a></div>';
    }
  }

  /* ---------- shared canvas textures ---------- */
  function makeGlowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.6)');
    g.addColorStop(0.55, 'rgba(255,255,255,.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function makeLabelSprite(text, color, small) {
    var fs = small ? 34 : 44;
    var pad = 26;
    var c = document.createElement('canvas');
    var x = c.getContext('2d');
    var font = '600 ' + fs + 'px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
    x.font = font;
    var label = text.length > 18 ? text.slice(0, 17) + '…' : text;
    var tw = Math.ceil(x.measureText(label).width);
    c.width = tw + pad * 2; c.height = fs + pad * 2;
    x = c.getContext('2d'); x.font = font;
    x.textBaseline = 'middle'; x.textAlign = 'center';
    x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 10;
    x.lineWidth = 5; x.strokeStyle = 'rgba(4,5,13,.85)';
    x.strokeText(label, c.width / 2, c.height / 2);
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(244,242,255,.96)';
    x.fillText(label, c.width / 2, c.height / 2);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: color, transparent: true, opacity: .95,
      depthWrite: false, depthTest: false
    }));
    var k = small ? 0.055 : 0.07;
    sp.scale.set(c.width * k, c.height * k, 1);
    sp.renderOrder = 10;
    return sp;
  }

  /* ---------- nebula skybox shader ---------- */
  var NEBULA_FRAG = [
    'uniform float uTime;',
    'varying vec3 vDir;',
    'float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);',
    '  return mix(mix(mix(hash(i+vec3(0.,0.,0.)),hash(i+vec3(1.,0.,0.)),f.x),',
    '                 mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),',
    '             mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),',
    '                 mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z); }',
    'float fbm(vec3 p){ float v=0.0; float a=0.5;',
    '  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float t = uTime*0.010;',
    '  float n1 = fbm(d*2.6 + vec3(t, -t*0.7, t*0.4));',
    '  float n2 = fbm(d*5.2 - vec3(t*0.6, t, -t*0.3) + n1);',
    '  float n3 = fbm(d*3.4 + vec3(-t, t*0.5, t) + n2);',
    '  vec3 col = vec3(0.010, 0.012, 0.042);',
    '  col += vec3(0.10, 0.07, 0.24) * smoothstep(0.35, 0.85, n1);',
    '  col += vec3(0.02, 0.14, 0.20) * pow(smoothstep(0.45, 0.95, n2), 2.0);',
    '  col += vec3(0.16, 0.05, 0.20) * pow(smoothstep(0.55, 0.98, n3), 3.0);',
    '  float band = exp(-abs(d.y)*3.5);',
    '  col += vec3(0.05, 0.04, 0.10) * band * 0.6;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  var NEBULA_VERT = [
    'varying vec3 vDir;',
    'void main(){ vDir = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');

  /* ================================================================
     BOOT
     ================================================================ */
  setLoad('FETCHING GRAPH DATA');
  fetch('graph.json').then(function (r) { return r.json(); }).then(function (raw) {

    /* ---------- normalize ---------- */
    var meta = raw.graph || {};
    var groupLabels = meta.groupLabels || {};
    function groupName(g) { return groupLabels[String(g)] || ('社区 ' + g); }

    var gd = { nodes: [], links: [] };
    var degree = {};
    (raw.links || []).forEach(function (l) {
      degree[l.source] = (degree[l.source] || 0) + 1;
      degree[l.target] = (degree[l.target] || 0) + 1;
    });
    raw.nodes.forEach(function (n) {
      var t = n.type || n.file_type || 'concept';
      var deg = degree[n.id] || 0;
      var isDoc = t === 'document';
      gd.nodes.push({
        id: n.id,
        name: n.label || n.name || String(n.id).replace(/_/g, ' '),
        group: n.community != null ? n.community : (n.group != null ? n.group : 0),
        type: t,
        tags: n.tags || [],
        summary: n.summary || '',
        __deg: deg,
        __r: isDoc ? Math.min(3.4 + deg * 0.32, 7.5) : Math.min(1.35 + deg * 0.14, 3.0),
        __phase: (String(n.id).length % 10) * 0.63
      });
    });
    (raw.links || []).forEach(function (l) {
      gd.links.push({ source: l.source, target: l.target, type: l.type || 'tag', value: l.value || l.weight || 1 });
    });

    var nodeById = {};
    gd.nodes.forEach(function (n) { nodeById[n.id] = n; });

    /* stats */
    var stats = meta.stats || {
      documents: gd.nodes.filter(function (n) { return n.type === 'document'; }).length,
      concepts: gd.nodes.filter(function (n) { return n.type !== 'document'; }).length,
      links: gd.links.length,
      groups: Object.keys(gd.nodes.reduce(function (m, n) { m[n.group] = 1; return m; }, {})).length
    };

    /* ---------- adjacency for detail panel ---------- */
    var REL_LABEL = { related: '关联', tag: '标签', 'shared-tag': '共现' };
    var adj = {};
    gd.links.forEach(function (l) {
      var a = sid(l.source), b = sid(l.target);
      (adj[a] = adj[a] || []).push({ id: b, rel: l.type });
      (adj[b] = adj[b] || []).push({ id: a, rel: l.type });
    });

    setLoad('BUILDING COSMOS');

    /* ---------- graph ---------- */
    var container = document.getElementById('graph-container');
    var graph = ForceGraph3D({ controlType: 'orbit' })(container)
      .nodeId('id')
      .backgroundColor('#04050d')
      .showNavInfo(false)
      .enableNodeDrag(false)
      .width(window.innerWidth).height(window.innerHeight)
      .d3AlphaDecay(.02).d3VelocityDecay(.3)
      .warmupTicks(60)
      .linkOpacity(.42)
      .linkCurvature(function (l) { return l.type === 'related' ? .28 : .12; })
      .linkDirectionalParticleWidth(1.7)
      .linkDirectionalParticleSpeed(function (l) { return l.type === 'related' ? .006 : .004; })
      .linkDirectionalParticleColor(function (l) {
        var s = nodeById[sid(l.source)];
        return s ? colorFor(s.group) : '#8888ff';
      });

    var camera = graph.camera();
    camera.far = 9000; camera.updateProjectionMatrix();

    /* ---------- glow texture & node objects ---------- */
    var glowTex = makeGlowTexture();
    var labelsOn = true;

    function nodeObject(n) {
      var grp = new THREE.Group();
      var col = new THREE.Color(colorFor(n.group));
      var isDoc = n.type === 'document';

      var core = new THREE.Mesh(
        new THREE.SphereGeometry(n.__r, isDoc ? 22 : 12, isDoc ? 16 : 10),
        new THREE.MeshBasicMaterial({ color: isDoc ? col.clone().lerp(new THREE.Color('#000000'), .18) : col.clone().lerp(new THREE.Color('#ffffff'), .3), transparent: true })
      );
      core.userData.o0 = 1; grp.add(core); n.__core = core;

      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: col, blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true, opacity: isDoc ? .68 : .42
      }));
      var gs = n.__r * (isDoc ? 5.6 : 5);
      glow.scale.set(gs, gs, 1);
      glow.userData.o0 = isDoc ? .68 : .42;
      grp.add(glow); n.__glow = glow;

      var label = makeLabelSprite(n.name, col, !isDoc);
      label.position.y = gs * .5 + (isDoc ? 4.5 : 3.5);
      label.visible = isDoc;
      label.userData.o0 = .95;
      grp.add(label); n.__label = label;

      n.__obj = grp;
      return grp;
    }
    graph.nodeThreeObject(nodeObject);

    /* ---------- skybox: nebula shader sphere + starfield ---------- */
    var nebulaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    var nebula = new THREE.Mesh(new THREE.SphereGeometry(4200, 40, 24), nebulaMat);
    nebula.renderOrder = -10;
    nebula.frustumCulled = false;
    graph.scene().add(nebula);

    var starGeo = new THREE.BufferGeometry();
    var N_STARS = 1500, pos = new Float32Array(N_STARS * 3), colArr = new Float32Array(N_STARS * 3);
    for (var i = 0; i < N_STARS; i++) {
      var th = Math.acos(2 * ((i * 0.61803398875) % 1) - 1);
      var ph = i * 2.39996323;
      var rr = 2500 + ((i * 7919) % 900);
      pos[i * 3] = rr * Math.sin(th) * Math.cos(ph);
      pos[i * 3 + 1] = rr * Math.cos(th);
      pos[i * 3 + 2] = rr * Math.sin(th) * Math.sin(ph);
      var tint = 0.72 + ((i * 31) % 28) / 100;
      var warm = ((i * 13) % 10) / 10;
      colArr[i * 3] = tint * (0.85 + warm * 0.15);
      colArr[i * 3 + 1] = tint * 0.9;
      colArr[i * 3 + 2] = tint;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    stars.frustumCulled = false;
    graph.scene().add(stars);

    /* ---------- bloom post-processing ---------- */
    var bloomPass = null;
    try {
      if (THREE.UnrealBloomPass) {
        bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight), 1.15, .5, .18);
        graph.postProcessingComposer().addPass(bloomPass);
      }
    } catch (e) { console.warn('Bloom unavailable:', e); }
    var btnBloom = document.getElementById('btn-bloom');
    if (!bloomPass && btnBloom) btnBloom.style.display = 'none';

    /* ---------- data ---------- */
    graph.graphData(gd);
    window.GR = graph;

    /* ---------- auto-rotate via orbit controls ---------- */
    var controls = graph.controls();
    var rotateOn = !REDUCED;
    controls.autoRotate = rotateOn;
    controls.autoRotateSpeed = .55;
    var idleTimer = null;
    controls.addEventListener('start', function () {
      controls.autoRotate = false; clearTimeout(idleTimer);
    });
    controls.addEventListener('end', function () {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (rotateOn) controls.autoRotate = true;
      }, 3500);
    });

    /* ---------- ambient animation loop ---------- */
    var t0 = performance.now();
    (function ambience() {
      requestAnimationFrame(ambience);
      var t = (performance.now() - t0) / 1000;
      nebulaMat.uniforms.uTime.value = t;
      stars.rotation.y += REDUCED ? 0 : 0.00035;
      if (!REDUCED) {
        for (var i = 0; i < gd.nodes.length; i++) {
          var n = gd.nodes[i];
          if (n.type === 'document' && n.__glow) {
            var s = n.__r * 5.6 * (1 + Math.sin(t * 1.6 + n.__phase) * 0.06);
            n.__glow.scale.set(s, s, 1);
          }
        }
      }
    })();

    /* ---------- focus state ---------- */
    var focusedNode = null, focusedGroup = null, hovered = null, matchSet = null;

    function inGroup(n) { return focusedGroup == null || n.group === focusedGroup; }

    function paint() {
      gd.nodes.forEach(function (n) {
        var dim = matchSet ? !matchSet[n.id] : !inGroup(n);
        if (n.__core) n.__core.material.opacity = dim ? .10 : n.__core.userData.o0;
        if (n.__glow) n.__glow.material.opacity = dim ? .045 : n.__glow.userData.o0;
        if (n.__label) {
          n.__label.visible = !dim && ((labelsOn && n.type === 'document') ||
            (labelsOn && focusedGroup != null && n.group === focusedGroup) || hovered === n);
          n.__label.material.opacity = n.__label.userData.o0;
        }
      });
      graph
        .linkColor(function (l) {
          var a = nodeById[sid(l.source)], b = nodeById[sid(l.target)];
          var g = a ? a.group : 0;
          if (matchSet || focusedGroup != null) {
            var hit = a && b && (matchSet ? (matchSet[a.id] && matchSet[b.id]) : (a.group === focusedGroup && b.group === focusedGroup));
            return hit ? colorFor(g) : 'rgba(90,86,120,.10)';
          }
          return colorFor(g);
        })
        .linkWidth(function (l) {
          var a = nodeById[sid(l.source)], b = nodeById[sid(l.target)];
          if (matchSet || focusedGroup != null) {
            var hit = a && b && (matchSet ? (matchSet[a.id] && matchSet[b.id]) : (a.group === focusedGroup && b.group === focusedGroup));
            return hit ? (l.type === 'related' ? 2.6 : 1.6) : .15;
          }
          return l.type === 'related' ? 1.7 : l.type === 'shared-tag' ? 1.1 : .5;
        })
        .linkDirectionalParticles(function (l) {
          var a = nodeById[sid(l.source)], b = nodeById[sid(l.target)];
          if (focusedGroup != null || matchSet) {
            var hit = a && b && (matchSet ? (matchSet[a.id] && matchSet[b.id]) : (a.group === focusedGroup && b.group === focusedGroup));
            return hit ? (l.type === 'related' ? 3 : 1) : 0;
          }
          return l.type === 'related' ? 2 : l.type === 'shared-tag' ? 1 : 0;
        });
      /* groups panel active state */
      var items = document.querySelectorAll('.g-item');
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('active',
          focusedGroup != null && items[i].getAttribute('data-group') === String(focusedGroup));
      }
    }

    function flyTo(n, dist) {
      dist = dist || Math.max(70, n.__r * 16);
      var cam = graph.cameraPosition();
      var vx = cam.x - (n.x || 0), vy = cam.y - (n.y || 0), vz = cam.z - (n.z || 0);
      var len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      graph.cameraPosition(
        { x: (n.x || 0) + vx / len * dist, y: (n.y || 0) + vy / len * dist, z: (n.z || 0) + vz / len * dist },
        { x: n.x || 0, y: n.y || 0, z: n.z || 0 }, 1100);
    }

    function resetFocus(fit) {
      focusedNode = null; focusedGroup = null; matchSet = null;
      searchBox.value = ''; searchCount.className = '';
      paint();
      document.getElementById('detail').classList.remove('on');
      if (fit !== false) graph.zoomToFit(900, 70);
    }

    /* ---------- detail panel ---------- */
    var dEl = document.getElementById('detail');
    function showDetail(n) {
      document.getElementById('d-title').textContent = n.name;
      var chips = document.getElementById('d-chips');
      var isDoc = n.type === 'document';
      chips.innerHTML =
        '<span class="chip hot" style="background:' + colorFor(n.group) + '">' + (isDoc ? '知识单元' : '概念节点') + '</span>' +
        '<span class="chip">' + groupName(n.group) + '</span>' +
        '<span class="chip">' + (n.__deg || 0) + ' 条连接</span>';
      var sum = document.getElementById('d-sum');
      sum.textContent = n.summary || (isDoc ? '（无概要）' : '概念标签节点 — 连接多个知识单元。');
      sum.style.display = n.summary || !isDoc ? '' : 'none';
      var tags = document.getElementById('d-tags');
      tags.innerHTML = '';
      (n.tags || []).forEach(function (t) {
        var s = document.createElement('span'); s.textContent = t; tags.appendChild(s);
      });
      tags.style.display = n.tags && n.tags.length ? '' : 'none';
      var list = document.getElementById('d-links');
      list.innerHTML = '';
      var nb = [], seenNb = {};
      var REL_RANK = { related: 3, 'shared-tag': 2, tag: 1 };
      (adj[n.id] || []).forEach(function (e) {
        if (seenNb[e.id]) {
          if ((REL_RANK[e.rel] || 0) > (REL_RANK[seenNb[e.id].rel] || 0)) seenNb[e.id].rel = e.rel;
          return;
        }
        seenNb[e.id] = { id: e.id, rel: e.rel }; nb.push(seenNb[e.id]);
      });
      nb.sort(function (a, b) {
        var da = nodeById[a.id], db = nodeById[b.id];
        return ((REL_RANK[b.rel] || 0) - (REL_RANK[a.rel] || 0)) ||
          (((db && db.type === 'document') ? 1 : 0) - ((da && da.type === 'document') ? 1 : 0));
      }).slice(0, 14).forEach(function (e) {
        var m = nodeById[e.id]; if (!m) return;
        var row = document.createElement('div'); row.className = 'd-link';
        row.innerHTML = '<span class="rel">' + (REL_LABEL[e.rel] || '连接') + '</span>' +
          '<span class="g-dot" style="color:' + colorFor(m.group) + ';background:' + colorFor(m.group) + '"></span>' +
          '<span class="nm">' + m.name + '</span>';
        row.onclick = function () { focusNode(m); };
        list.appendChild(row);
      });
      dEl.classList.add('on');
    }

    function focusNode(n) {
      if (focusedNode === n) { resetFocus(); return; }
      focusedNode = n; focusedGroup = n.group; matchSet = null;
      paint(); showDetail(n); flyTo(n);
    }

    /* ---------- interactions ---------- */
    var tooltip = document.getElementById('tooltip');
    graph
      .onNodeHover(function (n) {
        hovered = n || null;
        container.style.cursor = n ? 'pointer' : '';
        if (n) {
          tooltip.querySelector('.tt-title').textContent = n.name;
          tooltip.querySelector('.tt-type').textContent = n.type === 'document' ? '知识单元' : '概念节点';
          tooltip.querySelector('.tt-group').textContent = groupName(n.group);
          var dot = tooltip.querySelector('.tt-dot');
          dot.style.color = colorFor(n.group); dot.style.background = colorFor(n.group);
          tooltip.classList.add('on');
          if (n.__obj) n.__obj.scale.set(1.3, 1.3, 1.3);
        } else {
          tooltip.classList.remove('on');
        }
        gd.nodes.forEach(function (m) {
          if (m !== n && m.__obj && m.__obj.scale.x !== 1) m.__obj.scale.set(1, 1, 1);
        });
        if (n && n.__label && !n.__label.visible) { n.__label.visible = true; n.__label.userData._tmp = true; }
        paint();
      })
      .onNodeClick(function (n) { focusNode(n); })
      .onBackgroundClick(function () { resetFocus(false); })
      .onLinkHover(function (l) {
        container.style.cursor = l ? 'pointer' : (hovered ? 'pointer' : '');
      });

    document.addEventListener('mousemove', function (e) {
      tooltip.style.left = Math.min(e.clientX + 16, window.innerWidth - 320) + 'px';
      tooltip.style.top = Math.min(e.clientY + 16, window.innerHeight - 90) + 'px';
    });

    /* ---------- groups panel ---------- */
    var groupStats = {};
    gd.nodes.forEach(function (n) {
      var g = n.group;
      groupStats[g] = groupStats[g] || { docs: 0, all: 0 };
      groupStats[g].all++;
      if (n.type === 'document') groupStats[g].docs++;
    });
    var scroll = document.getElementById('groups-scroll');
    Object.keys(groupStats).sort(function (a, b) {
      return groupStats[b].docs - groupStats[a].docs || a - b;
    }).forEach(function (g, idx) {
      var st = groupStats[g];
      var item = document.createElement('div');
      item.className = 'g-item'; item.setAttribute('data-group', g);
      item.style.animationDelay = (idx * 45) + 'ms';
      item.innerHTML = '<span class="g-dot" style="color:' + colorFor(g) + ';background:' + colorFor(g) + '"></span>' +
        '<span class="g-name">' + groupName(g) + '</span>' +
        '<span class="g-num">' + st.docs + ' 单元</span>';
      item.onclick = function () {
        if (focusedGroup === Number(g) && !focusedNode) { resetFocus(false); return; }
        focusedNode = null; focusedGroup = Number(g); matchSet = null;
        paint();
        document.getElementById('detail').classList.remove('on');
        if (window.innerWidth <= 960) document.getElementById('groups').classList.remove('open');
      };
      scroll.appendChild(item);
    });

    /* ---------- search ---------- */
    var searchBox = document.getElementById('search-box');
    var searchCount = document.getElementById('search-count');
    searchBox.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (!q) { matchSet = null; searchCount.className = ''; paint(); return; }
      matchSet = {};
      var n0 = null, cnt = 0;
      gd.nodes.forEach(function (n) {
        if (n.name.toLowerCase().indexOf(q) >= 0 || String(n.id).toLowerCase().indexOf(q) >= 0) {
          matchSet[n.id] = true; cnt++;
          if (!n0 && n.type === 'document') n0 = n;
        }
      });
      searchCount.textContent = cnt + ' 个匹配节点';
      searchCount.className = 'on';
      paint();
      this.__first = n0;
    });
    searchBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && this.__first) { focusNode(this.__first); this.blur(); }
      if (e.key === 'Escape') { this.blur(); resetFocus(false); }
    });

    /* ---------- dock controls ---------- */
    var btnRotate = document.getElementById('btn-rotate');
    var btnLabels = document.getElementById('btn-labels');
    function syncDock() {
      btnRotate.classList.toggle('on', rotateOn);
      btnLabels.classList.toggle('on', labelsOn);
      if (btnBloom) btnBloom.classList.toggle('on', !!(bloomPass && bloomPass.enabled !== false));
    }
    btnRotate.onclick = function () {
      rotateOn = !rotateOn; controls.autoRotate = rotateOn; syncDock();
    };
    btnLabels.onclick = function () { labelsOn = !labelsOn; paint(); syncDock(); };
    if (btnBloom) btnBloom.onclick = function () {
      if (!bloomPass) return;
      bloomPass.enabled = bloomPass.enabled === false ? true : false;
      syncDock();
    };
    document.getElementById('btn-fit').onclick = function () { graph.zoomToFit(900, 70); };
    document.getElementById('btn-reset').onclick = function () { resetFocus(); };
    document.getElementById('btn-groups').onclick = function () {
      document.getElementById('groups').classList.toggle('open');
    };
    document.querySelector('#detail .d-close').onclick = function () {
      dEl.classList.remove('on'); focusedNode = null;
    };
    syncDock();

    /* ---------- keyboard ---------- */
    document.addEventListener('keydown', function (e) {
      var typing = document.activeElement === searchBox;
      if ((e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) && !typing) {
        e.preventDefault(); searchBox.focus(); return;
      }
      if (typing) return;
      var k = e.key.toLowerCase();
      if (k === 'escape') resetFocus(false);
      else if (k === 'r') btnRotate.onclick();
      else if (k === 'l') btnLabels.onclick();
      else if (k === 'b' && btnBloom) btnBloom.onclick();
      else if (k === 'f') graph.zoomToFit(900, 70);
    });

    /* ---------- stats count-up ---------- */
    function countUp(el, target, dur) {
      var t0 = performance.now();
      (function tick() {
        var p = Math.min((performance.now() - t0) / dur, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(tick);
      })();
    }
    countUp(document.getElementById('st-doc'), stats.documents, 1300);
    countUp(document.getElementById('st-node'), gd.nodes.length, 1500);
    countUp(document.getElementById('st-link'), gd.links.length, 1700);
    countUp(document.getElementById('st-grp'), stats.groups, 1100);

    /* ---------- cinematic intro ---------- */
    setLoad('LIGHTING UP');
    paint();
    graph.cameraPosition({ x: 0, y: 90, z: 1750 }, { x: 0, y: 0, z: 0 }, 0);
    loadEl.classList.add('hidden');
    setTimeout(function () { graph.zoomToFit(2300, 64); }, 350);
    graph.onEngineStop(function () { graph.zoomToFit(900, 64); });

    /* deep-link: graph.html?focus=<node-id> */
    try {
      var qid = new URLSearchParams(location.search).get('focus');
      if (qid && nodeById[qid]) {
        setTimeout(function () { focusNode(nodeById[qid]); }, 1400);
      }
    } catch (e) { /* noop */ }

    /* ---------- resize ---------- */
    window.addEventListener('resize', function () {
      clearTimeout(window.__rz);
      window.__rz = setTimeout(function () {
        graph.width(window.innerWidth).height(window.innerHeight);
        if (bloomPass && bloomPass.setSize) bloomPass.setSize(window.innerWidth, window.innerHeight);
      }, 120);
    });

  }).catch(fatal);
})();
