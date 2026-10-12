/* =========================================================
   Versão C — Prisma · JavaScript puro, sem dependências
   ========================================================= */
(function () {
    'use strict';

    var LANGS = ['pt-BR', 'en'];
    var LS_THEME = 'aa-theme';
    var LS_LANG = 'aa-lang';
    var PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var data = null;
    var rotatorTimer = null;

    /* Base do site: deduzida do próprio <script>, em .../<base>/vN/app.js.
       Assim os caminhos funcionam na raiz (arash.com.br) e também numa
       prévia em subpasta (arthurbric.github.io/Online_Curriculum/v1/). */
    var BASE = (function () {
        var s = document.currentScript;
        if (!s) {
            var all = document.getElementsByTagName('script');
            s = all[all.length - 1];
        }
        return s.src.replace(/\/v\d+\/[^/]*$/, '/');
    })();

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

    function setText(n, v) {
        var node = slot(n);
        if (node) node.textContent = v == null ? '' : v;
    }

    function accent(i) { return PALETTE[i % PALETTE.length]; }

    var ARROW = '<svg class="wcard__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

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
        var b = $('#themeBtn');
        if (b && data) b.setAttribute('aria-label', t === 'dark' ? data.ui.themeLight : data.ui.themeDark);
    }

    /* ---------- reveal ---------- */
    var REVEAL_SEL = '.xcard, .mini, .bubbles, .stackcard, .wcard, .cert, .edu__item, .shead, .sub, .courses, .other, .langs, .footer__title, .footer__lead, .footer__mail, .footer__links';
    var observer = null;

    function initReveal() {
        var targets = $$(REVEAL_SEL);
        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach(function (t) { t.classList.add('is-visible'); });
            return;
        }
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                var i = Number(e.target.getAttribute('data-stagger') || 0);
                setTimeout(function () { e.target.classList.add('is-visible'); }, i * 75);
                observer.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -7% 0px', threshold: 0.05 });
        targets.forEach(function (t) { observer.observe(t); });
    }

    /* ---------- nome palavra a palavra ---------- */
    function paintName(name) {
        var host = slot('name');
        host.innerHTML = '';
        var words = name.split(' ');
        words.forEach(function (w, i) {
            var span = el('span', 'w', w);
            span.style.animationDelay = (reduceMotion ? 0 : 0.07 * i) + 's';
            span.style.backgroundPosition = (i * (100 / Math.max(words.length - 1, 1))) + '% center';
            host.appendChild(span);
            if (i < words.length - 1) host.appendChild(document.createTextNode(' '));
        });
    }

    /* ---------- rotator ---------- */
    function startRotator(words) {
        var node = slot('rotator');
        if (!node || !words || !words.length) return;
        if (rotatorTimer) clearTimeout(rotatorTimer);
        if (reduceMotion) { node.textContent = words[0]; return; }
        var w = 0, c = 0, back = false;
        (function tick() {
            var word = words[w];
            c += back ? -1 : 1;
            node.textContent = word.slice(0, c);
            var d = back ? 28 : 60;
            if (!back && c === word.length) { back = true; d = 1700; }
            else if (back && c === 0) { back = false; w = (w + 1) % words.length; d = 300; }
            rotatorTimer = setTimeout(tick, d);
        })();
    }

    /* ---------- render ---------- */
    function render(d) {
        data = d;
        var ui = d.ui, p = d.profile;

        document.documentElement.lang = d.meta.htmlLang;
        document.title = d.meta.title;
        var desc = $('meta[name="description"]');
        if (desc) desc.setAttribute('content', d.meta.description);

        var photo = slot('photo');
        if (photo) { photo.src = url(p.photo); photo.alt = p.name; }
        setText('shortName', p.shortName);
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
        setText('location', p.location);
        paintName(p.name);
        setText('headline', p.tagline);
        setText('summary', p.summary);
        setText('ctaPrimary', ui.ctaPrimary);
        setText('ctaSecondary', ui.ctaSecondary);
        $('#resumeLink').href = url(p.resume);

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

        /* marquee com as competências, duplicado para o loop */
        var mq = slot('marquee');
        mq.innerHTML = '';
        for (var r = 0; r < 2; r++) {
            d.competencies.forEach(function (c) { mq.appendChild(el('span', null, c)); });
        }

        /* títulos */
        Object.keys(ui.sections).forEach(function (k) { setText('sec-' + k, ui.sections[k]); });

        /* experiência */
        var cards = slot('experience');
        cards.innerHTML = '';
        d.experience.main.forEach(function (job, i) {
            var art = el('article', 'xcard');
            art.setAttribute('data-stagger', Math.min(i, 4));

            var left = el('div');
            left.appendChild(el('p', 'xcard__period', job.period));
            left.appendChild(el('p', 'xcard__place', [job.location, job.mode].filter(Boolean).join(' · ')));
            art.appendChild(left);

            var right = el('div');
            right.appendChild(el('h3', 'xcard__role', job.role));
            right.appendChild(el('p', 'xcard__company', job.company));
            if (job.summary) right.appendChild(el('p', 'xcard__summary', job.summary));

            if (job.highlights) {
                var ul = el('ul', 'xcard__points');
                job.highlights.forEach(function (h) { ul.appendChild(el('li', null, h)); });
                right.appendChild(ul);
            }
            if (job.roles) {
                var rl = el('ul', 'xcard__roles');
                job.roles.forEach(function (x) { rl.appendChild(el('li', null, x.title + ' · ' + x.period)); });
                right.appendChild(rl);
            }
            if (job.tags) {
                var tg = el('div', 'tags');
                job.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
                right.appendChild(tg);
            }
            art.appendChild(right);
            cards.appendChild(art);
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

        /* competências */
        var bb = slot('competencies');
        bb.innerHTML = '';
        d.competencies.forEach(function (c) { bb.appendChild(el('span', null, c)); });

        /* stack */
        var st = slot('skills');
        st.innerHTML = '';
        d.skills.forEach(function (g, i) {
            var card = el('div', 'stackcard');
            card.setAttribute('data-stagger', Math.min(i, 4));
            card.style.setProperty('--accentc', accent(i));
            card.appendChild(el('h3', 'stackcard__name', g.group));
            var ul = el('ul');
            g.items.forEach(function (it) { ul.appendChild(el('li', null, it)); });
            card.appendChild(ul);
            st.appendChild(card);
        });

        /* idiomas */
        var lg = slot('languages');
        lg.innerHTML = '';
        d.languages.forEach(function (l) {
            var box = el('div', 'lang');
            var top = el('div', 'lang__top');
            top.appendChild(el('span', 'lang__name', l.name));
            top.appendChild(el('span', 'lang__level', l.level));
            box.appendChild(top);
            var bar = el('div', 'lang__bar');
            var fill = el('span', 'lang__fill');
            fill.style.setProperty('--w', l.value + '%');
            bar.appendChild(fill);
            box.appendChild(bar);
            lg.appendChild(box);
        });

        /* projetos */
        var work = slot('projects');
        work.innerHTML = '';
        d.projects.forEach(function (pj, i) {
            var a = el('a', 'wcard');
            a.href = pj.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.setAttribute('data-stagger', Math.min(i, 5));
            a.setAttribute('aria-label', pj.name + ' — ' + ui.viewOnGitHub);
            a.style.setProperty('--accentc', accent(i));

            var top = el('div', 'wcard__top');
            top.appendChild(el('span', 'wcard__index', String(i + 1).padStart(2, '0')));
            var holder = document.createElement('span');
            holder.innerHTML = ARROW;
            top.appendChild(holder.firstChild);
            a.appendChild(top);

            a.appendChild(el('h3', 'wcard__name', pj.name));
            a.appendChild(el('p', 'wcard__desc', pj.description));
            if (pj.tags) {
                var tg = el('div', 'tags');
                pj.tags.forEach(function (t) { tg.appendChild(el('span', 'tag', t)); });
                a.appendChild(tg);
            }
            work.appendChild(a);
        });

        /* formação */
        var ed = slot('education');
        ed.innerHTML = '';
        d.education.forEach(function (e, i) {
            var box = el('div', 'edu__item');
            box.setAttribute('data-stagger', i);
            box.appendChild(el('span', 'edu__period', e.period));
            box.appendChild(el('h4', 'edu__degree', e.degree));
            box.appendChild(el('p', 'edu__school', e.school));
            ed.appendChild(box);
        });

        /* certificações */
        var ct = slot('certifications');
        ct.innerHTML = '';
        d.certifications.forEach(function (c, i) {
            var card = el('article', 'cert');
            card.setAttribute('data-stagger', Math.min(i, 5));
            card.style.setProperty('--accentc', accent(i));

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
    }

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
        var links = $$('.bar__nav a');
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
            applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
        });

        $('#langBtn').addEventListener('click', function () {
            var next = data ? data.meta.switchTo.code : 'en';
            try { localStorage.setItem(LS_LANG, next); } catch (e) { }
            load(next);
        });

        var burger = $('#burger');
        var nav = $('.bar__nav');
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

        var bar = $('.bar');
        var onScroll = function () { bar.classList.toggle('is-stuck', window.scrollY > 20); };
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
