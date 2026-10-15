/* =========================================================
   Versão B — Console · JavaScript puro, sem dependências
   ========================================================= */
(function () {
    'use strict';

    var LANGS = ['pt-BR', 'en'];
    var LS_THEME = 'aa-theme';
    var LS_LANG = 'aa-lang';
    var SVGNS = 'http://www.w3.org/2000/svg';

    /* Experiência: quantos tópicos mostrar antes do botão "+ detalhes".
       Use 0 para mostrar todos (comportamento da V1). */
    var EXP_PREVIEW = 2;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* quando a camada GSAP (motion.js) está ativa, ela assume as animações */
    function motionOn() { return document.documentElement.classList.contains('gsap-on'); }
    var data = null;
    var rotatorTimer = null;

    /* Base do site: deduzida do próprio <script>, em .../<base>/vN/app.js.
       Assim os caminhos funcionam na raiz (arash.com.br) e também numa
       prévia em subpasta (arthurbric.github.io/Online_Curriculum/v1/). */
    var BASE = new URL('.', document.baseURI).href;

    function url(path) {
        if (!path) return path;
        if (/^(https?:|mailto:|tel:|data:|#)/i.test(path)) return path;
        return path.charAt(0) === '/' ? BASE + path.slice(1) : path;
    }

    /* ---------- utilidades ---------- */
    function $(s, r) { return (r || document).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function slot(n, r) { return (r || document).querySelector('[data-slot="' + n + '"]'); }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function svg(tag, attrs) {
        var n = document.createElementNS(SVGNS, tag);
        for (var k in attrs) n.setAttribute(k, attrs[k]);
        return n;
    }

    function setText(n, v) {
        var node = slot(n);
        if (node) node.textContent = v == null ? '' : v;
    }

    var ARROW = '<svg class="repo__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

    var ICONS = {
        cloud: '<path d="M7.2 19h9.3a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.7 3.7 0 0 0 7.2 19Z"/>',
        server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
        code: '<path d="m8 17-5-5 5-5M16 7l5 5-5 5M14 4l-4 16"/>',
        database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
        briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M2.5 12.5h19"/>'
    };

    /* ---------- idioma e tema ---------- */
    function storedLang() {
        try {
            var v = localStorage.getItem(LS_LANG);
            if (v && LANGS.indexOf(v) > -1) return v;
        } catch (e) { }
        return (navigator.language || 'pt').toLowerCase().indexOf('pt') === 0 ? 'pt-BR' : 'en';
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    function applyTheme(t, persist) {
        document.documentElement.setAttribute('data-theme', t);
        if (persist) { try { localStorage.setItem(LS_THEME, t); } catch (e) { } }
        var btn = $('#themeBtn');
        if (btn && data) btn.setAttribute('aria-label', t === 'dark' ? data.ui.themeLight : data.ui.themeDark);
    }

    /* ---------- reveal ---------- */
    var observer = null;

    function initReveal() {
        var sel = '.node, .mini, .panel, .stackcard, .repo, .cert, .edu__item, .shead, .courses, .other, .footer__panel';
        var targets = $$(sel);
        if (motionOn()) return;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach(function (t) { t.classList.add('is-visible'); });
            return;
        }
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                var i = Number(e.target.getAttribute('data-stagger') || 0);
                setTimeout(function () { e.target.classList.add('is-visible'); }, i * 65);
                observer.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
        targets.forEach(function (t) { observer.observe(t); });
    }

    /* ---------- rotator ---------- */
    function startRotator(words) {
        var node = slot('rotator');
        if (!node || !words || !words.length) return;
        if (rotatorTimer) clearTimeout(rotatorTimer);
        if (reduceMotion || motionOn()) { node.textContent = words[0]; return; }
        var w = 0, c = 0, back = false;
        (function tick() {
            var word = words[w];
            c += back ? -1 : 1;
            node.textContent = word.slice(0, c);
            var d = back ? 30 : 58;
            if (!back && c === word.length) { back = true; d = 1600; }
            else if (back && c === 0) { back = false; w = (w + 1) % words.length; d = 280; }
            rotatorTimer = setTimeout(tick, d);
        })();
    }

    /* ---------- radar de idiomas ---------- */
    function buildRadar(langs) {
        var host = slot('radar');
        host.innerHTML = '';

        var size = 240, cx = size / 2, cy = size / 2, R = 86;
        var n = langs.length;
        var s = svg('svg', {
            viewBox: '0 0 ' + size + ' ' + size,
            role: 'img',
            'aria-label': langs.map(function (l) { return l.name + ': ' + l.level; }).join(', ')
        });

        function point(i, r) {
            var a = (Math.PI * 2 * i) / n - Math.PI / 2;
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        }

        // teias concêntricas
        [0.25, 0.5, 0.75, 1].forEach(function (f) {
            var pts = [];
            for (var i = 0; i < n; i++) pts.push(point(i, R * f).join(','));
            s.appendChild(svg('polygon', { class: 'web', points: pts.join(' ') }));
        });

        // raios + rótulos
        for (var i = 0; i < n; i++) {
            var p = point(i, R);
            s.appendChild(svg('line', { class: 'spoke', x1: cx, y1: cy, x2: p[0], y2: p[1] }));

            var lp = point(i, R + 22);
            var t = svg('text', {
                class: 'lbl',
                x: lp[0],
                y: lp[1],
                'text-anchor': lp[0] > cx + 4 ? 'start' : (lp[0] < cx - 4 ? 'end' : 'middle'),
                'dominant-baseline': 'middle'
            });
            t.textContent = langs[i].name.split(' /')[0];
            s.appendChild(t);
        }

        // forma dos valores
        var shape = [];
        for (var j = 0; j < n; j++) shape.push(point(j, R * (langs[j].value / 100)).join(','));
        s.appendChild(svg('polygon', { class: 'shape', points: shape.join(' ') }));

        for (var k = 0; k < n; k++) {
            var pp = point(k, R * (langs[k].value / 100));
            s.appendChild(svg('circle', { class: 'pt', cx: pp[0], cy: pp[1], r: 3 }));
        }

        host.appendChild(s);

        var legend = slot('radarLegend');
        legend.innerHTML = '';
        langs.forEach(function (l) {
            var li = el('li');
            li.appendChild(el('span', null, l.name));
            li.appendChild(el('b', null, l.level));
            legend.appendChild(li);
        });
    }

    /* ---------- render ---------- */
    function render(d) {
        data = d;
        var ui = d.ui, p = d.profile;

        document.documentElement.lang = d.meta.htmlLang;
        document.title = d.meta.title;
        var desc = $('meta[name="description"]');
        if (desc) desc.setAttribute('content', d.meta.description);

        setText('initials', p.initials);
        setText('langLabel', d.meta.switchTo.label);
        $('#langBtn').setAttribute('aria-label', ui.langSwitch);

        var navUl = slot('nav');
        navUl.innerHTML = '';
        ui.nav.forEach(function (it) {
            var li = el('li');
            var a = el('a', null, it.label);
            a.href = '#' + it.id;
            li.appendChild(a);
            navUl.appendChild(li);
        });

        /* hero */
        setText('name', p.name);
        setText('summary', p.summary);
        setText('ctaPrimary', ui.ctaPrimary);
        setText('ctaSecondary', ui.ctaSecondary);
        $('#resumeLink').href = url(p.resume);

        var photo = slot('photo');
        photo.src = url(p.photo);
        photo.alt = p.name;

        var links = slot('links');
        links.innerHTML = '';
        p.links.forEach(function (l) {
            var li = el('li');
            var a = el('a', null, l.label);
            a.href = l.url;
            if (l.url.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener'; }
            li.appendChild(a);
            links.appendChild(li);
        });

        var stats = slot('stats');
        stats.innerHTML = '';
        (d.stats || []).forEach(function (st) {
            var box = el('div', 'stat');
            box.appendChild(el('dt', 'stat__value', st.value));
            box.appendChild(el('dd', 'stat__label', st.label));
            stats.appendChild(box);
        });

        /* ticker com as competências, duplicado para o loop */
        var tick = slot('ticker');
        tick.innerHTML = '';
        for (var r = 0; r < 2; r++) {
            d.competencies.forEach(function (c) { tick.appendChild(el('span', null, c)); });
        }

        /* títulos */
        Object.keys(ui.sections).forEach(function (k) { setText('sec-' + k, ui.sections[k]); });

        /* experiência */
        var track = slot('experience');
        track.innerHTML = '';
        d.experience.main.forEach(function (job, i) {
            var art = el('article', 'node');
            art.setAttribute('data-stagger', Math.min(i, 4));

            var top = el('div', 'node__top');
            top.appendChild(el('h3', 'node__role', job.role));
            top.appendChild(el('span', 'node__period', job.period));
            art.appendChild(top);

            art.appendChild(el('p', 'node__company', job.company));
            art.appendChild(el('p', 'node__place', [job.location, job.mode].filter(Boolean).join(' · ')));
            if (job.summary) art.appendChild(el('p', 'node__summary', job.summary));

            if (job.highlights) {
                var ul = el('ul', 'node__points');
                job.highlights.forEach(function (h, k) {
                    var li = el('li', null, h);
                    if (EXP_PREVIEW && k >= EXP_PREVIEW) { li.className = 'is-extra'; li.hidden = true; }
                    ul.appendChild(li);
                });
                art.appendChild(ul);
                var extra = EXP_PREVIEW ? job.highlights.length - EXP_PREVIEW : 0;
                if (extra > 0) {
                    var pt = d.meta.htmlLang.indexOf('pt') === 0;
                    var more = el('button', 'node__more', (pt ? '+ ' + extra + ' detalhes' : '+ ' + extra + ' more'));
                    more.type = 'button';
                    more.setAttribute('aria-expanded', 'false');
                    more.addEventListener('click', (function (list, btn, n) {
                        return function () {
                            var open = btn.getAttribute('aria-expanded') === 'true';
                            $$('.is-extra', list).forEach(function (x) { x.hidden = open; });
                            btn.setAttribute('aria-expanded', String(!open));
                            btn.textContent = open ? (pt ? '+ ' + n + ' detalhes' : '+ ' + n + ' more') : (pt ? 'ver menos' : 'show less');
                            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
                        };
                    })(ul, more, extra));
                    art.appendChild(more);
                }
            }
            if (job.roles) {
                var rl = el('ul', 'node__roles');
                job.roles.forEach(function (x) { rl.appendChild(el('li', null, x.title + ' · ' + x.period)); });
                art.appendChild(rl);
            }
            if (job.tags) {
                var tg = el('div', 'tags');
                job.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
                art.appendChild(tg);
            }
            track.appendChild(art);
        });

        /* outras */
        setText('otherNote', ui.otherExperienceNote);
        var ob = $('#otherBtn');
        setText('otherToggle', ob.getAttribute('aria-expanded') === 'true' ? ui.showLess : ui.showMore);

        var other = slot('otherExperience');
        other.innerHTML = '';
        d.experience.other.forEach(function (job, i) {
            var c = el('article', 'mini');
            c.setAttribute('data-stagger', Math.min(i, 4));
            c.appendChild(el('h4', 'mini__role', job.role));
            c.appendChild(el('p', 'mini__company', job.company));
            c.appendChild(el('p', 'mini__period', job.period + (job.location ? ' · ' + job.location : '')));
            c.appendChild(el('p', 'mini__text', job.summary));
            if (job.tags) {
                var tg = el('div', 'tags');
                job.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
                c.appendChild(tg);
            }
            other.appendChild(c);
        });

        /* competências + radar */
        var cloud = slot('competencies');
        cloud.innerHTML = '';
        d.competencies.forEach(function (c) { cloud.appendChild(el('span', null, c)); });

        buildRadar(d.languages);

        /* stack */
        var sg = slot('skills');
        sg.innerHTML = '';
        d.skills.forEach(function (g, i) {
            var card = el('div', 'stackcard');
            card.setAttribute('data-stagger', Math.min(i, 4));

            var head = el('div', 'stackcard__head');
            var ic = el('span', 'stackcard__icon');
            ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[g.icon] || ICONS.code) + '</svg>';
            head.appendChild(ic);
            head.appendChild(el('h3', 'stackcard__name', g.group));
            card.appendChild(head);

            var ul = el('ul');
            g.items.forEach(function (it) { ul.appendChild(el('li', null, it)); });
            card.appendChild(ul);
            sg.appendChild(card);
        });

        /* projetos */
        var repos = slot('projects');
        repos.innerHTML = '';
        d.projects.forEach(function (pj, i) {
            var a = el('a', 'repo');
            a.href = pj.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.setAttribute('data-stagger', Math.min(i, 5));
            a.setAttribute('aria-label', pj.name + ' — ' + ui.viewOnGitHub);

            var top = el('div', 'repo__top');
            var dir = pj.url.split('/').filter(Boolean).pop();
            top.appendChild(el('span', 'repo__dir', dir));
            var arr = document.createElement('span');
            arr.innerHTML = ARROW;
            top.appendChild(arr.firstChild);
            a.appendChild(top);

            a.appendChild(el('h3', 'repo__name', pj.name));
            a.appendChild(el('p', 'repo__desc', pj.description));
            if (pj.tags) {
                var tg = el('div', 'tags');
                pj.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
                a.appendChild(tg);
            }

            a.addEventListener('pointermove', function (e) {
                var b = a.getBoundingClientRect();
                a.style.setProperty('--mx', (e.clientX - b.left) + 'px');
                a.style.setProperty('--my', (e.clientY - b.top) + 'px');
            });

            repos.appendChild(a);
        });

        /* formação */
        var ed = slot('education');
        ed.innerHTML = '';
        d.education.forEach(function (e, i) {
            var box = el('div', 'edu__item');
            box.setAttribute('data-stagger', i);
            box.appendChild(el('span', 'edu__period', e.period));
            box.appendChild(el('h3', 'edu__degree', e.degree));
            box.appendChild(el('p', 'edu__school', e.school));
            ed.appendChild(box);
        });

        /* certificações */
        var ct = slot('certifications');
        ct.innerHTML = '';
        d.certifications.forEach(function (c, i) {
            var card = el('article', 'cert');
            card.setAttribute('data-stagger', Math.min(i, 5));
            if (c.image) {
                var img = el('img', 'cert__img');
                img.src = url(c.image);
                img.alt = c.name;
                img.loading = 'lazy';
                card.appendChild(img);
            }
            card.appendChild(el('span', 'cert__issuer', c.issuer + ' · ' + c.year));
            card.appendChild(el('h3', 'cert__name', c.name));
            if (c.detail) card.appendChild(el('p', 'cert__detail', c.detail));

            var ln = el('div', 'cert__links');
            if (c.credential) ln.appendChild(mkLink(c.credential, ui.formalCertificate));
            if (c.verify) ln.appendChild(mkLink(c.verify, ui.verify));
            if (c.download) ln.appendChild(mkLink(url(c.download), ui.download, true));
            if (ln.children.length) card.appendChild(ln);

            ct.appendChild(card);
        });
        setText('otherCourses', d.otherCourses);

        /* rodapé */
        setText('contactLead', ui.contactLead);
        setText('footerNote', ui.footerNote);
        setText('backToTop', ui.backToTop);
        var mail = $('#mailLink');
        mail.href = 'mailto:' + p.email;
        mail.textContent = p.email;

        var fl = slot('footerLinks');
        fl.innerHTML = '';
        p.links.forEach(function (l) {
            var li = el('li');
            var a = el('a', null, l.label);
            a.href = l.url;
            if (l.url.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener'; }
            li.appendChild(a);
            fl.appendChild(li);
        });

        applyTheme(currentTheme(), false);
        startRotator(p.rotatingWords);
        initReveal();
        initScrollSpy();

        /* avisa a camada de animação (motion.js) que o conteúdo foi desenhado */
        renderCount++;
        document.dispatchEvent(new CustomEvent('aa:render', { detail: { data: d, first: renderCount === 1 } }));
    }

    var renderCount = 0;

    /* usado pelo plano B do <head> se o GSAP não carregar */
    window.AA = {
        revealAll: function () {
            $$('.node, .mini, .panel, .stackcard, .repo, .cert, .edu__item, .shead, .courses, .other, .footer__panel')
                .forEach(function (t) { t.classList.add('is-visible'); });
            if (data) startRotator(data.profile.rotatingWords);
        }
    };

    function mkLink(href, label, download) {
        var a = el('a', null, label);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        if (download) a.setAttribute('download', '');
        return a;
    }

    /* ---------- scrollspy ---------- */
    var spy = null;

    function initScrollSpy() {
        var links = $$('.rail__nav a');
        if (!links.length || !('IntersectionObserver' in window)) return;
        if (spy) spy.disconnect();
        spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                links.forEach(function (a) {
                    a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        links.forEach(function (a) {
            var t = document.getElementById(a.getAttribute('href').slice(1));
            if (t) spy.observe(t);
        });
    }

    /* ---------- carregar ---------- */
    function load(lang) {
        return fetch(url('/data/' + lang + '.json'), { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(render)
            .catch(function (err) {
                console.error('Falha ao carregar o conteúdo:', err);
                var main = $('#main');
                if (main && !$('.load-error')) {
                    var p = el('p', 'load-error');
                    p.style.cssText = 'padding:140px var(--gut);text-align:center';
                    p.textContent = 'Não foi possível carregar o conteúdo. Abra o site por um servidor HTTP (ex.: python3 -m http.server) — o fetch de JSON não funciona em file://.';
                    main.prepend(p);
                }
            });
    }

    /* ---------- eventos ---------- */
    function bind() {
        $('#themeBtn').addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            var root = document.documentElement;
            if (!document.startViewTransition || reduceMotion || !motionOn()) {
                applyTheme(next, true);
                return;
            }
            /* troca de tema em círculo, a partir do botão */
            var r = this.getBoundingClientRect();
            var x = r.left + r.width / 2, y = r.top + r.height / 2;
            var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            var vt = document.startViewTransition(function () { applyTheme(next, true); });
            vt.ready.then(function () {
                root.animate(
                    { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
                    { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
                );
            });
        });

        $('#langBtn').addEventListener('click', function () {
            var next = data ? data.meta.switchTo.code : 'en';
            try { localStorage.setItem(LS_LANG, next); } catch (e) { }
            load(next);
        });

        var burger = $('#burger');
        var nav = $('.rail__nav');
        burger.addEventListener('click', function () {
            var open = burger.getAttribute('aria-expanded') === 'true';
            burger.setAttribute('aria-expanded', String(!open));
            nav.classList.toggle('is-open', !open);
        });
        nav.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') {
                burger.setAttribute('aria-expanded', 'false');
                nav.classList.remove('is-open');
            }
        });

        var ob = $('#otherBtn');
        var panel = $('#otherPanel');
        ob.addEventListener('click', function () {
            var open = ob.getAttribute('aria-expanded') === 'true';
            ob.setAttribute('aria-expanded', String(!open));
            panel.hidden = open;
            setText('otherToggle', open ? data.ui.showMore : data.ui.showLess);
            if (!open) initReveal();
        });

        var rail = $('.rail');
        var onScroll = function () { rail.classList.toggle('is-stuck', window.scrollY > 20); };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
            try { if (localStorage.getItem(LS_THEME)) return; } catch (err) { }
            applyTheme(e.matches ? 'light' : 'dark', false);
        });
    }

    bind();
    load(storedLang());
})();
