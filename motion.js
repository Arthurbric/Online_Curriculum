/* =========================================================
   motion.js — camada de animação com GSAP 3.15
   ---------------------------------------------------------
   • Abertura em terminal (1x por sessão, clique/tecla pula)
   • Hero: nome "decodificado", foto revelada, números contando
   • Seções entrando ao rolar (ScrollTrigger)
   • Linha do tempo que acende conforme a leitura
   • Rolagem suave, luz no cursor, botões magnéticos e
     cards em 3D — só no desktop
   • No celular: as mesmas entradas, mais leves
   • Movimento reduzido: nada disso roda (ver <head>)
   O app.js continua desenhando o conteúdo; este arquivo só
   anima. Ele escuta o evento "aa:render" que o app.js dispara.
   ========================================================= */
(function () {
    'use strict';

    var root = document.documentElement;
    if (!root.classList.contains('gsap-on')) return;

    if (!window.gsap || !window.ScrollTrigger) {
        root.classList.remove('gsap-on');
        return;
    }

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, ScrambleTextPlugin);
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return gsap.utils.toArray((r || document).querySelectorAll(s)); };

    /* desktop "de verdade": mouse + tela larga. Decidido uma vez. */
    var isDesktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches;

    var ctx = null;          // contexto das animações de conteúdo (refeito ao trocar idioma)
    var rotator = null;      // timeline do texto que alterna no hero
    var smoother = null;
    var bootDone = null;     // promessa: abertura terminou (ou não houve)

    var BOOT_KEY = 'aa-booted';
    var CHARS = '01<>/{}#$%&*+=_ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /* =====================================================
       0. SOM (Web Audio — gerado na hora, sem arquivos)
       Navegadores só liberam áudio depois de um clique ou
       tecla. Antes disso, tudo fica em silêncio.
       ===================================================== */
    var Sound = (function () {
        var KEY = 'aa-sound';
        var ac = null, out = null, noise = null, unlocked = false;
        var enabled = true;
        try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { }

        function ensure() {
            if (!ac) {
                var AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                ac = new AC();
                out = ac.createGain();
                out.gain.value = 0.55;
                /* eco curto para dar "espaço" ao som */
                var delay = ac.createDelay(1);
                delay.delayTime.value = 0.19;
                var fb = ac.createGain();
                fb.gain.value = 0.28;
                var wet = ac.createGain();
                wet.gain.value = 0.22;
                out.connect(ac.destination);
                out.connect(delay);
                delay.connect(fb);
                fb.connect(delay);
                delay.connect(wet);
                wet.connect(ac.destination);
            }
            if (ac.state === 'suspended') ac.resume();
            return ac;
        }

        function unlock() {
            if (unlocked) return;
            if (ensure()) unlocked = true;
        }
        ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
            window.addEventListener(ev, unlock, { passive: true, capture: true });
        });

        function can() { return enabled && unlocked && ac && ac.state !== 'closed'; }

        function noiseBuffer() {
            if (noise) return noise;
            var len = ac.sampleRate * 1.5;
            noise = ac.createBuffer(1, len, ac.sampleRate);
            var d = noise.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            return noise;
        }

        function env(g, t, peak, a, r) {
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(peak, t + a);
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
        }

        /* "zoom": ruído filtrado que sobe e desce, passando da esquerda para a direita */
        function whoosh(o) {
            if (!can()) return;
            o = o || {};
            var t = ac.currentTime + 0.01;
            var dur = o.dur || 0.75;
            var src = ac.createBufferSource();
            src.buffer = noiseBuffer();
            var bp = ac.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 1.4;
            bp.frequency.setValueAtTime(o.from || 220, t);
            bp.frequency.exponentialRampToValueAtTime(o.peak || 3200, t + dur * 0.5);
            bp.frequency.exponentialRampToValueAtTime(o.to || 420, t + dur);
            var g = ac.createGain();
            env(g, t, o.vol || 0.5, dur * 0.45, dur * 0.55);
            var node = g;
            if (ac.createStereoPanner) {
                var pan = ac.createStereoPanner();
                pan.pan.setValueAtTime(-0.7, t);
                pan.pan.linearRampToValueAtTime(0.7, t + dur);
                g.connect(pan);
                node = pan;
            }
            src.connect(bp);
            bp.connect(g);
            node.connect(out);
            src.start(t);
            src.stop(t + dur + 0.05);
        }

        /* página aparecendo: subida grave + acorde brilhante */
        function appear() {
            if (!can()) return;
            var t = ac.currentTime + 0.02;

            var sub = ac.createOscillator();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(90, t);
            sub.frequency.exponentialRampToValueAtTime(220, t + 0.45);
            var sg = ac.createGain();
            env(sg, t, 0.32, 0.18, 0.8);
            sub.connect(sg);
            sg.connect(out);
            sub.start(t);
            sub.stop(t + 1.1);

            [659.25, 987.77, 1318.51, 1975.53].forEach(function (f, i) {
                var st = t + 0.2 + i * 0.075;
                [1, 2.005].forEach(function (mult, k) {
                    var o = ac.createOscillator();
                    o.type = k ? 'sine' : 'triangle';
                    o.frequency.value = f * mult;
                    var g = ac.createGain();
                    env(g, st, k ? 0.035 : 0.11, 0.012, 1.5 - i * 0.15);
                    o.connect(g);
                    g.connect(out);
                    o.start(st);
                    o.stop(st + 1.7);
                });
            });
        }

        /* clique curtinho, usado quando o carrossel troca de card */
        function tick() {
            if (!can()) return;
            var t = ac.currentTime + 0.005;
            var o = ac.createOscillator();
            o.type = 'square';
            o.frequency.setValueAtTime(1800, t);
            o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
            var g = ac.createGain();
            env(g, t, 0.035, 0.004, 0.05);
            var hp = ac.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 600;
            o.connect(hp);
            hp.connect(g);
            g.connect(out);
            o.start(t);
            o.stop(t + 0.08);
        }

        /* botão de som no topo */
        function mountButton() {
            var tools = $('.rail__tools');
            if (!tools || $('.soundbtn')) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'chipbtn chipbtn--icon soundbtn';
            b.innerHTML =
                '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>' +
                '<g class="snd-on"><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/></g>' +
                '<g class="snd-off"><path d="m16 9.5 5 5M21 9.5l-5 5"/></g>' +
                '</svg>';
            tools.insertBefore(b, tools.firstChild);
            function paint() {
                var pt = (root.lang || 'pt').indexOf('pt') === 0;
                b.setAttribute('aria-pressed', String(enabled));
                b.setAttribute('aria-label', enabled ? (pt ? 'Desligar som' : 'Turn sound off') : (pt ? 'Ligar som' : 'Turn sound on'));
                b.title = b.getAttribute('aria-label');
            }
            b.addEventListener('click', function () {
                enabled = !enabled;
                try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { }
                paint();
                if (enabled) { unlock(); whoosh({ dur: 0.45, vol: 0.3 }); }
            });
            document.addEventListener('aa:render', paint);
            paint();
            magnetic(b);
        }

        return {
            whoosh: whoosh, appear: appear, tick: tick, mountButton: mountButton,
            /* pronto para tocar (ou o visitante desligou o som: não há o que esperar) */
            ready: function () { return !enabled || unlocked; },
            enabled: function () { return enabled; }
        };
    })();

    /* =====================================================
       1. ABERTURA EM TERMINAL
       ===================================================== */
    function seenBoot() {
        try { return sessionStorage.getItem(BOOT_KEY) === '1'; } catch (e) { return false; }
    }

    function bootLang() {
        var l = '';
        try { l = localStorage.getItem('aa-lang') || ''; } catch (e) { }
        if (!l) l = (navigator.language || 'pt').toLowerCase().indexOf('pt') === 0 ? 'pt-BR' : 'en';
        return l === 'en' ? 'en' : 'pt';
    }

    function startBoot() {
        if (seenBoot()) return { finish: function (cb) { cb(); } };

        var enterText = bootLang() === 'en' ? '[ click to enter ]' : '[ clique para entrar ]';

        var boot = document.createElement('div');
        boot.className = 'boot';
        boot.setAttribute('aria-hidden', 'true');
        boot.innerHTML =
            '<div class="boot__term">' +
            '<p class="boot__line"><span class="boot__user">arash@cloud</span>:~<span class="boot__sign">$</span> <span class="boot__cmd"></span></p>' +
            '<p class="boot__line"><span class="boot__ok">[ ok ]</span> <span data-t="cloud ........ gcp"></span></p>' +
            '<p class="boot__line"><span class="boot__ok">[ ok ]</span> <span data-t="genai ........ online"></span></p>' +
            '<p class="boot__line"><span class="boot__ok">[ ok ]</span> <span data-t="k8s .......... ready"></span></p>' +
            '<p class="boot__line boot__line--hi"><span data-t="> welcome."></span></p>' +
            '<div class="boot__bar"><i></i></div>' +
            '<div class="boot__meta"><span class="boot__pct">000%</span><span>skip ⏎</span></div>' +
            '<p class="boot__enter">' + enterText + '</p>' +
            '</div>';
        document.body.appendChild(boot);

        var pct = { v: 0 };
        var pctEl = $('.boot__pct', boot);
        var tl = gsap.timeline();
        tl.to($('.boot__cmd', boot), { duration: 0.55, scrambleText: { text: './init --portfolio', chars: 'lowerCase', speed: 1 }, ease: 'none' })
            .to($('.boot__bar i', boot), { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0.2)
            .to(pct, {
                v: 100, duration: 1.15, ease: 'power2.inOut',
                onUpdate: function () { pctEl.textContent = String(Math.round(pct.v)).padStart(3, '0') + '%'; }
            }, 0.2);

        $$('[data-t]', boot).forEach(function (n, i) {
            gsap.set(n.parentNode, { autoAlpha: 0 });
            tl.set(n.parentNode, { autoAlpha: 1 }, 0.45 + i * 0.17)
                .to(n, { duration: 0.4, scrambleText: { text: n.getAttribute('data-t'), chars: CHARS, speed: 1.4 }, ease: 'none' }, 0.45 + i * 0.17);
        });

        var finished = false;
        var animDone = false;
        var prompted = false;
        var waiting = null;
        var autoTimer = null;

        function exit() {
            if (finished || !waiting) return;
            finished = true;
            clearTimeout(autoTimer);
            window.removeEventListener('keydown', onInput);
            boot.removeEventListener('pointerdown', onInput);
            try { sessionStorage.setItem(BOOT_KEY, '1'); } catch (e) { }

            /* sons: a página "aparece" e o painel dá o zoom */
            Sound.appear();
            gsap.delayedCall(0.18, function () { Sound.whoosh({ dur: 0.9, from: 180, peak: 3600, to: 380 }); });

            gsap.to(boot, {
                clipPath: 'inset(0% 0% 100% 0%)', duration: 0.85, ease: 'expo.inOut',
                onComplete: function () { boot.remove(); }
            });
            /* o hero começa enquanto a cortina sobe */
            gsap.delayedCall(0.35, waiting);
        }

        /* Fim da animação + conteúdo pronto. Se o áudio ainda não foi
           liberado por um clique, convida a entrar (e entra sozinho em 3 s). */
        function maybeExit() {
            if (!animDone || !waiting || finished) return;
            if (Sound.ready()) return exit();
            if (prompted) return;
            prompted = true;
            var enter = $('.boot__enter', boot);
            gsap.fromTo(enter, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5 });
            gsap.to(enter, { opacity: 0.45, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.5 });
            autoTimer = setTimeout(exit, 3000);
        }

        function onInput() {
            /* o clique/tecla também libera o som (ver Sound.unlock) */
            if (!animDone) tl.progress(1);
            else exit();
        }
        boot.addEventListener('pointerdown', onInput);
        window.addEventListener('keydown', onInput);

        tl.eventCallback('onComplete', function () { animDone = true; maybeExit(); });

        return {
            finish: function (cb) {
                /* só sai quando a animação terminou E o conteúdo chegou */
                waiting = cb;
                maybeExit();
            }
        };
    }

    var boot = startBoot();

    /* =====================================================
       2. ROLAGEM SUAVE (desktop)
       ===================================================== */
    function setupSmoother() {
        if (!isDesktop || !window.ScrollSmoother) return;

        var main = $('#main');
        var footer = $('.footer');
        if (!main || !footer) return;

        var wrapper = document.createElement('div');
        wrapper.id = 'smooth-wrapper';
        var content = document.createElement('div');
        content.id = 'smooth-content';
        main.parentNode.insertBefore(wrapper, main);
        wrapper.appendChild(content);
        content.appendChild(main);
        content.appendChild(footer);

        smoother = ScrollSmoother.create({
            wrapper: wrapper,
            content: content,
            smooth: 1.15,
            effects: true,
            smoothTouch: false
        });
        root.classList.add('has-smoother');
    }

    /* links internos (#experience, pular para o conteúdo…) */
    function goTo(hash) {
        var target = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
        if (!target) return false;
        Sound.whoosh({ dur: 0.7, vol: 0.35 });
        if (smoother) {
            smoother.scrollTo(target, true, 'top 92px');
        } else {
            var y = target.getBoundingClientRect().top + window.scrollY - 84;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
        if (target.id === 'main' || target.id === 'top') {
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        }
        return true;
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        if (goTo(a.getAttribute('href'))) {
            e.preventDefault();
            if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
        }
    });

    /* =====================================================
       3. EFEITOS QUE NÃO DEPENDEM DO CONTEÚDO
       ===================================================== */
    function setupChrome() {
        /* barra de progresso de leitura */
        var bar = document.createElement('div');
        bar.className = 'scrollbar';
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);
        gsap.to(bar, {
            scaleX: 1, ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
        });

        /* fundo com profundidade: grade e brilho andam mais devagar */
        gsap.to('.bg-grid', {
            backgroundPosition: '0px -260px', ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: true }
        });
        gsap.to('.bg-glow', {
            yPercent: -35, ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: true }
        });

        if (!isDesktop) return;

        /* luz que segue o cursor */
        var glow = document.createElement('div');
        glow.className = 'cursor-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(glow, document.body.firstChild);
        var gx = gsap.quickTo(glow, 'x', { duration: 0.8, ease: 'power3' });
        var gy = gsap.quickTo(glow, 'y', { duration: 0.8, ease: 'power3' });
        window.addEventListener('pointermove', function (e) {
            gx(e.clientX); gy(e.clientY);
            if (!glow._on) { glow._on = true; gsap.to(glow, { opacity: 1, duration: 0.6 }); }
        }, { passive: true });
        document.addEventListener('pointerleave', function () {
            glow._on = false; gsap.to(glow, { opacity: 0, duration: 0.6 });
        });

        /* botões do topo magnéticos (não são redesenhados) */
        $$('.chipbtn, .burger').forEach(magnetic);
    }

    /* =====================================================
       4. MICROINTERAÇÕES (desktop)
       ===================================================== */
    function magnetic(el) {
        if (!isDesktop || el._mag) return;
        el._mag = true;
        /* a transição CSS de transform atrasaria o movimento do GSAP */
        el.style.transition = 'box-shadow .28s, background .28s, color .28s, border-color .28s';
        var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
        var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
        el.addEventListener('pointermove', function (e) {
            var b = el.getBoundingClientRect();
            xTo((e.clientX - (b.left + b.width / 2)) * 0.35);
            yTo((e.clientY - (b.top + b.height / 2)) * 0.35);
        });
        el.addEventListener('pointerleave', function () {
            gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
        });
    }

    function tilt(el, max, lift) {
        if (!isDesktop || el._tilt) return;
        el._tilt = true;
        gsap.set(el, { transformPerspective: 900 });
        var rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
        var ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
        el.addEventListener('pointerenter', function () {
            /* a transição CSS de transform brigaria com o GSAP */
            el.style.transition = 'border-color .35s, box-shadow .35s';
            if (lift) gsap.to(el, { y: -lift, duration: 0.4 });
        });
        el.addEventListener('pointermove', function (e) {
            var b = el.getBoundingClientRect();
            var px = (e.clientX - b.left) / b.width - 0.5;
            var py = (e.clientY - b.top) / b.height - 0.5;
            ry(px * max * 2);
            rx(-py * max * 2);
        });
        el.addEventListener('pointerleave', function () {
            gsap.to(el, { rotationX: 0, rotationY: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
        });
    }

    /* =====================================================
       5. HERO
       ===================================================== */
    function countUp(node) {
        var raw = node.textContent.trim();
        var m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
        if (!m) return null;
        var target = parseFloat(m[2].replace(',', '.'));
        var obj = { v: 0 };
        node.textContent = m[1] + '0' + m[3];
        return gsap.to(obj, {
            v: target, duration: 1.6, ease: 'power2.out',
            onUpdate: function () { node.textContent = m[1] + Math.round(obj.v) + m[3]; }
        });
    }

    function startRotator(words) {
        if (rotator) rotator.kill();
        var node = $('[data-slot="rotator"]');
        if (!node || !words || !words.length) return;
        node.textContent = words[0];
        rotator = gsap.timeline({ repeat: -1, delay: 2.2 });
        words.slice(1).concat(words[0]).forEach(function (w) {
            rotator.to(node, { duration: 0.9, scrambleText: { text: w, chars: CHARS, speed: 0.7 }, ease: 'none' })
                .to({}, { duration: 1.9 });
        });
    }

    function heroIntro(d, first) {
        var tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.1 } });
        var name = $('.hero__name');
        var fullName = d.profile.name;

        root.classList.add('motion-ready');

        if (first) {
            tl.from('.rail', { yPercent: -110, autoAlpha: 0, duration: 0.9 }, 0);
        } else {
            gsap.set('.rail', { autoAlpha: 1 });
        }

        tl.fromTo('.hero__panel',
            { clipPath: 'inset(14% 10% 14% 10% round 26px)', autoAlpha: 0, scale: 0.97 },
            { clipPath: 'inset(0% 0% 0% 0% round 16px)', autoAlpha: 1, scale: 1, duration: 1.3, clearProps: 'clipPath,scale' }, 0.05);

        /* terminal digita o comando */
        var cmd = $('.term__cmd');
        if (cmd) {
            if (!cmd.dataset.text) cmd.dataset.text = cmd.textContent;
            cmd.textContent = '';
            tl.to(cmd, { duration: 0.6, scrambleText: { text: cmd.dataset.text, chars: 'lowerCase', speed: 1 }, ease: 'none' }, 0.35);
        }

        /* nome "decodificado" — mantém o texto real para leitores de tela */
        if (name) {
            name.setAttribute('aria-label', fullName);
            tl.fromTo(name, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.4)
                .to(name, {
                    duration: 1.5,
                    scrambleText: { text: fullName, chars: CHARS, revealDelay: 0.35, speed: 0.55 },
                    ease: 'none'
                }, 0.4);
        }

        tl.from('.hero__role', { autoAlpha: 0, x: -14, duration: 0.8 }, 0.9);

        /* resumo sobe linha a linha */
        var sum = $('.hero__sum');
        if (sum) {
            var split = SplitText.create(sum, { type: 'lines', mask: 'lines' });
            tl.from(split.lines, {
                yPercent: 105, duration: 1, stagger: 0.07,
                onComplete: function () { split.revert(); }
            }, 1.0);
        }

        tl.from('.hero__cta .btn', { y: 22, autoAlpha: 0, stagger: 0.1, duration: 0.8, ease: 'back.out(1.8)', clearProps: 'transform' }, 1.25)
            .from('.hero__links li', { y: 14, autoAlpha: 0, stagger: 0.06, duration: 0.6 }, 1.35);

        /* foto revelada em círculo, com zoom saindo */
        var avatar = $('.avatar');
        if (avatar) {
            tl.fromTo(avatar,
                { clipPath: 'circle(0% at 50% 50%)' },
                { clipPath: 'circle(75% at 50% 50%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.45)
                .from('.avatar img', { scale: 1.35, duration: 1.8, ease: 'expo.out', clearProps: 'transform' }, 0.55);
        }

        /* números contam */
        $$('.stat').forEach(function (s, i) {
            tl.from(s, { y: 24, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', clearProps: 'transform' }, 1.0 + i * 0.08);
            var v = $('.stat__value', s);
            var c = v && countUp(v);
            if (c) tl.add(c, 1.05 + i * 0.08);
        });

        tl.from('.ticker', { autoAlpha: 0, y: 26, duration: 1 }, 1.3);

        tl.add(function () { startRotator(d.profile.rotatingWords); }, 1.2);
        return tl;
    }

    /* =====================================================
       6. SEÇÕES AO ROLAR
       ===================================================== */
    var ONCE = { start: 'top 86%', once: true };

    function sectionHeads() {
        $$('.shead').forEach(function (head) {
            var tag = $('.shead__tag', head);
            var h2 = $('h2', head);
            var rule = $('.shead__rule', head);
            var tl = gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 88%', once: true } });

            if (tag) {
                var tagText = tag.textContent;
                tl.from(tag, { autoAlpha: 0, x: -16, duration: 0.6 }, 0)
                    .to(tag, { duration: 0.8, scrambleText: { text: tagText, chars: CHARS, speed: 0.8 }, ease: 'none' }, 0);
            }
            if (h2 && h2.textContent.trim()) {
                var split = SplitText.create(h2, { type: 'chars,words', mask: 'words' });
                tl.from(split.chars, {
                    yPercent: 110, rotation: 6, duration: 0.85, stagger: 0.018, ease: 'expo.out',
                    onComplete: function () { split.revert(); }
                }, 0.05);
            }
            if (rule) tl.from(rule, { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'expo.out' }, 0.2);
        });
    }

    /* entrada em lote: esconde agora, revela quando aparecer */
    function batch(selector, from, opts) {
        var items = $$(selector);
        if (!items.length) return;
        opts = opts || {};
        gsap.set(items, Object.assign({ autoAlpha: 0, transition: 'none' }, from));
        ScrollTrigger.batch(items, {
            start: opts.start || 'top 88%',
            once: true,
            onEnter: function (els) {
                gsap.to(els, {
                    autoAlpha: 1, x: 0, y: 0, scale: 1, rotationX: 0, rotation: 0,
                    duration: opts.duration || 0.95,
                    ease: opts.ease || 'expo.out',
                    stagger: opts.stagger || 0.09,
                    overwrite: true,
                    clearProps: 'transition,transform,opacity,visibility',
                    onComplete: opts.onComplete
                });
            }
        });
    }

    function experience() {
        var track = $('.track');
        if (!track) return;

        var fill = $('.track__fill', track);
        if (!fill) {
            fill = document.createElement('span');
            fill.className = 'track__fill';
            fill.setAttribute('aria-hidden', 'true');
            track.prepend(fill);
        }
        gsap.fromTo(fill, { scaleY: 0 }, {
            scaleY: 1, ease: 'none',
            scrollTrigger: { trigger: track, start: 'top 72%', end: 'bottom 72%', scrub: 0.6 }
        });

        $$('.node', track).forEach(function (node) {
            gsap.set(node, { transition: 'none' });
            var tl = gsap.timeline({ scrollTrigger: { trigger: node, start: 'top 85%', once: true } });
            tl.from(node, {
                x: isDesktop ? 70 : 0, y: isDesktop ? 0 : 40, autoAlpha: 0, duration: 1, ease: 'expo.out',
                clearProps: 'transition,transform,opacity,visibility'
            });
            var lis = $$('li', node);
            if (lis.length) tl.from(lis, { x: -12, autoAlpha: 0, stagger: 0.06, duration: 0.6, clearProps: 'all' }, 0.25);
            var tags = $$('.tag', node);
            if (tags.length) tl.from(tags, { scale: 0.6, autoAlpha: 0, stagger: 0.04, duration: 0.5, ease: 'back.out(2)', clearProps: 'all' }, 0.45);

            /* o ponto acende quando a linha chega nele */
            ScrollTrigger.create({
                trigger: node, start: 'top 72%',
                onEnter: function () { node.classList.add('is-lit'); },
                onLeaveBack: function () { node.classList.remove('is-lit'); }
            });
        });

        gsap.from('.other', { y: 30, autoAlpha: 0, duration: 0.9, scrollTrigger: { trigger: '.other', start: 'top 92%', once: true } });
    }

    function skills() {
        batch('.board .panel', { y: 60, rotationX: isDesktop ? -12 : 0, transformPerspective: 900 }, { stagger: 0.14 });

        var chips = $$('.cloud span');
        if (chips.length) {
            gsap.from(chips, {
                scale: 0.4, autoAlpha: 0, duration: 0.7, ease: 'back.out(2.2)',
                stagger: { each: 0.035, from: 'random' }, clearProps: 'all',
                scrollTrigger: { trigger: '.cloud', start: 'top 88%', once: true }
            });
        }

        /* radar de idiomas: teia aparece, forma "cresce" com mola */
        var radar = $('.radar svg');
        if (radar) {
            var vb = radar.viewBox.baseVal;
            var c = (vb.width / 2) + ' ' + (vb.height / 2);
            var tl = gsap.timeline({ scrollTrigger: { trigger: radar, start: 'top 85%', once: true } });
            tl.from($$('.web', radar), { scale: 0, svgOrigin: c, autoAlpha: 0, stagger: 0.09, duration: 0.8, ease: 'expo.out' })
                .from($$('.spoke', radar), { scale: 0, svgOrigin: c, stagger: 0.05, duration: 0.6 }, 0.1)
                .from($$('.shape', radar), { scale: 0, svgOrigin: c, duration: 1.6, ease: 'elastic.out(1, 0.45)' }, 0.35)
                .from($$('.pt', radar), { scale: 0, transformOrigin: '50% 50%', stagger: 0.08, duration: 0.5, ease: 'back.out(3)' }, 0.75)
                .from($$('.lbl', radar), { autoAlpha: 0, stagger: 0.06, duration: 0.5 }, 0.6)
                .from('.radar__legend li', { x: -14, autoAlpha: 0, stagger: 0.06, duration: 0.6, clearProps: 'all' }, 0.7);
        }

        batch('.stackcard', { y: 70, rotationX: isDesktop ? -20 : 0, transformPerspective: 900 }, { stagger: 0.1 });
    }

    /* carrossel horizontal: ao rolar para baixo, os cards andam para a direita→esquerda */
    function hCarousel(section, track, itemSel, cardWidthCss) {
        if (!section || !track) return false;
        var items = $$(itemSel, track);
        if (items.length < 3) return false;

        section.classList.add('is-hscroll');

        var vp = track.parentNode.classList.contains('hs__viewport') ? track.parentNode : null;
        if (!vp) {
            vp = document.createElement('div');
            vp.className = 'hs__viewport';
            track.parentNode.insertBefore(vp, track);
            vp.appendChild(track);
        }
        var meta = vp.nextElementSibling && vp.nextElementSibling.classList.contains('hs__meta') ? vp.nextElementSibling : null;
        if (!meta) {
            meta = document.createElement('div');
            meta.className = 'hs__meta';
            meta.setAttribute('aria-hidden', 'true');
            meta.innerHTML = '<span class="hs__count"></span><span class="hs__bar"><i></i></span><span class="hs__hint">scroll ↓</span>';
            vp.parentNode.insertBefore(meta, vp.nextSibling);
        }
        track.style.setProperty('--hs-card', cardWidthCss);

        var count = $('.hs__count', meta);
        var bar = $('.hs__bar i', meta);
        var total = items.length;
        var pad = function (n) { return String(n).padStart(2, '0'); };
        count.textContent = pad(1) + ' / ' + pad(total);

        function dist() {
            var cs = getComputedStyle(vp);
            var inner = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            return Math.max(0, track.scrollWidth - inner);
        }

        /* fixa o bloco inteiro (título + cards) se couber na tela; senão, só a fileira */
        var wrap = $('.wrap', section);
        var fits = wrap && wrap.offsetHeight < window.innerHeight - 110;
        var pinEl = fits ? wrap : vp;
        var start = fits ? 'center 54%' : 'center 55%';

        var last = 0;
        var move = gsap.to(track, {
            x: function () { return -dist(); },
            ease: 'none',
            scrollTrigger: {
                trigger: pinEl,
                pin: pinEl,
                start: start,
                end: function () { return '+=' + Math.max(dist(), 1) * 0.45; /* menos rolagem */ },
                scrub: 0.8,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                /* para sempre com um card alinhado, como um carrossel */
                snap: {
                    snapTo: function (v) {
                        var d = dist();
                        if (!d) return v;
                        var x0 = items[0].offsetLeft;
                        var pts = items.map(function (c) { return Math.min(1, (c.offsetLeft - x0) / d); });
                        pts.push(1);
                        return pts.reduce(function (a, b) { return Math.abs(b - v) < Math.abs(a - v) ? b : a; });
                    },
                    duration: { min: 0.25, max: 0.7 },
                    delay: 0.1,
                    ease: 'power2.inOut'
                },
                onUpdate: function (self) {
                    bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
                    var idx = Math.round(self.progress * (total - 1));
                    if (idx !== last) {
                        last = idx;
                        count.textContent = pad(idx + 1) + ' / ' + pad(total);
                        Sound.tick();
                    }
                },
                onEnter: function () { Sound.whoosh({ dur: 0.6, vol: 0.28, from: 300, peak: 2400, to: 500 }); }
            }
        });

        /* cada card "entra" girando um pouco quando chega pela direita */
        items.forEach(function (card) {
            gsap.fromTo(card,
                { autoAlpha: 0.2, scale: 0.86, rotationY: isDesktop ? -22 : -10, transformPerspective: 1100, transformOrigin: '0% 50%' },
                {
                    autoAlpha: 1, scale: 1, rotationY: 0, ease: 'none',
                    scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 100%', end: 'left 84%', scrub: true }
                });
        });
        return true;
    }

    function projects() {
        if (hCarousel($('#projects'), $('.repos'), '.repo', 'min(320px, 74vw)')) return;
        batch('.repo', { y: 80, scale: 0.94 }, {
            stagger: 0.08,
            onComplete: function () { this.targets().forEach(function (el) { tilt(el, 7, 6); }); }
        });
    }

    function credentials() {
        batch('.edu__item', { y: 40 }, { stagger: 0.1 });
        if (!hCarousel($('#certifications'), $('.certs'), '.cert', 'min(260px, 68vw)')) {
            batch('.cert', { y: 50, scale: 0.96 }, { stagger: 0.07 });
        }
        gsap.from('.courses', { y: 24, autoAlpha: 0, duration: 0.8, scrollTrigger: { trigger: '.courses', start: 'top 92%', once: true } });
    }

    function contact() {
        var panel = $('.footer__panel');
        if (!panel) return;
        var tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 85%', once: true } });
        tl.fromTo(panel, { y: 60, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });

        var title = $('.footer__title', panel);
        if (title && title.textContent.trim()) {
            var split = SplitText.create(title, { type: 'chars,words', mask: 'words' });
            tl.from(split.chars, {
                yPercent: 120, duration: 0.9, stagger: 0.025, ease: 'expo.out',
                onComplete: function () { split.revert(); }
            }, 0.15);
        }
        tl.from('.footer__lead', { y: 18, autoAlpha: 0, duration: 0.7 }, 0.35)
            .from('.footer__mail', { scale: 0.85, autoAlpha: 0, duration: 0.8, ease: 'back.out(2)', clearProps: 'transform' }, 0.45)
            .from('.footer__links li', { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.6 }, 0.55);

        /* e-mail se "redecodifica" ao passar o mouse */
        var mail = $('.footer__mail', panel);
        if (mail && isDesktop) {
            mail.addEventListener('pointerenter', function () {
                gsap.to(mail, { duration: 0.7, scrambleText: { text: mail.textContent, chars: CHARS, speed: 1 }, ease: 'none', overwrite: true });
            });
            magnetic(mail);
        }
    }

    /* faixa de competências: acelera e inverte com a rolagem */
    function ticker() {
        var track = $('.ticker__track');
        if (!track) return;
        var loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 40, repeat: -1 });
        loop.totalTime(40 * 500);          // folga para poder rodar ao contrário
        var dir = 1;
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: function (self) {
                var v = self.getVelocity();
                if (self.direction !== dir) dir = self.direction;
                var boost = gsap.utils.clamp(1, 7, 1 + Math.abs(v) / 350);
                gsap.to(loop, { timeScale: boost * dir, duration: 0.2, overwrite: true });
                gsap.to(loop, { timeScale: dir, duration: 1.4, delay: 0.25, overwrite: false });
            }
        });
        track.parentNode.addEventListener('pointerenter', function () { gsap.to(loop, { timeScale: 0.15, duration: 0.6, overwrite: true }); });
        track.parentNode.addEventListener('pointerleave', function () { gsap.to(loop, { timeScale: dir, duration: 0.6, overwrite: true }); });
    }

    /* =====================================================
       7. ORQUESTRAÇÃO
       ===================================================== */
    function build(d, first) {
        if (ctx) ctx.revert();
        ctx = gsap.context(function () {
            var tl = heroIntro(d, first);
            if (!first) tl.progress(0.55);          // troca de idioma: entrada curta

            sectionHeads();
            experience();
            skills();
            projects();
            credentials();
            contact();
            ticker();

            $$('.hero__cta .btn').forEach(magnetic);
            var avatar = $('.avatar');
            if (avatar) tilt(avatar, 10, 0);
        });
        ScrollTrigger.refresh();
    }

    /* "Mostrar outras experiências": anima os cards que aparecem */
    document.addEventListener('click', function (e) {
        if (!e.target.closest || !e.target.closest('#otherBtn')) return;
        requestAnimationFrame(function () {
            var panel = $('#otherPanel');
            if (panel && !panel.hidden) {
                gsap.from($$('.mini', panel), {
                    y: 40, autoAlpha: 0, stagger: 0.07, duration: 0.8, ease: 'expo.out', clearProps: 'all'
                });
            }
            ScrollTrigger.refresh();
        });
    });

    setupSmoother();
    setupChrome();
    Sound.mountButton();
    var themeBtn = $('#themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', function () { Sound.whoosh({ dur: 0.65, vol: 0.3, from: 500, peak: 4200, to: 900 }); });

    document.addEventListener('aa:render', function (e) {
        var d = e.detail.data;
        var first = e.detail.first;
        if (first) {
            boot.finish(function () { build(d, true); });
        } else {
            gsap.fromTo('#main', { autoAlpha: 0.35 }, { autoAlpha: 1, duration: 0.5, clearProps: 'all' });
            build(d, false);
        }
    });

    /* fontes e imagens mudam alturas: recalcula os gatilhos */
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
