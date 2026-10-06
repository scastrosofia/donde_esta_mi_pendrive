/**
 * sprite.js
 * Pixel-art character sprite, drawn on a <canvas> with image-rendering: pixelated.
 *
 * The sprite is a 16 x 24 grid of characters. Each character maps to a color
 * in PALETTE. Every color zone (hair, skin, suit, shoes) has a base tone plus
 * a darker shade on the "unlit" side — as if light comes from the upper left,
 * like real GBA sprites — and the whole silhouette gets a 1px dark outline.
 *
 * The skin keys ("K" base / "k" shade) are recolored at draw time so the face
 * can turn progressively redder as the character gets more nervous.
 */
(function () {
  'use strict';

  const SPRITE = {
    W: 16,
    H: 24,
    GRID: [
      '......OOOO......', // 0  hair outline
      '.....OHHHHO.....', // 1
      '....OHHHHHHO....', // 2
      '...OHHHHHHHHO...', // 3
      '...OHHHHHHHhO...', // 4
      '...OHHKKKKkkO...', // 5  forehead
      '...OKKEKKEkkO...', // 6  eyes
      '...OKKKKKKKkO...', // 7  cheeks
      '...OKKKMMKKkO...', // 8  mouth
      '...OKKKKKKKkO...', // 9  jaw
      '....OCCTTCCO....', // 10 collar
      '....OSSTTSsO....', // 11 suit + tie
      '....OSSTTSsO....', // 12
      '....OSSTTTSsO...', // 13 tie tip
      '....OSSSSSsO....', // 14 torso
      '....OSSSSSsO....', // 15
      '...OKSSSSSKO....', // 16 arms
      '...OKSSSSSKO....', // 17 hands
      '....OSSSSSO.....', // 18 waist
      '....OSSSSsO.....', // 19 pants
      '....OSSSSsO.....', // 20
      '....OSSOSsO.....', // 21 legs
      '...OBBBBBBBbO...', // 22 shoes
      '...OBBBBBBBbO...', // 23
    ],
    PALETTE: {
      O: '#10131c', // outline (whole silhouette)
      H: '#4a2f1d', // hair base
      h: '#2e1c10', // hair shade (unlit side)
      K: '#f4c99b', // skin base (overridden at draw time)
      k: '#e0a877', // skin shade (overridden at draw time)
      E: '#23232b', // eyes
      M: '#8a2f2f', // mouth
      C: '#f2efe6', // collar
      T: '#c22b2b', // tie
      S: '#2b3550', // suit base
      s: '#1a2138', // suit shade (unlit side)
      B: '#15151a', // shoes base
      b: '#0c0c10', // shoes shade
    },
  };

  /**
   * Draw the sprite onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts - { faceColor, faceShade, sweat:boolean, sweatTick:number }
   */
  function drawSprite(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / SPRITE.W;
    const palette = Object.assign({}, SPRITE.PALETTE, {
      K: opts.faceColor || SPRITE.PALETTE.K,
      k: opts.faceShade || SPRITE.PALETTE.k,
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < SPRITE.H; y++) {
      const row = SPRITE.GRID[y];
      for (let x = 0; x < SPRITE.W; x++) {
        const color = palette[row[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Sweat drop on the side of the head, blinking.
    if (opts.sweat) {
      const blinkOn = Math.floor((opts.sweatTick || 0) / 28) % 2 === 0;
      if (blinkOn) {
        ctx.fillStyle = '#5ba7f5';
        ctx.fillRect(12 * scale, 2 * scale, scale, scale);
        ctx.fillRect(13 * scale, 2 * scale, scale, scale);
        ctx.fillRect(12 * scale, 3 * scale, scale, scale);
        ctx.fillRect(13 * scale, 3 * scale, scale, scale);
        ctx.fillRect(13 * scale, 4 * scale, scale, scale);
      }
    }
  }

  window.SPRITE = SPRITE;
  window.drawSprite = drawSprite;
})();
