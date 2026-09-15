/* デジタルそろばん — 珠の状態・値の読み取り・運指の手順づくり
   画面には一切さわらない純粋なロジック。tests/test.html がここを総当たりで検査する。 */
(function (global) {
  'use strict';

  /* ===== 盤の寸法 =====
     17桁。一の位を右から3番目の定位点に置くと、整数は10^14（百兆の位）まで、
     小数は1/100の位まで同じ盤で扱える。 */
  var ROD_COUNT = 17;
  var DOT_RODS = [2, 5, 8, 11, 14];   // 定位点のある桁（左から数えた番号）
  var DEFAULT_ONES = 14;              // 既定の「一の位」＝いちばん右の定位点

  /* 運指の向き。2桁以上をどちらの桁から足すか。
     'high-to-low' = 上の位から（珠算の作法） / 'low-to-high' = 下の位から（筆算と同じ向き）
     ここ1か所を書きかえれば、ヒントの手順が全部入れかわる。 */
  var DIGIT_ORDER = 'high-to-low';

  /* くり上がりのとき、上の位に1を入れるのが先か、この位から補数をはらうのが先か。
     'carry-first' = 上の位に1を入れてから、この位をはらう（珠算の言い方） */
  var CARRY_ORDER = 'carry-first';

  /* ===== 盤の状態 ===== */

  function createState(onesIndex) {
    var rods = [];
    for (var i = 0; i < ROD_COUNT; i++) rods.push({ h: 0, e: 0 });
    return { rods: rods, onesIndex: (onesIndex == null ? DEFAULT_ONES : onesIndex) };
  }

  function cloneState(s) {
    return {
      rods: s.rods.map(function (r) { return { h: r.h, e: r.e }; }),
      onesIndex: s.onesIndex
    };
  }

  function rodValue(rod) { return rod.h * 5 + rod.e; }

  /** 0〜9 を珠の形（五珠・一珠）に直す。そろばんの珠の置き方は1通りしかない。 */
  function canonical(v) { return { h: v >= 5 ? 1 : 0, e: v % 5 }; }

  function setRodValue(rod, v) {
    var c = canonical(v);
    rod.h = c.h; rod.e = c.e;
  }

  function digits(state) {
    return state.rods.map(rodValue);
  }

  function clearState(state) {
    state.rods.forEach(function (r) { r.h = 0; r.e = 0; });
    return state;
  }

  /* ===== 値の読み取り =====
     兆の位まで扱うので、ふつうの数では桁が足りない。BigInt で正確に持つ。 */

  /** 盤ぜんたいを17桁の整数（BigInt）として読む。小数点の位置は見ない。 */
  function rawBig(state) {
    var s = digits(state).join('');
    return BigInt(s);
  }

  /** 一の位より右にある桁の数（＝小数点以下の桁数） */
  function fracDigits(state) { return ROD_COUNT - 1 - state.onesIndex; }

  /** ふたつの盤の値が同じかどうか。桁あわせをして正確に比べる。 */
  function sameValue(a, b) {
    var fa = fracDigits(a), fb = fracDigits(b);
    var ra = rawBig(a), rb = rawBig(b);
    if (fa < fb) ra = ra * pow10(fb - fa);
    else if (fb < fa) rb = rb * pow10(fa - fb);
    return ra === rb;
  }

  function pow10(n) {
    var r = 1n;
    for (var i = 0; i < n; i++) r *= 10n;
    return r;
  }

  /** 盤の値を「12345.67」の形の文字列にする。前と後ろの0は落とす。 */
  function toNumberString(state) {
    var ds = digits(state);
    var f = fracDigits(state);
    var intPart = ds.slice(0, state.onesIndex + 1).join('').replace(/^0+(?=\d)/, '');
    var frac = f > 0 ? ds.slice(state.onesIndex + 1).join('').replace(/0+$/, '') : '';
    return frac ? intPart + '.' + frac : intPart;
  }

  /**
   * 「30000000000000」→「30兆」のように、位の名前つきで読む（画面に出すためだけのもの）。
   * 小数がついたまま「200億.45」のような言い方にはならないので、
   * 万より上の位と小数が混ざるときは、もとの数字のまま返す。
   */
  function toKanjiUnits(numStr) {
    var parts = numStr.split('.');
    var intPart = parts[0];
    var frac = parts[1] || '';
    if (intPart === '0' && !frac) return '0';
    if (frac && intPart.length > 4) return numStr;
    var units = ['', '万', '億', '兆'];
    var groups = [];
    var rest = intPart;
    while (rest.length > 0) {
      groups.unshift(rest.slice(-4));
      rest = rest.slice(0, -4);
    }
    var out = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i].replace(/^0+(?=\d)/, '');
      var u = units[groups.length - 1 - i] || '';
      if (g !== '0') out += g + u;
    }
    if (out === '') out = '0';
    if (frac) out += '.' + frac;
    return out;
  }

  /** 数の文字列を盤に入れる。入りきらなければ null を返す。 */
  function stateFromNumber(numStr, onesIndex) {
    var oi = (onesIndex == null ? DEFAULT_ONES : onesIndex);
    var s = createState(oi);
    var parts = String(numStr).split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '');
    var frac = parts[1] || '';
    if (intPart.length > oi + 1) return null;
    if (frac.length > ROD_COUNT - 1 - oi) return null;
    for (var i = 0; i < intPart.length; i++) {
      var idx = oi - (intPart.length - 1 - i);
      setRodValue(s.rods[idx], Number(intPart[i]));
    }
    for (var j = 0; j < frac.length; j++) {
      setRodValue(s.rods[oi + 1 + j], Number(frac[j]));
    }
    return s;
  }

  global.Abacus = {
    ROD_COUNT: ROD_COUNT,
    DOT_RODS: DOT_RODS,
    DEFAULT_ONES: DEFAULT_ONES,
    DIGIT_ORDER: DIGIT_ORDER,
    CARRY_ORDER: CARRY_ORDER,
    createState: createState,
    cloneState: cloneState,
    clearState: clearState,
    rodValue: rodValue,
    canonical: canonical,
    setRodValue: setRodValue,
    digits: digits,
    rawBig: rawBig,
    fracDigits: fracDigits,
    sameValue: sameValue,
    toNumberString: toNumberString,
    toKanjiUnits: toKanjiUnits,
    stateFromNumber: stateFromNumber
  };

  /* ===================================================================
     運指（うんし）の手順づくり
     たし算・ひき算を「珠をどう動かすか」の列にほどく。
     1つの「ひと手」＝画面でひとまとめに光らせる単位。
     =================================================================== */

  function makeBeat(i, rod, target, say, kind) {
    var b = {
      rod: i,
      from: { h: rod.h, e: rod.e },
      to: { h: target.h, e: target.e },
      say: say,
      kind: kind || 'direct'
    };
    rod.h = target.h; rod.e = target.e;
    return b;
  }

  function harder(a, b) {
    var w = { direct: 0, five: 1, carry: 2 };
    return w[b] > w[a] ? b : a;
  }

  /** rod i に d（0〜9）を足す。beats に「ひと手」を積む。 */
  function addToRod(state, i, d, beats, ctx) {
    if (d === 0) return;
    var rod = state.rods[i];
    var after = rodValue(rod) + d;
    if (after <= 9) {
      var t = canonical(after);
      if (t.h >= rod.h && t.e >= rod.e) {
        beats.push(makeBeat(i, rod, t, d + 'をいれる', 'direct'));
      } else {
        // 5の合成 — 5をいれて、たりない分をはらう
        ctx.kind = harder(ctx.kind, 'five');
        beats.push(makeBeat(i, rod, { h: 1, e: rod.e }, '5をいれる', 'five'));
        beats.push(makeBeat(i, rod, { h: 1, e: rod.e - (5 - d) }, (5 - d) + 'をはらう', 'five'));
      }
    } else {
      // くり上がり — 上のけたに1をいれて、この位から10の補数をはらう
      if (i === 0) throw new Error('けたが足りません');
      ctx.kind = harder(ctx.kind, 'carry');
      if (CARRY_ORDER === 'carry-first') {
        addToRod(state, i - 1, 1, beats, ctx);
        subFromRod(state, i, 10 - d, beats, ctx);
      } else {
        subFromRod(state, i, 10 - d, beats, ctx);
        addToRod(state, i - 1, 1, beats, ctx);
      }
    }
  }

  /** rod i から d（0〜9）をひく。 */
  function subFromRod(state, i, d, beats, ctx) {
    if (d === 0) return;
    var rod = state.rods[i];
    var after = rodValue(rod) - d;
    if (after >= 0) {
      var t = canonical(after);
      if (t.h <= rod.h && t.e <= rod.e) {
        beats.push(makeBeat(i, rod, t, d + 'をはらう', 'direct'));
      } else {
        // 5の分解 — 5をはらって、はらいすぎた分をいれる
        ctx.kind = harder(ctx.kind, 'five');
        beats.push(makeBeat(i, rod, { h: 0, e: rod.e }, '5をはらう', 'five'));
        beats.push(makeBeat(i, rod, { h: 0, e: rod.e + (5 - d) }, (5 - d) + 'をいれる', 'five'));
      }
    } else {
      // くり下がり — 上のけたから1をはらって、この位に10の補数をいれる
      if (i === 0) throw new Error('けたが足りません');
      ctx.kind = harder(ctx.kind, 'carry');
      if (CARRY_ORDER === 'carry-first') {
        subFromRod(state, i - 1, 1, beats, ctx);
        addToRod(state, i, 10 - d, beats, ctx);
      } else {
        addToRod(state, i, 10 - d, beats, ctx);
        subFromRod(state, i - 1, 1, beats, ctx);
      }
    }
  }

  /** 数の文字列を「どの桁にいくつ」に分解する。左（大きい位）から並べて返す。 */
  function digitIndices(numStr, onesIndex) {
    var parts = String(numStr).split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '');
    var frac = parts[1] || '';
    var out = [];
    var i;
    for (i = 0; i < intPart.length; i++) {
      var d = Number(intPart[i]);
      if (d !== 0) out.push({ rod: onesIndex - (intPart.length - 1 - i), d: d });
    }
    for (i = 0; i < frac.length; i++) {
      var f = Number(frac[i]);
      if (f !== 0) out.push({ rod: onesIndex + 1 + i, d: f });
    }
    return out;
  }

  /**
   * 盤 startState に対して numStr を足す／ひく手順を組み立てる。
   * @returns {{beats:Array, result:Object, kind:'direct'|'five'|'carry', ok:boolean, error:string|null}}
   */
  function plan(startState, numStr, op) {
    var s = cloneState(startState);
    var beats = [];
    var ctx = { kind: 'direct' };
    var idxs = digitIndices(numStr, s.onesIndex);
    if (DIGIT_ORDER === 'low-to-high') idxs.reverse();
    try {
      idxs.forEach(function (x) {
        if (x.rod < 0 || x.rod >= ROD_COUNT) throw new Error('けたが足りません');
        if (op === 'sub') subFromRod(s, x.rod, x.d, beats, ctx);
        else addToRod(s, x.rod, x.d, beats, ctx);
      });
    } catch (e) {
      return { beats: [], result: null, kind: ctx.kind, ok: false, error: e.message };
    }
    return { beats: beats, result: s, kind: ctx.kind, ok: true, error: null };
  }

  /** 「入れるだけ／5の合成・分解／くり上がり・くり下がり」のどれかを見分ける。 */
  function classify(aStr, bStr, op, onesIndex) {
    var start = stateFromNumber(aStr, onesIndex);
    if (!start) return null;
    var r = plan(start, bStr, op);
    return r.ok ? r.kind : null;
  }

  global.Abacus.makeBeat = makeBeat;
  global.Abacus.addToRod = addToRod;
  global.Abacus.subFromRod = subFromRod;
  global.Abacus.digitIndices = digitIndices;
  global.Abacus.plan = plan;
  global.Abacus.classify = classify;
})(window);
