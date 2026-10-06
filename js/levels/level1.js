/**
 * level1.js — Level 1: "The Office"
 *
 * Each level is a plain configuration object registered in window.LEVELS.
 * The game engine (js/game.js) reads this config and builds the level,
 * so Level 2+ is just a new file in this folder.
 *
 * Config shape:
 *   id, name, timeLimit (seconds)
 *   nervousness: { sweatAt, shakeAt }  (percent of time elapsed)
 *   player: { left, bottom }  CSS position of the character canvas
 *   introLines: [string]  dialogue shown when the level starts (timer pauses)
 *   sceneHTML: string     room markup; hotspots carry data-hotspot="id"
 *   hotspots: [
 *     { id, penaltySeconds, dialogues: [string] }  decoy behaviour
 *   ]
 *   winCandidates: [id, ...]  hotspots that may hide the pendrive this round
 *   reveals: {  (per candidate: how its hidden safe is revealed when winner)
 *     id: { revealClass, winTarget, revealLines: [string] }
 *   }
 *   winTitle, winText, loseTitle, loseText
 *
 * The engine picks ONE random winCandidates id per load/retry; that object
 * opens its reveal (from `reveals`) when clicked; the rest act as decoys.
 */
(function () {
  'use strict';

  window.LEVELS = window.LEVELS || {};

  window.LEVELS[1] = {
    id: 1,
    name: 'El Despacho',
    timeLimit: 45,

    nervousness: { sweatAt: 55, shakeAt: 80 },

    player: { left: '48%', bottom: '30%' },

    introLines: [
      'Uh, no... ¡la conferencia de prensa empieza en unos minutos!',
      'Tu pendrive está en algún lugar del despacho. ¡Encontralo antes de que se acabe el tiempo!',
      'Tocá los objetos para buscar. ¡Cada error te cuesta 5 segundos!',
    ],

    sceneHTML: `
      <div class="wall"></div>
      <div class="floor"></div>

      <div class="window" data-hotspot="window">
        <img class="hotspot-img" src="objects/7. window.png" alt="Una ventana con vista al Congreso" draggable="false">
      </div>

      <div class="painting" data-hotspot="painting">
        <img class="hotspot-img" src="objects/1. painting.png" alt="Retrato del General San Martín" draggable="false">
        <div class="safe-body">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>

      <div class="bookshelf" data-hotspot="bookshelf">
        <img class="hotspot-img" src="objects/5. bookshelf.png" alt="Una estantería con libros" draggable="false">
        <div class="bookshelf-panel">
          <span class="sbook sbook-1"></span><span class="sbook sbook-2"></span><span class="sbook sbook-3"></span>
        </div>
        <div class="bookshelf-safe">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>

      <div class="minibar" data-hotspot="minibar">
        <img class="hotspot-img" src="objects/3. minibar.png" alt="Un minibar" draggable="false">
        <div class="minibar-panel"><span class="minibar-handle"></span></div>
        <div class="minibar-safe">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>

      <div class="plant" data-hotspot="plant">
        <img class="hotspot-img" src="objects/6. plant.png" alt="Una planta" draggable="false">
        <div class="plant-safe">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>

      <div class="desk" data-hotspot="desk">
        <img class="hotspot-img" src="objects/2. desk.png" alt="Un escritorio" draggable="false">
        <div class="desk-drawer"><span class="desk-handle"></span></div>
        <div class="desk-safe">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>

      <div class="trash" data-hotspot="trash">
        <img class="hotspot-img" src="objects/4. bin.png" alt="Un tacho de basura" draggable="false">
        <span class="trash-paper paper-a"></span>
        <span class="trash-paper paper-b"></span>
        <div class="trash-safe">
          <div class="safe-dial"></div>
          <div class="safe-handle"></div>
        </div>
      </div>
    `,

    hotspots: [
      {
        id: 'window',
        penaltySeconds: 5,
        dialogues: [
          'El Congreso se ve tranquilo hoy... raro, con todo lo que está pasando adentro.',
        ],
      },
      {
        id: 'bookshelf',
        penaltySeconds: 5,
        dialogues: [
          '"Cómo Ocultar un Pendrive, Tomo 1" no está entre estos libros.',
          'Todo clásicos. Ninguno es un pendrive.',
          'Sacudís un estante. Solo palabras por acá.',
        ],
      },
      {
        id: 'desk',
        penaltySeconds: 5,
        dialogues: [
          'Papeles, lapiceras, un sánguche a medio comer. El pendrive no se impresiona.',
          'Revolvés el cajón. Solo más lapiceras que no andan.',
          'Una notita dice "el pendrive no está acá". Sospechosamente específica.',
        ],
      },
      {
        id: 'plant',
        penaltySeconds: 5,
        dialogues: [
          'La planta no vio nada. Muy poco colaboradora, la verdad.',
          'Revolvés la tierra. El pendrive no está creciendo ahí.',
          'La planta susurra: "acá no está, amigo."',
        ],
      },
      {
        id: 'trash',
        penaltySeconds: 5,
        dialogues: [
          'Puaj. Cáscaras de banana y malas decisiones. Sin pendrive.',
          'Te animás a meter la mano en el tacho. Tu premio: un pañuelo usado. Genial.',
          'El tacho hace ruido. Es solo una bola de papel. Decepcionante.',
        ],
      },
      {
        id: 'minibar',
        penaltySeconds: 5,
        dialogues: [
          'Solo botellitas. Tu pendrive necesitaría un documento trucho.',
          'Revisás detrás de las botellas. Solo más botellas.',
          'El minibar te ofrece una copa. Rechazás. El tiempo corre.',
        ],
      },
      {
        id: 'painting',
        penaltySeconds: 5,
        dialogues: [
          '¡El General San Martín me mira fijo! Mejor sigo buscando en otro lado.',
        ],
      },
    ],

    // one of these hides the pendrive each round
    winCandidates: ['painting', 'desk', 'minibar', 'trash', 'bookshelf', 'plant'],

    // reveal animation + dialogue per candidate (only used when it is the winner)
    reveals: {
      painting: {
        revealClass: 'painting-open',
        winTarget: '.safe-body',
        revealLines: [
          '¡Ahí estaba! El Libertador guardando el secreto mejor guardado de la patria.',
        ],
      },
      desk: {
        revealClass: 'desk-open',
        winTarget: '.desk-safe',
        revealLines: [
          'El cajón se desliza solo y adentro hay... ¡una caja fuerte! Tu pendrive seguro está ahí.',
        ],
      },
      minibar: {
        revealClass: 'minibar-open',
        winTarget: '.minibar-safe',
        revealLines: [
          'Corrés el panel del minibar y detrás de las botellas... ¡una caja fuerte de viaje!',
        ],
      },
      trash: {
        revealClass: 'trash-open',
        winTarget: '.trash-safe',
        revealLines: [
          'Los papeles se caen y en el fondo del tacho... ¡una caja fuerte! ¿Quién esconde eso ahí?',
        ],
      },
      bookshelf: {
        revealClass: 'bookshelf-open',
        winTarget: '.bookshelf-safe',
        revealLines: [
          'Un estante gira como en las películas. ¡Detrás hay una caja fuerte escondida!',
        ],
      },
      plant: {
        revealClass: 'plant-open',
        winTarget: '.plant-safe',
        revealLines: [
          'La maceta se inclina y la tierra se corre. ¡Hay una caja fuerte enterrada abajo!',
        ],
      },
    },

    winTitle: '¡LO ENCONTRASTE!',
    winText: 'Es solo un trofeo de coleccionista.\nLa prensa nunca se va a enterar.',
    loseTitle: '¡SE ACABÓ EL TIEMPO!',
    loseText: 'Tuviste que dar explicaciones a la prensa. PERDISTE.',
  };
})();
