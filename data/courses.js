/* デジタルそろばん — コースの定義
   3年・4年の分け方は学習指導要領（平成29年告示）解説 算数編 A(8) そろばん のとおり。
   3年の本線は整数だけ。万の単位と小数第一位は「もっとやってみる」に分けてある
   （指導要領では3年の内容だが、教科書では4年で扱うことが多いため）。 */
(function (global) {
  'use strict';
  var A = global.Abacus;

  function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }

  /** 型が合う計算問題が出るまで引き直す */
  function genCalc(want, make, tries) {
    tries = tries || 400;
    for (var t = 0; t < tries; t++) {
      var q = make();
      if (!q) continue;
      var kind = A.classify(q.a, q.b, q.op);
      if (kind === want || want === 'any') return q;
    }
    return null;
  }

  function fixed(a, b, op) { return { a: a, b: b, op: op }; }

  /* ---- 3年 本線 ---------------------------------------------------- */

  var COURSES = [
    {
      id: 'g3-read', grade: 3, extra: false,
      name: 'そろばんの数をよむ',
      desc: 'そろばんの形を見て、いくつかを答えます。',
      kind: 'read', span: { left: 2, right: 0 },
      gen: function () { return { value: String(ri(1, 999)) }; }
    },
    {
      id: 'g3-enter', grade: 3, extra: false,
      name: '数を入れる',
      desc: '言われた数を、そろばんに入れます。',
      kind: 'enter', span: { left: 2, right: 0 },
      gen: function () { return { value: String(ri(1, 999)) }; }
    },
    {
      id: 'g3-direct', grade: 3, extra: false,
      name: 'たし算・ひき算 ①入れるだけ',
      desc: '珠を入れるだけ、はらうだけでできる計算です。',
      kind: 'calc', span: { left: 1, right: 0 },
      first: [fixed('2', '1', 'add'), fixed('3', '1', 'sub')],
      gen: function () {
        return genCalc('direct', function () {
          var op = pick(['add', 'sub']);
          if (op === 'add') { var a = ri(1, 8); return fixed(String(a), String(ri(1, 9 - a)), 'add'); }
          var x = ri(2, 9); return fixed(String(x), String(ri(1, x)), 'sub');
        });
      }
    },
    {
      id: 'g3-five', grade: 3, extra: false,
      name: 'たし算・ひき算 ②5のなかま',
      desc: '一珠がたりないとき、五珠を使います。',
      kind: 'calc', span: { left: 1, right: 0 },
      why: '一珠が4つしかないので、たりないときは「5をいれて、いれすぎた分をはらう」。ひき算は、その逆です。',
      first: [fixed('4', '3', 'add'), fixed('6', '4', 'sub')],
      gen: function () {
        return genCalc('five', function () {
          var op = pick(['add', 'sub']);
          if (op === 'add') { var a = ri(1, 8); return fixed(String(a), String(ri(1, 9 - a)), 'add'); }
          var x = ri(2, 9); return fixed(String(x), String(ri(1, x)), 'sub');
        });
      }
    },
    {
      id: 'g3-carry', grade: 3, extra: false,
      name: 'たし算・ひき算 ③くり上がり・くり下がり',
      desc: '上の位へくり上がる計算、上の位から借りてくる計算です。',
      kind: 'calc', span: { left: 1, right: 0 },
      why: 'この位だけでは足りないので、上の位を1つ動かして、そのぶんをこの位から調整します。',
      first: [fixed('8', '9', 'add'), fixed('15', '7', 'sub')],
      gen: function () {
        return genCalc('carry', function () {
          var op = pick(['add', 'sub']);
          if (op === 'add') { var a = ri(2, 9); return fixed(String(a), String(ri(10 - a, 9)), 'add'); }
          var x = ri(11, 18); return fixed(String(x), String(ri(x - 9, 9)), 'sub');
        });
      }
    },

    /* ---- 3年 もっとやってみる -------------------------------------- */
    {
      id: 'g3-man', grade: 3, extra: true,
      name: '万の単位',
      desc: '3万＋5万 のような計算です。',
      kind: 'calc', span: { left: 5, right: 0 },
      note: '学習指導要領解説 算数編 第3学年 A(8) に「3万＋5万」の例があります。教科書では第4学年で扱うことが多い内容です。',
      first: [fixed('30000', '50000', 'add')],
      gen: function () {
        return genCalc('any', function () {
          var op = pick(['add', 'sub']);
          if (op === 'add') { var a = ri(1, 8); return fixed(String(a) + '0000', String(ri(1, 9 - a)) + '0000', 'add'); }
          var x = ri(2, 9); return fixed(String(x) + '0000', String(ri(1, x)) + '0000', 'sub');
        });
      }
    },
    {
      id: 'g3-dec1', grade: 3, extra: true,
      name: '小数第一位',
      desc: '2.6＋0.3 のような計算です。',
      kind: 'calc', span: { left: 1, right: 1 },
      note: '学習指導要領解説 算数編 第3学年 A(8) に「2.6＋0.3」の例があります。教科書では第4学年で扱うことが多い内容です。',
      first: [fixed('2.6', '0.3', 'add')],
      gen: function () {
        return genCalc('any', function () {
          var op = pick(['add', 'sub']);
          var a = ri(10, 89) / 10;
          var b = ri(1, 9) / 10;
          var as = a.toFixed(1), bs = b.toFixed(1);
          if (op === 'add') { if (a + b > 9.9) return null; return fixed(as, bs, 'add'); }
          if (a - b < 0) return null;
          return fixed(as, bs, 'sub');
        });
      }
    },

    /* ---- 4年 -------------------------------------------------------- */
    {
      id: 'g4-two', grade: 4, extra: false,
      name: '2けたどうしのたし算・ひき算',
      desc: '47＋38 のような計算です。位を2つ動かします。',
      kind: 'calc', span: { left: 2, right: 0 },
      why: '筆算は一の位から。そろばんは<strong>大きい位から</strong>動かします。向きがぎゃくなので、ここだけ気をつけてください。',
      whyAlways: true,
      first: [fixed('47', '38', 'add')],
      gen: function () {
        return genCalc('any', function () {
          var op = pick(['add', 'sub']);
          if (op === 'add') { var a = ri(11, 88); var b = ri(11, 99 - a); if (b < 11) return null; return fixed(String(a), String(b), 'add'); }
          var x = ri(22, 99); var y = ri(11, x - 10); return fixed(String(x), String(y), 'sub');
        });
      }
    },
    {
      id: 'g4-big-read', grade: 4, extra: false,
      name: '大きな数をよむ（億・兆）',
      desc: 'そろばんの形を見て、いくつかを4つからえらびます。',
      kind: 'choice', span: { left: 13, right: 0 },
      gen: function () {
        // 億は 1億〜9000億、兆は 1兆〜90兆まで。京は小学校で扱わないので作らない。
        function one() {
          var isCho = Math.random() < 0.45;
          var zeros = isCho ? 12 : 8;
          var mul = isCho ? pick([0, 1]) : pick([0, 1, 2, 3]);
          return String(ri(1, 9)) + new Array(zeros + mul + 1).join('0');
        }
        var v = one();
        var others = [];
        var guard = 0;
        while (others.length < 3 && guard++ < 200) {
          var w = one();
          if (w !== v && others.indexOf(w) < 0) others.push(w);
        }
        return { value: v, others: others };
      }
    },
    {
      id: 'g4-big', grade: 4, extra: false,
      name: '億・兆の計算',
      desc: '2億＋6億、10兆＋20兆 のような計算です。',
      kind: 'calc', span: { left: 13, right: 0 },
      first: [fixed('200000000', '600000000', 'add'), fixed('10000000000000', '20000000000000', 'add')],
      gen: function () {
        return genCalc('any', function () {
          var unit = pick(['00000000', '000000000000']);     // 億 / 兆
          var mul = pick(['', '0']);                          // n / n0
          var op = pick(['add', 'sub']);
          if (op === 'add') {
            var a = ri(1, 8); var b = ri(1, 9 - a);
            return fixed(String(a) + mul + unit, String(b) + mul + unit, 'add');
          }
          var x = ri(2, 9); var y = ri(1, x);
          return fixed(String(x) + mul + unit, String(y) + mul + unit, 'sub');
        });
      }
    },
    {
      id: 'g4-dec2', grade: 4, extra: false,
      name: '小数第二位',
      desc: '0.02＋0.85 のような計算です。',
      kind: 'calc', span: { left: 1, right: 2 },
      first: [fixed('0.02', '0.85', 'add')],
      gen: function () {
        return genCalc('any', function () {
          var op = pick(['add', 'sub']);
          var a = ri(1, 98), b = ri(1, 98);
          var as = (a / 100).toFixed(2), bs = (b / 100).toFixed(2);
          if (op === 'add') { if (a + b > 99) return null; return fixed(as, bs, 'add'); }
          if (a - b < 1) return null;
          return fixed(as, bs, 'sub');
        });
      }
    }
  ];

  global.COURSES = COURSES;
})(window);
