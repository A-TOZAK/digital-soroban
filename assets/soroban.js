/* デジタルそろばん — 盤の描画と、珠をさわる操作
   タップ＝実物と同じ連動（3つ目の一珠を上げると1つ目2つ目もついてくる）
   ドラッグ＝指についてきて、はなすといちばん近いところへ収まる */
(function (global) {
  'use strict';

  var A = global.Abacus;
  var N = A.ROD_COUNT;

  function Soroban(root, opts) {
    opts = opts || {};
    this.root = root;
    this.field = root.querySelector('#field');
    this.beam = root.querySelector('#beam');
    this.places = root.querySelector('#places');
    this.marker = root.querySelector('#onesMarker');
    this.state = A.createState();
    this.beads = [];          // beads[rod] = {h: el, e: [el×4]}
    this.rods = [];
    this.markerLocked = false;
    this.onChange = opts.onChange || function () {};
    this.build();
    this.render();
  }

  /* ===== 組み立て ===== */

  Soroban.prototype.build = function () {
    var self = this;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < N; i++) {
      var rod = document.createElement('div');
      rod.className = 'rod';
      rod.dataset.i = i;

      var rail = document.createElement('div');
      rail.className = 'rail';
      rod.appendChild(rail);

      var slot = { h: null, e: [] };

      slot.h = this.makeBead('heaven', i, 0);
      rod.appendChild(slot.h);
      for (var k = 0; k < 4; k++) {
        var b = this.makeBead('earth', i, k);
        rod.appendChild(b);
        slot.e.push(b);
      }

      this.beads.push(slot);
      this.rods.push(rod);
      frag.appendChild(rod);
    }
    this.field.insertBefore(frag, this.beam);

    // 定位点
    A.DOT_RODS.forEach(function (i) {
      var d = document.createElement('span');
      d.className = 'dot';
      d.style.setProperty('--i', i);
      self.beam.appendChild(d);
    });

    this.renderPlaces();

    this.field.addEventListener('pointerdown', function (e) { self.onPointerDown(e); });
    this.marker.addEventListener('pointerdown', function (e) { self.onMarkerDown(e); });
    this.marker.addEventListener('keydown', function (e) { self.onMarkerKey(e); });
  };

  Soroban.prototype.makeBead = function (part, rod, k) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 60');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'bead ' + part);
    svg.dataset.rod = rod;
    svg.dataset.part = part;
    svg.dataset.k = k;
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#bead');
    svg.appendChild(use);
    return svg;
  };

  /** 位の名前（一・万・億・兆と、小数の位）を一の位から数えて置き直す */
  Soroban.prototype.renderPlaces = function () {
    var oi = this.state.onesIndex;
    var names = {};
    names[oi] = '一';
    if (oi - 4 >= 0) names[oi - 4] = '万';
    if (oi - 8 >= 0) names[oi - 8] = '億';
    if (oi - 12 >= 0) names[oi - 12] = '兆';
    if (oi + 1 < N) names[oi + 1] = '0.1';
    if (oi + 2 < N) names[oi + 2] = '0.01';

    this.places.textContent = '';
    Object.keys(names).forEach(function (i) {
      var s = document.createElement('span');
      s.style.setProperty('--i', i);
      s.textContent = names[i];
      if (Number(i) === oi + 2) s.dataset.row = '2';   // 0.01 はせまいとき下の段へ
      this.places.appendChild(s);
    }, this);

    this.marker.style.setProperty('--i', oi);
    this.marker.setAttribute('aria-valuenow', oi);
  };

  /* ===== 描画 ===== */

  Soroban.prototype.beadY = function (part, k, rodState) {
    if (part === 'heaven') return rodState.h ? 1 : 0;
    return (k < rodState.e) ? k : k + 1;
  };

  Soroban.prototype.render = function () {
    for (var i = 0; i < N; i++) {
      var r = this.state.rods[i];
      var s = this.beads[i];
      s.h.style.setProperty('--y', this.beadY('heaven', 0, r));
      for (var k = 0; k < 4; k++) {
        s.e[k].style.setProperty('--y', this.beadY('earth', k, r));
      }
      var v = A.rodValue(r);
      this.rods[i].setAttribute('aria-label', '');
      s.h.setAttribute('aria-hidden', 'true');
    }
    this.onChange(this.state);
  };

  /* ===== さわる ===== */

  Soroban.prototype.onPointerDown = function (e) {
    var bead = e.target.closest ? e.target.closest('.bead') : null;
    var rodEl = e.target.closest ? e.target.closest('.rod') : null;
    if (!rodEl) return;
    var i = Number(rodEl.dataset.i);
    if (rodEl.classList.contains('is-dim')) return;

    // 珠そのものでなく、すき間を押したときは、その高さにいちばん近い珠を拾う
    if (!bead) bead = this.nearestBead(rodEl, e.clientY);
    if (!bead) return;

    var part = bead.dataset.part;
    var k = Number(bead.dataset.k);
    var rod = this.state.rods[i];

    var u = this.unitPx();
    var group = this.dragGroup(i, part, k, rod);
    if (!group) return;

    this.drag = {
      rod: i, part: part, k: k, u: u,
      startY: e.clientY, startT: performance.now(),
      moved: 0, group: group, p: 0
    };
    this.root.classList.add('is-dragging');
    try { this.field.setPointerCapture(e.pointerId); } catch (err) {}

    var self = this;
    this._move = function (ev) { self.onPointerMove(ev); };
    this._up = function (ev) { self.onPointerUp(ev); };
    this.field.addEventListener('pointermove', this._move);
    this.field.addEventListener('pointerup', this._up);
    this.field.addEventListener('pointercancel', this._up);
    e.preventDefault();
  };

  /** その桁で、押した高さにいちばん近い珠 */
  Soroban.prototype.nearestBead = function (rodEl, clientY) {
    var best = null, bestD = Infinity;
    rodEl.querySelectorAll('.bead').forEach(function (b) {
      var r = b.getBoundingClientRect();
      var d = Math.abs((r.top + r.bottom) / 2 - clientY);
      if (d < bestD) { bestD = d; best = b; }
    });
    return best;
  };

  Soroban.prototype.unitPx = function () {
    var r = this.beads[0].e[0].getBoundingClientRect();
    return r.height || 1;
  };

  /**
   * つかんだ珠といっしょに動く珠。実物と同じで、
   * 一珠を上げると内がわ（梁に近い側）の珠もついてくる。
   * @returns {{dir:-1|1, items:[{el, base}], to:Object}|null}
   */
  Soroban.prototype.dragGroup = function (i, part, k, rod) {
    var items = [], j;
    if (part === 'heaven') {
      var toH = rod.h ? 0 : 1;
      items.push({ el: this.beads[i].h, base: rod.h ? 1 : 0 });
      return { dir: rod.h ? -1 : 1, items: items, to: { h: toH, e: rod.e }, where: rod.h ? 'frame' : 'beam' };
    }
    if (k >= rod.e) {
      // 下がっている珠を上げる → 0〜k がそろって上がる
      for (j = rod.e; j <= k; j++) items.push({ el: this.beads[i].e[j], base: j + 1 });
      return { dir: -1, items: items, to: { h: rod.h, e: k + 1 }, where: 'beam' };
    }
    // 上がっている珠を下げる → k〜いちばん上の珠までがそろって下がる
    for (j = k; j < rod.e; j++) items.push({ el: this.beads[i].e[j], base: j });
    return { dir: 1, items: items, to: { h: rod.h, e: k }, where: 'frame' };
  };

  Soroban.prototype.onPointerMove = function (e) {
    var d = this.drag;
    if (!d) return;
    var dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(dy));
    var dir = d.group.dir;
    var p = (dy / d.u) * dir;              // 動かしたい向きへ、めもり何つぶん進んだか
    p = Math.max(0, Math.min(1, p));
    d.p = p;
    d.group.items.forEach(function (it) {
      it.el.style.setProperty('--y', it.base + p * dir);
    });
    e.preventDefault();
  };

  Soroban.prototype.onPointerUp = function (e) {
    var d = this.drag;
    if (!d) return;
    this.field.removeEventListener('pointermove', this._move);
    this.field.removeEventListener('pointerup', this._up);
    this.field.removeEventListener('pointercancel', this._up);
    this.root.classList.remove('is-dragging');
    this.drag = null;

    var isTap = d.moved < 6 && (performance.now() - d.startT) < 450;
    var fast = (performance.now() - d.startT) < 220 && d.moved > d.u * 0.28;
    var commit = isTap || d.p >= 0.5 || fast;   // はやくはらったら、行き切る

    var rod = this.state.rods[d.rod];
    var before = A.rodValue(rod);
    if (commit) {
      rod.h = d.group.to.h;
      rod.e = d.group.to.e;
    }
    this.render();
    if (commit && A.rodValue(rod) !== before && global.Sound) {
      global.Sound.click(d.group.where, d.group.items.length);
    }
  };

  /* ===== 一の位のしるし ===== */

  Soroban.prototype.lockMarker = function (locked) {
    this.markerLocked = !!locked;
    this.marker.classList.toggle('is-locked', this.markerLocked);
    this.marker.setAttribute('aria-disabled', this.markerLocked ? 'true' : 'false');
  };

  Soroban.prototype.setOnes = function (i) {
    i = Math.max(8, Math.min(N - 1, i));
    if (i === this.state.onesIndex) return;
    this.state.onesIndex = i;
    this.renderPlaces();
    this.onChange(this.state);
  };

  Soroban.prototype.onMarkerDown = function (e) {
    if (this.markerLocked) return;
    var self = this;
    var pitch = this.rods[0].getBoundingClientRect().width;
    var fieldLeft = this.field.getBoundingClientRect().left;
    function move(ev) {
      var i = Math.round((ev.clientX - fieldLeft) / pitch - 0.5);
      self.setOnes(i);
      ev.preventDefault();
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    e.preventDefault();
  };

  Soroban.prototype.onMarkerKey = function (e) {
    if (this.markerLocked) return;
    if (e.key === 'ArrowLeft') { this.setOnes(this.state.onesIndex - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.setOnes(this.state.onesIndex + 1); e.preventDefault(); }
  };

  /* ===== まとめてうごかす ===== */

  /** ごわさん。五珠は上へ、一珠は下へ。左の桁からすこしずつ。 */
  Soroban.prototype.clearAll = function () {
    var self = this;
    var any = false;
    for (var i = 0; i < N; i++) if (A.rodValue(this.state.rods[i]) !== 0) { any = true; break; }
    if (!any) return;
    var step = 0;
    for (var j = 0; j < N; j++) {
      (function (i) {
        var had = A.rodValue(self.state.rods[i]) !== 0;
        if (!had) return;
        setTimeout(function () {
          self.state.rods[i].h = 0;
          self.state.rods[i].e = 0;
          self.render();
          if (global.Sound) global.Sound.click('frame', 2);
        }, step * 26);
        step++;
      })(j);
    }
  };

  /** 盤に数を入れる（アニメーションつき） */
  Soroban.prototype.setNumber = function (numStr) {
    var s = A.stateFromNumber(numStr, this.state.onesIndex);
    if (!s) return false;
    for (var i = 0; i < N; i++) {
      this.state.rods[i].h = s.rods[i].h;
      this.state.rods[i].e = s.rods[i].e;
    }
    this.render();
    return true;
  };

  /** 使う桁だけを明るくする。from〜to 以外は暗く落とす。null で全部明るく。 */
  Soroban.prototype.setActiveRange = function (from, to) {
    for (var i = 0; i < N; i++) {
      var dim = (from != null) && (i < from || i > to);
      this.rods[i].classList.toggle('is-dim', dim);
    }
  };

  /** ヒントで光らせる珠を指定する。beat は Abacus.plan が返す「ひと手」。 */
  Soroban.prototype.lightBeat = function (beat) {
    this.clearLight();
    if (!beat) return;
    var s = this.beads[beat.rod];
    var i;
    if (beat.to.h !== beat.from.h) s.h.classList.add('is-hint');
    if (beat.to.e !== beat.from.e) {
      var lo = Math.min(beat.from.e, beat.to.e);
      var hi = Math.max(beat.from.e, beat.to.e);
      for (i = lo; i < hi; i++) s.e[i].classList.add('is-hint');
    }
    this.rods[beat.rod].classList.add('is-lit');
  };

  Soroban.prototype.clearLight = function () {
    this.root.querySelectorAll('.bead.is-hint').forEach(function (b) { b.classList.remove('is-hint'); });
    this.root.querySelectorAll('.rod.is-lit').forEach(function (r) { r.classList.remove('is-lit'); });
  };

  global.Soroban = Soroban;
})(window);
