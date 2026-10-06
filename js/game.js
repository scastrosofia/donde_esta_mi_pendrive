/**
 * game.js — reusable engine for "Where's My Pendrive?"
 *
 * Takes a level config (see js/levels/level1.js) and runs it:
 *  - builds the scene from config.sceneHTML
 *  - attaches click handlers to hotspots (decoys / puzzles)
 *  - runs the countdown timer with a green -> yellow -> red progress bar
 *  - drives the Pokemon-style dialogue box (typewriter + blinking ▼)
 *  - makes the character's face redden, adds a sweat drop, shakes the screen
 *  - shows win / lose overlays with a RETRY button
 */
(function () {
  'use strict';

  // Skin tones: pale -> intermediate orange -> red, with matching shadow tones.
  const SKIN_BASE = ['#f4c99b', '#e8875a', '#d94040'];
  const SKIN_SHADE = ['#e0a877', '#c96f49', '#a02e2e'];

  const els = {
    hud: document.getElementById('hud'),
    hudLevel: document.getElementById('hud-level'),
    timerWrap: document.getElementById('timer-wrap'),
    menu: document.getElementById('menu'),
    gameScreen: document.getElementById('game-screen'),
    player: document.getElementById('player'),
    timerBar: document.getElementById('timer-bar'),
    timerText: document.getElementById('timer-text'),
    dialogue: document.getElementById('dialogue'),
    dialogueText: document.getElementById('dialogue-text'),
    dialogueArrow: document.getElementById('dialogue-arrow'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayText: document.getElementById('overlay-text'),
    overlayBtn: document.getElementById('overlay-btn'),
    soundBtn: document.getElementById('sound-toggle'),
  };

  const SPRITE_SCALE = 6; // 10 x 16 grid -> 60 x 96 canvas

  let level = null;
  let state = null; // runtime state (per attempt)
  let rafId = null;
  let dlg = null;   // open dialogue, if any

  /* ---------------- helpers ---------------- */

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lerpColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Step through a list of tone stops (e.g. pale -> orange -> red) so the
  // face does not change in a flat linear gradient.
  function skinStop(stops, t) {
    const seg = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    return lerpColor(stops[i], stops[i + 1], seg - i);
  }

  function skinColor(t) {
    return skinStop(SKIN_BASE, t);
  }

  function skinShade(t) {
    return skinStop(SKIN_SHADE, t);
  }

  function nervousness() {
    return Math.min(100, (1 - state.remaining / state.total) * 100);
  }

  /* ---------------- sound effects (Web Audio API) ---------------- */

  let audioCtx = null;
  let muted = false;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  // Plays one short note. freq is a number, or [start, end] for a glide.
  function sfxNote(freq, delay, duration, type, volume) {
    const ctx = ensureAudio();
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + (delay || 0);
    const vol = volume || 0.15;

    osc.type = type || 'square';
    if (Array.isArray(freq)) {
      osc.frequency.setValueAtTime(freq[0], t0);
      osc.frequency.exponentialRampToValueAtTime(freq[1], t0 + duration);
    } else {
      osc.frequency.setValueAtTime(freq, t0);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // Wrong guess: a short descending "buzz".
  function sfxDecoy() {
    sfxNote(230, 0, 0.1, 'square', 0.12);
    sfxNote([200, 120], 0.05, 0.22, 'square', 0.12);
  }

  // Pendrive found: a happy ascending arpeggio.
  function sfxWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      sfxNote(f, i * 0.11, 0.16, 'triangle', 0.16);
    });
  }

  // Time's up: a slow, sad descent.
  function sfxLose() {
    sfxNote([392, 98], 0, 1.15, 'sawtooth', 0.13);
  }

  els.soundBtn.addEventListener('click', function () {
    muted = !muted;
    els.soundBtn.textContent = muted ? '🔇' : '🔊';
    els.soundBtn.title = muted ? 'Activar sonido' : 'Silenciar sonido';
    els.soundBtn.setAttribute('aria-label', els.soundBtn.title);
    els.soundBtn.classList.toggle('muted', muted);
  });

  /* ---------------- start menu ---------------- */

  function showMenu() {
    // Render Level 1's room as a dimmed backdrop behind the menu.
    const backdrop = window.LEVELS[1];
    els.gameScreen.innerHTML = backdrop.sceneHTML;
    els.gameScreen.appendChild(els.player);
    els.player.style.left = backdrop.player.left;
    els.player.style.bottom = backdrop.player.bottom;
    drawSprite(els.player, { faceColor: SKIN_BASE[0], faceShade: SKIN_SHADE[0], sweat: false, sweatTick: 0 });

    els.dialogue.classList.add('hidden');
    els.overlay.classList.add('hidden');
    els.hud.classList.add('hidden');
    els.timerWrap.classList.add('hidden');
    els.menu.classList.remove('hidden');
  }

  function playLevel(id) {
    els.menu.classList.add('hidden');
    els.hud.classList.remove('hidden');
    els.timerWrap.classList.remove('hidden');
    startLevel(window.LEVELS[id]);
  }

  els.menu.addEventListener('click', function (e) {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    if (item.dataset.level) {
      playLevel(Number(item.dataset.level));
    } else if (item.classList.contains('locked')) {
      // locked level: shake the slot to say "not yet!"
      item.classList.remove('no');
      void item.offsetWidth; // restart the animation
      item.classList.add('no');
    }
  });

  /* ---------------- level lifecycle ---------------- */

  function startLevel(cfg) {
    if (rafId) cancelAnimationFrame(rafId);
    level = cfg;

    els.hudLevel.textContent = 'Nivel ' + cfg.id + ': ' + cfg.name;

    // Rebuild the scene, then put the player canvas back on top.
    els.gameScreen.innerHTML = cfg.sceneHTML;
    els.gameScreen.appendChild(els.player);
    els.player.style.left = cfg.player.left;
    els.player.style.bottom = cfg.player.bottom;

    state = {
      total: cfg.timeLimit,
      remaining: cfg.timeLimit,
      busy: true, // true while a dialogue is open (timer paused)
      over: false,
      sweatTick: 0,
      lastTs: 0,
      // random hotspot hiding the pendrive this round (no visual tell)
      winner: (cfg.winCandidates && cfg.winCandidates.length)
        ? pick(cfg.winCandidates)
        : null,
    };

    els.overlay.classList.add('hidden');
    els.dialogue.classList.add('hidden');
    els.gameScreen.classList.remove('shaking');

    bindHotspots(cfg);
    updateTimerBar();
    drawPlayerFrame();

    showDialogue(cfg.introLines, function () {
      state.busy = false;
      state.lastTs = performance.now();
      rafId = requestAnimationFrame(tick);
    });
  }

  function tick(ts) {
    if (state.over) return;
    const dt = Math.max(0, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    if (!state.busy) {
      state.remaining = Math.max(0, state.remaining - dt);
      if (state.remaining <= 0) {
        lose();
        return;
      }
    }

    state.sweatTick++;
    updateTimerBar();
    drawPlayerFrame();
    rafId = requestAnimationFrame(tick);
  }

  function lose() {
    state.over = true;
    cancelAnimationFrame(rafId);
    els.gameScreen.classList.remove('shaking');
    sfxLose();
    showOverlay(level.loseTitle, level.loseText, false);
  }

  function showOverlay(title, text, isWin) {
    els.overlayTitle.textContent = title;
    els.overlayTitle.className = isWin ? 'win' : '';
    els.overlayText.textContent = text;
    els.overlay.classList.remove('hidden');
  }

  els.overlayBtn.addEventListener('click', function () {
    startLevel(level);
  });

  /* ---------------- timer bar ---------------- */

  function updateTimerBar() {
    const pct = Math.max(0, Math.min(100, (state.remaining / state.total) * 100));
    els.timerBar.style.width = pct + '%';
    els.timerBar.classList.toggle('yellow', pct <= 50 && pct > 25);
    els.timerBar.classList.toggle('red', pct <= 25);
    els.timerText.textContent = Math.ceil(state.remaining);
  }

  /* ---------------- character sprite ---------------- */

  function drawPlayerFrame() {
    const nervous = state.over ? 100 : nervousness();
    const t = nervous / 100;
    const sweat = nervous > level.nervousness.sweatAt;
    const shaking = !state.over && nervous > level.nervousness.shakeAt;

    drawSprite(els.player, {
      faceColor: skinColor(t),
      faceShade: skinShade(t),
      sweat: sweat,
      sweatTick: state.sweatTick,
    });

    els.gameScreen.classList.toggle('shaking', shaking);
  }

  /* ---------------- hotspots ---------------- */

  /**
   * Shared handler called when the player clicks the revealed safe on the
   * winning object.  Stops the timer, plays the win SFX and shows the
   * victory overlay.  Every winning object MUST funnel through this function
   * — never a local win() or bare overlay call.
   */
  function onPendriveFound() {
    state.over = true;
    cancelAnimationFrame(rafId);
    els.gameScreen.classList.remove('shaking');
    drawPlayerFrame();
    sfxWin();
    showOverlay(level.winTitle, level.winText, true);
  }

  function bindHotspots(cfg) {
    cfg.hotspots.forEach(function (hs) {
      const el = els.gameScreen.querySelector('[data-hotspot="' + hs.id + '"]');
      if (!el) {
        console.warn('Level ' + cfg.id + ': hotspot "' + hs.id + '" not found in scene');
        return;
      }
      el.classList.add('hotspot');

      // the random winner of this round uses its reveal config; everyone else
      // is a plain decoy. Both paths share the same click/dialogue structure.
      const isWinner = hs.id === state.winner;
      const reveal = (isWinner && cfg.reveals && cfg.reveals[hs.id]) ? cfg.reveals[hs.id] : null;
      if (isWinner) el.dataset.winner = '1';

      el.addEventListener('click', function (e) {
        if (state.busy || state.over) return;

        if (reveal) {
          if (el.classList.contains(reveal.revealClass)) {
            // Safe already revealed — check if the click landed on it.
            if (e.target.closest(reveal.winTarget)) {
              onPendriveFound();
            }
            return;
          }
          // First click: play the reveal dialogue, then add the reveal class
          // which triggers the CSS open animation (painting-open, desk-open …).
          showDialogue(reveal.revealLines, function () {
            el.classList.add(reveal.revealClass);
          });
        } else {
          state.remaining = Math.max(0, state.remaining - hs.penaltySeconds);
          updateTimerBar(); // reflect the penalty immediately
          sfxDecoy();
          showDialogue(pick(hs.dialogues), function () {
            if (state.remaining <= 0) lose();
          });
        }
      });
    });
  }

  /* ---------------- dialogue box ---------------- */

  function showDialogue(lines, onDone) {
    if (typeof lines === 'string') lines = [lines];
    state.busy = true;
    dlg = { lines: lines.slice(), idx: 0, onDone: onDone || null, timer: null };
    els.dialogue.classList.remove('hidden');
    typeLine();
  }

  function typeLine() {
    const text = dlg.lines[dlg.idx];
    let chars = 0;
    els.dialogueText.textContent = '';
    els.dialogueArrow.classList.remove('visible');
    dlg.timer = setInterval(function () {
      chars++;
      els.dialogueText.textContent = text.slice(0, chars);
      if (chars >= text.length) {
        clearInterval(dlg.timer);
        dlg.timer = null;
        els.dialogueArrow.classList.add('visible');
      }
    }, 26);
  }

  function advanceDialogue() {
    if (!dlg) return;
    if (dlg.timer) {
      // clicking while typing completes the line instantly
      clearInterval(dlg.timer);
      dlg.timer = null;
      els.dialogueText.textContent = dlg.lines[dlg.idx];
      els.dialogueArrow.classList.add('visible');
      return;
    }
    dlg.idx++;
    if (dlg.idx < dlg.lines.length) {
      typeLine();
      return;
    }
    const cb = dlg.onDone;
    dlg = null;
    els.dialogue.classList.add('hidden');
    els.dialogueArrow.classList.remove('visible');
    state.busy = false;
    if (cb) cb();
  }

  els.dialogue.addEventListener('click', advanceDialogue);

  /* ---------------- boot ---------------- */

  els.player.width = SPRITE.W * SPRITE_SCALE;
  els.player.height = SPRITE.H * SPRITE_SCALE;

  showMenu();
})();
