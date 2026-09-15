/* デジタルそろばん — 珠の音
   音源ファイルは持たない。その場で短いノイズを作って、木の当たる音にする。
   既定はオフ。教室でいっせいに鳴ると困るので、子どもが自分で入れる。 */
(function (global) {
  'use strict';

  var ctx = null;
  var noise = null;
  var last = 0;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // 0.12秒ぶんのホワイトノイズを1本だけ作って、使いまわす
    var len = Math.floor(ctx.sampleRate * 0.12);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  var Sound = {
    enabled: false,

    toggle: function () {
      this.enabled = !this.enabled;
      if (this.enabled) {
        var c = ensure();
        if (c && c.state === 'suspended') c.resume();
      }
      return this.enabled;
    },

    /**
     * @param {'beam'|'frame'} where 梁に当たったか、枠に当たったか
     * @param {number} n いちどに動いた珠の数（音の太さに使う）
     */
    click: function (where, n) {
      if (!this.enabled) return;
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();

      var now = c.currentTime;
      if (now - last < 0.012) return;   // 同じ瞬間に何度も鳴らさない
      last = now;

      var src = c.createBufferSource();
      src.buffer = noise;

      var base = (where === 'beam') ? 1750 : 1150;
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = base * (0.88 + Math.random() * 0.24);  // 毎回すこしずらす
      bp.Q.value = 3.4;

      var hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 420;

      var g = c.createGain();
      var vol = Math.min(0.20, 0.085 + 0.035 * (n || 1));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(c.destination);
      src.start(now);
      src.stop(now + 0.12);
    }
  };

  global.Sound = Sound;
})(window);
