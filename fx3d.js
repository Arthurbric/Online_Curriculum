/* =========================================================
   fx3d.js — globo 3D de rede (opcional)
   ---------------------------------------------------------
   Uma esfera de pontos conectados, como uma rede em nuvem,
   girando atrás do topo do site. Segue o mouse, acelera com a
   rolagem e usa as cores do tema (claro/escuro).
   Sem bibliotecas: só <canvas>.

   COMO TIRAR:   apague a linha  <script src="fx3d.js"></script>
                 do index.html (ou troque FX3D_LIGADO para false).
   COMO TESTAR:  no console do navegador, AA3D.off() / AA3D.on()
   ========================================================= */
(function () {
    'use strict';

    var FX3D_LIGADO = true;

    if (!FX3D_LIGADO) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var small = window.matchMedia('(max-width: 760px)').matches;
    /* desktop: fundo do topo (sai pela borda do painel);
       celular: dentro do painel, atrás da foto (senão o vidro borra) */
    var host = document.querySelector(small ? '.hero__right' : '.hero');
    if (!host || !document.createElement('canvas').getContext) return;

    /* ---------- configuração ---------- */
    var CFG = {
        points: small ? 110 : 220,     // quantidade de pontos no globo
        links: 3,                      // ligações por ponto
        spin: 0.0016,                  // giro automático
        mouseTilt: 0.35,               // quanto o mouse inclina o globo
        size: small ? 1.55 : 0.62      // tamanho em relação à largura da área
    };

    /* ---------- estilo (injetado aqui para ficar tudo em um arquivo) ---------- */
    var css = document.createElement('style');
    css.textContent =
        '.fx3d{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}' +
        '.fx3d canvas{position:absolute;display:block}' +
        '.hero>.wrap{position:relative;z-index:1}' +
        '.hero__right{position:relative}' +
        '.hero__right>.fx3d{overflow:visible}' +
        '.hero__right>.avatar,.hero__right>.stats,.hero__left{position:relative;z-index:1}';
    document.head.appendChild(css);

    var layer = document.createElement('div');
    layer.className = 'fx3d';
    layer.setAttribute('aria-hidden', 'true');
    var cv = document.createElement('canvas');
    layer.appendChild(cv);
    host.insertBefore(layer, host.firstChild);
    var ctx = cv.getContext('2d');

    /* ---------- geometria: esfera de Fibonacci ---------- */
    var P = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < CFG.points; i++) {
        var y = 1 - (i / (CFG.points - 1)) * 2;
        var r = Math.sqrt(1 - y * y);
        var th = golden * i;
        P.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    /* liga cada ponto aos vizinhos mais próximos */
    var E = [];
    var seen = {};
    P.forEach(function (a, ia) {
        var d = P.map(function (b, ib) {
            var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
            return [dx * dx + dy * dy + dz * dz, ib];
        }).sort(function (m, n) { return m[0] - n[0]; });
        for (var k = 1; k <= CFG.links; k++) {
            var ib = d[k][1];
            var key = ia < ib ? ia + '-' + ib : ib + '-' + ia;
            if (!seen[key]) { seen[key] = 1; E.push([ia, ib]); }
        }
    });
    /* anéis de órbita com um "satélite" cada */
    var RINGS = [
        { tilt: 1.15, yaw: 0.4, r: 1.32, speed: 0.9 },
        { tilt: -0.55, yaw: -0.9, r: 1.5, speed: -0.6 }
    ];

    /* ---------- estado ---------- */
    var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
    var rotY = 0.6, rotX = -0.25;
    var tiltX = 0, tiltY = 0, tx = 0, ty = 0;
    var boost = 0, lastScroll = window.scrollY;
    var colA = '#3ddbd9', colB = '#4d8dff', light = false;
    var running = true, visible = true, raf = 0, t0 = performance.now();

    function readColors() {
        var cs = getComputedStyle(document.documentElement);
        colA = (cs.getPropertyValue('--cyan') || colA).trim();
        colB = (cs.getPropertyValue('--blue') || colB).trim();
        light = document.documentElement.getAttribute('data-theme') === 'light';
    }

    function resize() {
        var b = host.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = b.width;
        H = b.height;
        var side = Math.min(W * CFG.size, small ? 520 : 760);
        cv.style.width = side + 'px';
        cv.style.height = side + 'px';
        /* desktop: à direita, saindo da borda do painel;
           celular: centralizado atrás da foto, como um halo */
        var av = document.querySelector('.avatar');
        if (small && av) {
            var ab = av.getBoundingClientRect();
            cv.style.left = (ab.left - b.left + ab.width / 2 - side / 2) + 'px';
            cv.style.top = (ab.top - b.top + ab.height / 2 - side / 2) + 'px';
        } else if (small) {
            cv.style.left = (W - side) / 2 + 'px';
            cv.style.top = '40px';
        } else {
            cv.style.left = (W - side * 0.86) + 'px';
            cv.style.top = Math.max(10, (H - side) * 0.35) + 'px';
        }
        cv.width = side * dpr;
        cv.height = side * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        R = side * 0.34;
        cx = cy = side / 2;
    }

    function project(p, sy, cyy, sx, cxx) {
        /* gira em Y, depois em X, e aplica perspectiva */
        var x = p[0] * cyy + p[2] * sy;
        var z = -p[0] * sy + p[2] * cyy;
        var y = p[1] * cxx - z * sx;
        z = p[1] * sx + z * cxx;
        var f = 3 / (3 + z);
        return [cx + x * R * f, cy + y * R * f, z, f];
    }

    function frame(now) {
        raf = 0;
        if (!running || !visible) return;
        var dt = Math.min(50, now - t0);
        t0 = now;

        /* inércia do mouse e da rolagem */
        tx += (tiltX - tx) * 0.05;
        ty += (tiltY - ty) * 0.05;
        boost *= 0.94;
        rotY += (CFG.spin + boost) * dt / 16;
        var ay = rotY + tx * CFG.mouseTilt;
        var ax = rotX + ty * CFG.mouseTilt;
        var sy = Math.sin(ay), cyy = Math.cos(ay), sx = Math.sin(ax), cxx = Math.cos(ax);

        var side = cv.width / dpr;
        ctx.clearRect(0, 0, side, side);

        /* brilho no centro */
        var g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
        g.addColorStop(0, hexA(colA, light ? 0.10 : 0.16));
        g.addColorStop(1, hexA(colA, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, side, side);

        var Q = P.map(function (p) { return project(p, sy, cyy, sx, cxx); });

        /* ligações: mais fortes na frente */
        ctx.lineWidth = 1;
        for (var e = 0; e < E.length; e++) {
            var a = Q[E[e][0]], b = Q[E[e][1]];
            var depth = (a[2] + b[2]) / 2;           // -1 (frente) .. 1 (trás)
            var al = (0.5 - depth * 0.42) * (light ? 0.45 : 0.55);
            if (al <= 0.02) continue;
            ctx.strokeStyle = hexA(depth < 0 ? colA : colB, al);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
        }

        /* pontos */
        for (var q = 0; q < Q.length; q++) {
            var s = Q[q];
            var front = s[2] < 0;
            ctx.fillStyle = hexA(front ? colA : colB, front ? 0.95 : 0.35);
            ctx.beginPath();
            ctx.arc(s[0], s[1], (front ? 1.9 : 1.2) * s[3], 0, 6.283);
            ctx.fill();
        }

        /* órbitas + satélites */
        var tt = now / 1000;
        RINGS.forEach(function (ring, ri) {
            var st = Math.sin(ring.tilt), ct = Math.cos(ring.tilt);
            var sw = Math.sin(ring.yaw), cw = Math.cos(ring.yaw);
            function ringPt(u) {
                var x = Math.cos(u) * ring.r, z = Math.sin(u) * ring.r;
                var y = z * st; z = z * ct;                    // inclina o anel
                var x2 = x * cw + z * sw; z = -x * sw + z * cw; // gira o anel
                return project([x2, y, z], sy, cyy, sx, cxx);
            }
            ctx.strokeStyle = hexA(ri ? colB : colA, light ? 0.22 : 0.28);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            for (var k = 0; k <= 72; k++) {
                var pt = ringPt(k / 72 * 6.283);
                if (k) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            var sat = ringPt(tt * ring.speed + ri * 2);
            ctx.fillStyle = hexA(ri ? colB : colA, 1);
            ctx.shadowColor = ri ? colB : colA;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(sat[0], sat[1], 3.4 * sat[3], 0, 6.283);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        raf = requestAnimationFrame(frame);
    }

    /* cor CSS (#hex ou rgb) com transparência */
    var cache = {};
    function hexA(c, a) {
        var key = c;
        var rgb = cache[key];
        if (!rgb) {
            var probe = document.createElement('span');
            probe.style.color = c;
            document.body.appendChild(probe);
            var m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [61, 219, 217];
            probe.remove();
            rgb = cache[key] = m.slice(0, 3).join(',');
        }
        return 'rgba(' + rgb + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
    }

    function start() {
        if (!raf && running && visible) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    }

    /* ---------- eventos ---------- */
    window.addEventListener('pointermove', function (e) {
        tiltX = (e.clientX / window.innerWidth - 0.5) * 2;
        tiltY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('scroll', function () {
        var y = window.scrollY;
        boost = Math.min(0.06, boost + Math.abs(y - lastScroll) * 0.00012);
        lastScroll = y;
    }, { passive: true });

    window.addEventListener('resize', resize);

    /* só desenha quando o topo está na tela e a aba está aberta */
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
            visible = en[0].isIntersecting;
            start();
        }).observe(host);
    }
    document.addEventListener('visibilitychange', function () {
        visible = !document.hidden;
        start();
    });

    /* acompanha a troca de tema */
    new MutationObserver(function () { cache = {}; readColors(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* o conteúdo do hero muda de altura ao carregar o JSON */
    document.addEventListener('aa:render', function () { setTimeout(resize, 50); });

    /* entrada suave (usa o GSAP se existir) */
    if (window.gsap) {
        gsap.fromTo(cv, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 2.2, ease: 'expo.out', delay: 0.8 });
    }

    /* ---------- liga/desliga pelo console ---------- */
    window.AA3D = {
        off: function () { running = false; layer.style.display = 'none'; },
        on: function () { running = true; layer.style.display = ''; start(); }
    };

    readColors();
    resize();
    start();
})();
