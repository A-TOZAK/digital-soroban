/* デジタルそろばん — 問題を出す・見る・こたえあわせ
   ヒントは既定でオフ。押したときだけ、次のひと手を出す。
   光った所を押す作業にしないため、出すのは1手ずつ。 */
(function (global) {
  'use strict';

  var A = global.Abacus;
  var COURSES = global.COURSES;
  var PER_SET = 5;
  var SOLID_ART = ['g3-man', 'g4-big'];   // 背景が紙白でない絵
  var MARU = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

  var el = {};
  var sb = null;
  var grade = 3;
  var cur = null;      // {course, index, q, startDigits, beats, states, answer}

  function $(id) { return document.getElementById(id); }

  /** 読み取った数を出すか、伏せるか。
      ふだんは伏せておく——珠を読むのが先で、数はたしかめに使うもの。 */
  function isRevealed() { return document.body.classList.contains('reveal'); }

  function setReveal(on) {
    document.body.classList.toggle('reveal', !!on);
    if (!el.revealBtn) return;
    el.revealBtn.textContent = on ? '数をかくす' : '数を出す';
    el.revealBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.revealBtn.classList.toggle('is-on', !!on);
  }

  /** 盤ぜんたいを見せるか、指でさわれる大きさにするか */
  function setFit(on) {
    var w = el.sorobanWrap;
    w.classList.toggle('fit-all', on);
    el.fitBtn.textContent = on ? '大きくする' : 'ぜんぶ見る';
    el.fitBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.fitBtn.classList.toggle('is-on', on);
    el.fitBtn.hidden = false;
    if (!on) scrollToActive();
  }

  /** はみ出す画面のときだけ、切りかえボタンを出す */
  function updateFitBtn() {
    var w = el.sorobanWrap;
    if (!w || !el.fitBtn) return;
    var over = w.scrollWidth > w.clientWidth + 2 || w.classList.contains('fit-all');
    el.fitBtn.hidden = !over;
  }

  /** 使う桁が画面に入るよう、盤を横にずらす */
  function scrollToActive(from, to) {
    var w = el.sorobanWrap;
    if (!w || w.classList.contains('fit-all')) return;
    var rods = document.querySelectorAll('.rod');
    if (!rods.length) return;
    if (from == null) { from = sb ? sb.state.onesIndex - 3 : 11; to = rods.length - 1; }
    var a = rods[Math.max(0, from)].getBoundingClientRect();
    var b = rods[Math.min(rods.length - 1, to)].getBoundingClientRect();
    var box = w.getBoundingClientRect();
    var mid = (a.left + b.right) / 2 - box.left + w.scrollLeft;
    w.scrollTo({ left: Math.max(0, mid - box.width / 2), behavior: 'smooth' });
  }

  /* ===== 数の見せかた ===== */
  function show(numStr) {
    var n = String(numStr);
    var kanji = A.toKanjiUnits(n);
    return (kanji !== n) ? kanji : n;
  }
  function opSign(op) { return op === 'sub' ? '−' : '＋'; }
  function opVerb(op) { return op === 'sub' ? 'ひきましょう' : 'たしましょう'; }

  /* ===== コースの一覧 ===== */
  function renderCourses() {
    var wrap = el.courseList;
    wrap.textContent = '';
    var main = COURSES.filter(function (c) { return c.grade === grade && !c.extra; });
    var extra = COURSES.filter(function (c) { return c.grade === grade && c.extra; });

    wrap.appendChild(courseGroup(null, main));
    if (extra.length) {
      wrap.appendChild(courseGroup('もっとやってみる', extra));
    }
  }

  function courseGroup(title, list) {
    var box = document.createElement('div');
    box.className = 'course-group';
    if (title) {
      var h = document.createElement('h3');
      h.className = 'group-title';
      h.textContent = title;
      box.appendChild(h);
    }
    list.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'course';
      b.innerHTML =
        '<span class="c-text">' +
          '<span class="cnum"></span>' +
          '<span class="cname ja-phrase"></span>' +
          '<span class="cdesc ja-phrase"></span>' +
        '</span>' +
        '<span class="c-art"><img alt="" loading="lazy"></span>';
      b.querySelector('.cnum').textContent = c.grade + '年 ' + MARU[i];
      b.querySelector('.cname').textContent = c.name;
      b.querySelector('.cdesc').textContent = c.desc;
      var img = b.querySelector('.c-art img');
      img.src = 'assets/img/c_' + c.id + '.webp';
      // 紙に溶かせなかった絵（地が暗いもの）だけ、角をまるめる
      if (SOLID_ART.indexOf(c.id) >= 0) img.classList.add('solid');
      // 絵がまだ無いコースは、絵の席ごと畳む（文字だけでも形がくずれない）
      img.addEventListener('error', function () { b.querySelector('.c-art').remove(); });
      if (c.note) {
        var n = document.createElement('span');
        n.className = 'cnote ja-phrase';
        n.textContent = c.note;
        b.querySelector('.c-text').appendChild(n);
      }
      b.addEventListener('click', function () { startCourse(c); });
      box.appendChild(b);
    });
    return box;
  }

  /* ===== 出題 ===== */

  function startCourse(course) {
    cur = { course: course, index: 0 };
    el.courseList.hidden = true;
    el.quiz.hidden = false;
    el.quizCourse.textContent = grade + '年　' + course.name;
    el.qTotal.textContent = PER_SET;
    nextQuestion(true);
    el.quiz.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function backToList() {
    cur = null;
    el.quiz.hidden = true;
    el.courseList.hidden = false;
    renderCourses();
    sb.setActiveRange(null, null);
    sb.clearLight();
    sb.lockMarker(grade === 3);
  }

  function makeQuestion(course, index) {
    if (course.first && index < course.first.length) {
      var f = course.first[index];
      return { a: f.a, b: f.b, op: f.op };
    }
    var q = course.gen();
    if (!q) q = course.gen();
    return q;
  }

  function nextQuestion(first) {
    var c = cur.course;
    if (!first) cur.index++;
    if (cur.index >= PER_SET) { finishSet(); return; }

    var q = makeQuestion(c, cur.index);
    cur.q = q;
    el.qNow.textContent = cur.index + 1;

    // 使う桁だけを明るくする
    var oi = sb.state.onesIndex;
    sb.setActiveRange(oi - c.span.left, oi + c.span.right);
    // 問題に入ったら、珠を指でさわれる大きさにして、使う桁まで寄せる
    if (el.sorobanWrap.classList.contains('fit-all') &&
        el.sorobanWrap.scrollWidth <= el.sorobanWrap.clientWidth + 2) {
      setFit(false);
    }
    scrollToActive(oi - c.span.left - 1, oi + c.span.right + 1);
    sb.lockMarker(true);
    sb.clearLight();

    setReveal(false);   // 新しい問題では、数はいったん伏せる
    el.judge.hidden = true;
    el.beatSay.hidden = true;
    el.whyNote.hidden = true;
    el.nextBtn.hidden = true;
    el.checkBtn.hidden = false;
    el.hintBtn.hidden = false;
    el.ansBox.value = '';

    if (c.kind === 'read' || c.kind === 'choice') {
      sb.setNumber(q.value);
      cur.answer = q.value;
      cur.beats = null;
      el.quizAsk.innerHTML = 'そろばんの数は、いくつですか。';
      if (c.kind === 'choice') {
        el.quizInput.hidden = true;
        renderChoices(q);
      } else {
        el.quizInput.hidden = false;
        el.choices.hidden = true;
        el.ansBox.placeholder = '数を打つ';
      }
      el.hintBtn.hidden = true;
    } else if (c.kind === 'enter') {
      sb.setNumber('0');
      cur.answer = q.value;
      cur.startDigits = A.digits(sb.state).join('');
      buildBeats('0', q.value, 'add');
      el.quizInput.hidden = true;
      el.choices.hidden = true;
      el.quizAsk.innerHTML = '<b class="big">' + show(q.value) + '</b> を、そろばんに入れましょう。';
    } else {
      sb.setNumber(q.a);
      cur.startDigits = A.digits(sb.state).join('');
      var r = A.plan(A.stateFromNumber(q.a, oi), q.b, q.op);
      cur.answer = A.toNumberString(r.result);
      buildBeats(q.a, q.b, q.op);
      el.quizInput.hidden = true;
      el.choices.hidden = true;
      el.quizAsk.innerHTML =
        '<span class="formula"><b>' + show(q.a) + '</b> ' + opSign(q.op) + ' <b>' + show(q.b) + '</b> ＝ ?</span>' +
        '<span class="howto">そろばんに入っている ' + show(q.a) + ' に、' + show(q.b) + ' を' + opVerb(q.op) + '。</span>';
    }

    // 「なぜそう動かすか」は、そのコースの1問目だけ言葉で出す
    if (c.why && (cur.index === 0 || c.whyAlways)) {
      el.whyNote.hidden = false;
      el.whyNote.innerHTML = c.why;
    }
    cur.hintAt = 0;
  }

  function renderChoices(q) {
    el.choices.hidden = false;
    el.choices.textContent = '';
    var all = [q.value].concat(q.others);
    for (var i = all.length - 1; i > 0; i--) {   // まぜる
      var j = Math.floor(Math.random() * (i + 1));
      var t = all[i]; all[i] = all[j]; all[j] = t;
    }
    all.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn choice';
      b.textContent = show(v);
      b.dataset.v = v;
      b.addEventListener('click', function () {
        el.choices.querySelectorAll('.choice').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
      el.choices.appendChild(b);
    });
  }

  /** 手順と、ひと手ごとの盤の形をためておく */
  function buildBeats(aStr, bStr, op) {
    var oi = sb.state.onesIndex;
    var start = A.stateFromNumber(aStr, oi);
    var r = A.plan(start, bStr, op);
    cur.beats = r.ok ? r.beats : null;
    cur.states = [];
    if (!r.ok) return;
    var s = A.stateFromNumber(aStr, oi);
    cur.states.push(A.digits(s).join(''));
    r.beats.forEach(function (bt) {
      s.rods[bt.rod].h = bt.to.h;
      s.rods[bt.rod].e = bt.to.e;
      cur.states.push(A.digits(s).join(''));
    });
  }

  /* ===== こたえあわせ ===== */

  function check() {
    var c = cur.course;
    var ok, mine;

    if (c.kind === 'choice') {
      var sel = el.choices.querySelector('.choice.is-on');
      if (!sel) { say('えらんでから、こたえあわせを押してください。', 'wait'); return; }
      mine = sel.dataset.v;
      ok = (mine === cur.answer);
    } else if (c.kind === 'read') {
      mine = el.ansBox.value.trim().replace(/[０-９．]/g, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      }).replace(/[,，\s]/g, '');
      if (mine === '') { say('数を打ってから、こたえあわせを押してください。', 'wait'); return; }
      ok = sameNum(mine, cur.answer);
    } else {
      mine = A.toNumberString(sb.state);
      ok = sameNum(mine, cur.answer);
    }

    if (ok) {
      say('せいかい。', 'ok');
      sb.clearLight();
      el.checkBtn.hidden = true;
      el.hintBtn.hidden = true;
      el.nextBtn.hidden = false;
      el.nextBtn.textContent = (cur.index + 1 >= PER_SET) ? 'おわり →' : 'つぎのもんだい →';
    } else {
      if (c.kind === 'read' || c.kind === 'choice') {
        say('ちがいます。梁（はり）に寄っている珠だけ数えます。上の珠は5、下の珠は1つで1です。', 'ng');
      } else {
        say('いまのそろばんは ' + show(mine) + ' です。もういちど見てみましょう。', 'ng');
      }
    }
  }

  /** 「2.60」と「2.6」を同じとみなす */
  function sameNum(a, b) {
    function norm(x) {
      x = String(x);
      if (x.indexOf('.') < 0) return x.replace(/^0+(?=\d)/, '');
      return x.replace(/0+$/, '').replace(/\.$/, '').replace(/^0+(?=\d)/, '');
    }
    return norm(a) === norm(b);
  }

  function say(text, kind) {
    el.judge.hidden = false;
    el.judge.className = 'judge is-' + kind;
    el.judge.textContent = text;
  }

  /* ===== ヒント ===== */

  function hint() {
    if (!cur.beats) { say('この問題にヒントはありません。', 'wait'); return; }
    var now = A.digits(sb.state).join('');
    var n = -1;
    for (var i = cur.states.length - 1; i >= 0; i--) {
      if (cur.states[i] === now) { n = i; break; }
    }
    if (n < 0) {
      say('そろばんが、とちゅうの形とちがいます。「もういちど」で、はじめの形にもどせます。', 'wait');
      sb.clearLight();
      return;
    }
    if (n >= cur.beats.length) {
      say('もうできています。「こたえあわせ」を押してみましょう。', 'wait');
      sb.clearLight();
      return;
    }
    var beat = cur.beats[n];
    sb.lightBeat(beat);
    el.beatSay.hidden = false;
    el.beatSay.innerHTML = '光っている珠を、<b>' + beat.say + '</b>（あと ' + (cur.beats.length - n) + ' 手）';
  }

  function resetBoard() {
    var c = cur.course;
    if (c.kind === 'enter') sb.setNumber('0');
    else if (c.kind === 'calc') sb.setNumber(cur.q.a);
    sb.clearLight();
    el.beatSay.hidden = true;
    el.judge.hidden = true;
  }

  function finishSet() {
    el.quizAsk.innerHTML = '<b class="big">おつかれさま。</b>';
    el.quizInput.hidden = true;
    el.choices.hidden = true;
    el.checkBtn.hidden = true;
    el.hintBtn.hidden = true;
    el.nextBtn.hidden = true;
    el.beatSay.hidden = true;
    say(PER_SET + 'もん、やりました。もういちど やるか、ほかのコースをえらんでください。', 'ok');
    sb.clearLight();
  }

  /* ===== 立ち上げ ===== */

  function init() {
    ['courseList', 'quiz', 'quizCourse', 'quizAsk', 'quizInput', 'ansBox', 'qNow', 'qTotal',
      'checkBtn', 'hintBtn', 'nextBtn', 'judge', 'beatSay', 'whyNote', 'quizBack',
      'readNum', 'readKanji', 'clearBtn', 'soundBtn', 'stageBtn', 'stageExit', 'rubyToggle',
      'fitBtn', 'sorobanWrap', 'revealBtn']
      .forEach(function (id) { el[id] = $(id); });

    // 選択肢の入れ物と「もういちど」ボタンを足す
    el.choices = document.createElement('div');
    el.choices.className = 'choices';
    el.choices.hidden = true;
    el.quizInput.parentNode.insertBefore(el.choices, el.quizInput.nextSibling);

    el.againBtn = document.createElement('button');
    el.againBtn.type = 'button';
    el.againBtn.className = 'btn';
    el.againBtn.textContent = 'もういちど';
    el.againBtn.addEventListener('click', resetBoard);
    el.hintBtn.parentNode.insertBefore(el.againBtn, el.hintBtn.nextSibling);

    sb = new global.Soroban(document.getElementById('soroban'), {
      onChange: function (state) {
        var n = A.toNumberString(state);
        el.readNum.textContent = n;
        var k = A.toKanjiUnits(n);
        el.readKanji.textContent = (k !== n) ? k : '';
      }
    });
    global.sb = sb;
    sb.lockMarker(true);      // はじめは3年の面なので固定

    renderCourses();

    document.querySelectorAll('.gtab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.gtab').forEach(function (x) {
          x.classList.remove('is-on'); x.setAttribute('aria-selected', 'false');
        });
        t.classList.add('is-on'); t.setAttribute('aria-selected', 'true');
        grade = Number(t.dataset.grade);
        backToList();
      });
    });

    el.quizBack.addEventListener('click', backToList);
    el.checkBtn.addEventListener('click', check);
    el.hintBtn.addEventListener('click', hint);
    el.nextBtn.addEventListener('click', function () { nextQuestion(false); });
    el.ansBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });

    el.clearBtn.addEventListener('click', function () { sb.clearAll(); sb.clearLight(); });

    el.fitBtn.addEventListener('click', function () {
      setFit(!el.sorobanWrap.classList.contains('fit-all'));
    });
    window.addEventListener('resize', updateFitBtn);
    // せまい画面では、はじめは盤ぜんたいを見せる。
    // 珠をさわる前に「そろばんが1つの道具である」ことが分かるほうが大事なので。
    setTimeout(function () {
      var w = el.sorobanWrap;
      // すでに問題が始まっているとき（URLで直にコースを開いたとき）は縮めない
      if (!cur && w.scrollWidth > w.clientWidth + 2) setFit(true);
      else updateFitBtn();
    }, 60);

    el.soundBtn.addEventListener('click', function () {
      var on = global.Sound.toggle();
      el.soundBtn.textContent = 'おと：' + (on ? 'オン' : 'オフ');
      el.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      el.soundBtn.classList.toggle('is-on', on);
      if (on) global.Sound.click('beam', 1);
    });

    el.stageBtn.addEventListener('click', function () { document.body.classList.add('stage'); });
    el.stageExit.addEventListener('click', function () { document.body.classList.remove('stage'); });
    el.revealBtn.addEventListener('click', function () { setReveal(!isRevealed()); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.body.classList.remove('stage');
    });

    el.rubyToggle.addEventListener('change', function () {
      document.body.classList.toggle('no-ruby', !el.rubyToggle.checked);
    });

    openFromHash();   // ← 盤の大きさを決める前に、コースが始まっているかを確定させる

    // 絵がまだ無いときは、その席ごと畳む（壊れた画像を出さない）
    document.querySelectorAll('.hero-art img, .sec-motif img, .f-art img').forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.closest('.hero-art, .sec-motif, .f-art');
        if (holder) holder.remove();
      });
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
    });

    window.addEventListener('hashchange', openFromHash);
  }

  /**
   * URLのうしろで、コースや画面を直に開く。先生がブックマークできるように。
   *   #g4-two   … そのコースを開く
   *   #stage    … 大きくうつすで開く（電子黒板用）
   */
  function openFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    if (h === 'stage') { document.body.classList.add('stage'); return; }
    var c = COURSES.filter(function (x) { return x.id === h; })[0];
    if (!c) return;
    grade = c.grade;
    document.querySelectorAll('.gtab').forEach(function (t) {
      var on = Number(t.dataset.grade) === grade;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderCourses();
    startCourse(c);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
