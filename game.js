/* ====== Stellan Smash-like — HTML5 Canvas ======
 * Mécaniques : 1v1 local, mêmes moves pour 11 persos
 * Moves: block(parade), projectile(CD), punch, kick, uppercut (lance en l’air)
 * Map: sol + 2 plateformes. Barres de vie, victoire K.O. / hors-cadre.
 * Manettes: Gamepad API + clavier fallback.
 * Tournoi: simple élimination → demi-finales → finale (auto-bracket).
 *
 * SPRITES: voir TODO SPRITES plus bas.
 */

(() => {
  // ---------- Core constants ----------
  const W = 1280, H = 720;
  const G = 0.5;                // gravité
  const FRICTION = 0.8;         // friction au sol
  const MAX_FALL = 10;
  const GROUND_Y = H - 80;

  
  // Plateformes
  const PLATFORMS = [
    { x: W*0.25 - 150, y: GROUND_Y - 260, w: 300, h: 18 },
    { x: W*0.75 - 150, y: GROUND_Y - 260, w: 300, h: 18 },
  ];

  // Murs invisibles
const WALLS = [
  { x: 0, y: 0, w: 40, h: () => H },         // mur gauche
  { x: () => W - 40, y: 0, w: 40, h: () => H }  // mur droit
];

  // Combats
  const START_HP = 140;
  const MOVE_SPEED = 3.0;
  const JUMP_VY = -16;
  const DOUBLE_JUMP_VY = -16;
  const ATTACK_COOLDOWN = 220;  // ms general swing lock
  const PROJECTILE_CD = 850;    // ms anti-spam
  const BLOCK_REDUCTION = 0.75; // 75% dmg reduction
  const UPPERCUT_LAUNCH = -15;  // vertical launch
  const KNOCKBACK_BASE = 9;
  const ATTACK_ANIM_MS = 180;


// --- TAILLE 
const BASE_PLAYER_W = 92;
const BASE_PLAYER_H = 156;




// Zones capteurs de mur (à l'intérieur de l'écran)
const WALL_SENSOR_INSET = 10;       // largeur des zones capteurs dans l'écran
// distance "proximité mur" pour wall-jump / flip-reset
const WALL_NEAR_PX = 5;  // ajuste: 14–30 selon feeling


  // Hitbox (rectangles) distances
  const HB_PUNCH = { w: 60, h: 40, dx: 34, dy: -10, dmg: 11, kb: 8 };
  const HB_KICK  = { w: 120, h: 84, dx: 40, dy: 0,  dmg: 8, kb: 12 };
  const HB_UPPER = { w: 40, h: 40, dx: 24, dy: -28, dmg: 13, kb: 10, launch: UPPERCUT_LAUNCH };
  const DEBUG_HITBOX = true;
  // Projectile
  const PROJ = { w: 64, h: 64, speed: 6.5, dmg: 5, kb: 7 };

  // World bounds (si on sort -> chute/KO)
  const OUT_MARGIN = 260;

  // Game states
  const S = {
    MENU: "MENU",
    SELECT: "SELECT",
    HELP: "HELP",
    BATTLE: "BATTLE",
    TOURNAMENT_SETUP: "TOURNAMENT_SETUP",
    TOURNAMENT_SELECT: "TOURNAMENT_SELECT",
    TOURNAMENT_VIEW: "TOURNAMENT_VIEW",
  };

  // ---------- Elements ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Helper d'échelle neutre (pas de SCALE -> s(v) renvoie v tel quel)
if (typeof s !== 'function') {
  function s(v) { return v; }
}


  const $ = sel => document.querySelector(sel);
  const elMenu = $("#menu");
  const elSelect = document.getElementById("screen");

  const elHUD = $("#hud");
  const elHelp = $("#help");
  const elOverlay = $("#overlay");
  const elOverlayText = $("#overlay-text");

  const btnVersus = $("#btn-versus");
  const btnTournament = $("#btn-tournament");
  const btnHelp = $("#btn-help");
  const btnHelpBack = $("#btn-help-back");

  const charGrid = $("#char-grid");
  const p1PickEl = $("#p1-pick");
  const p2PickEl = $("#p2-pick");
  const btnEndSelection = $("#btn-start-match");
  const btnBackMenu = $("#btn-back-menu");

  const MAPS = [  "cabanon.png",
  "chambre_cuck.png",
  "cuisine.png",
  "salon.png",
  "toilette.png",
  "escalier.png",
  "daronne_ptf.png"
]; 

// ===== Elements écran map
const screenMap   = document.getElementById('screen-map');
const track       = document.getElementById('map-track');
const dots        = document.getElementById('map-dots');
const prev        = document.getElementById('map-prev');
const next        = document.getElementById('map-next');
const back        = document.getElementById('map-back');
const play        = document.getElementById('map-play');
const gameMapEl   = document.querySelector('.game-map'); 
document.getElementById('btn-back-menu').addEventListener('click', () => {
  // cache l’écran persos
  elSelect.classList.add('hidden');
  // montre ton menu principal
  document.getElementById('menu').classList.remove('hidden');
});

  const p1HPFill = $("#p1-hp");
  const p2HPFill = $("#p2-hp");
  const p1Name = $("#p1-name");
  const p2Name = $("#p2-name");

  const btnRematch = $("#btn-rematch");
  const btnSelectAgain = $("#btn-select-again");
  const btnMenu = $("#btn-menu");

  // Tournament elements
  const elTSetup = $("#tournament-setup");
  const elTSelect = $("#tournament-select");
  const elTBracket = $("#tournament-bracket");
  const inputTSize = $("#tournament-size");
  const btnTPlayers = $("#btn-tournament-players");
  const btnTBack = $("#btn-tournament-back");
  const tInstr = $("#tournament-instructions");
  const tGrid = $("#tournament-char-grid");
  const tPicked = $("#tournament-picked");
  const btnTStart = $("#btn-tournament-start");
  const tBracketDiv = $("#bracket");
  const btnTExit = $("#btn-tournament-exit");
  const roundStatus = $("#round-status");

// CARROUSSEL MAP
  // ===== Vars =====
let currentSlide = 0;

function buildCarousel() {
  track.innerHTML = ''; dots.innerHTML = '';
  MAPS.forEach((name, i) => {
    const slide = document.createElement('div');
    slide.className = 'map-slide';
    slide.innerHTML = `
      <img src="assets/map/${name}" alt="${name}">
      <div class="map-caption">${name.replace(/\.[a-z0-9]+$/i,'').replace(/[-_]/g,' ')}</div>
    `;
    slide.addEventListener('click', () => snapTo(i));
    track.appendChild(slide);

    const d = document.createElement('div');
    d.className = 'map-dot';
    d.addEventListener('click', () => snapTo(i));
    dots.appendChild(d);
  });
  markActive(0);
}

function markActive(i) {
  currentSlide = i;
  [...track.children].forEach(s => s.classList.remove('is-active'));
  [...dots.children].forEach(d => d.classList.remove('is-active'));
  track.children[i]?.classList.add('is-active');
  dots.children[i]?.classList.add('is-active');
}

function snapTo(i, smooth = true) {
  const el = track.children[i];
  if (!el) return;
  el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  markActive(i);
}

function onScrollActive() {
  const rect = track.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  let best = 0, dist = Infinity;
  [...track.children].forEach((s, i) => {
    const r = s.getBoundingClientRect();
    const sc = r.left + r.width / 2;
    const d = Math.abs(cx - sc);
    if (d < dist) { dist = d; best = i; }
  });
  if (best !== currentSlide) markActive(best);
}

// flèches + scroll
prev.addEventListener('click', () => snapTo(Math.max(0, currentSlide - 1)));
next.addEventListener('click', () => snapTo(Math.min(MAPS.length - 1, currentSlide + 1)));
track.addEventListener('scroll', () => {
  if (track._t) cancelAnimationFrame(track._t);
  track._t = requestAnimationFrame(onScrollActive);
}, { passive: true });




  // ---------- Character roster (11 placeholders) ----------
const ROSTER = [
  
  {
    id: 1,
    name: "👃💵PTF💵👃",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
        idle: "assets/ptf/face_ptf.png",
        run: "assets/ptf/cours_ptf.png",
        jump: "assets/ptf/saut_ptf.png",
        attack: "assets/ptf/coup_poing_ptf.png",
        kick: "assets/ptf/coup_pied_ptf.png",
        upper: "assets/ptf/uppercut_ptf.png",
        block: "assets/ptf/parade_ptf.png",
        projectile: "assets/ptf/projectile_ptf.png"
        
       },
    },

      {
    id: 2,
    name: "💩DRAKS💩",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/draks/face_draks.png",
         run: "assets/draks/cours_draks.png",
         jump: "assets/draks/saut_draks.png",
         attack: "assets/draks/coup_droit_draks.png",
         block: "assets/draks/parade_draks.png",
         projectile: "assets/draks/projectile_draks.png",
         upper : "assets/draks/uppercut_draks.png",
         kick:  "assets/draks/coup_pied_draks.png",
         
       },
    
    },
  {
    id: 3,
    name: "🏳️‍🌈~ROBIN~🏳️‍🌈",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/robin/face_robin.png",
         run: "assets/robin/cours_robin.png",
         jump: "assets/robin/saut_robin.png",
         attack: "assets/robin/coup_droit_robin.png",
         block: "assets/robin/parade_robin.png",
         projectile: "assets/robin/projectile_robin.png",
         upper : "assets/robin/uppercut_robin.png",
         kick:  "assets/robin/coup_pied_robin.png",
         
       },
    
    },

      {
    id: 4,
    name: "🍔PLAGS🍔",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/thomas/face_plags.png",
         run: "assets/thomas/cours_plags.png",
         jump: "assets/thomas/saut_plags.png",
         attack: "assets/thomas/coup_droit_plags.png",
         block: "assets/thomas/parade_plags.png",
         projectile: "assets/thomas/projectile_plags.png",
         upper : "assets/thomas/uppercut_plags.png",
         kick:  "assets/thomas/coup_pied_plags.png",
         
       },
    
    },
  {
    id: 5,
    name: "🐵 BEN 🐒",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/ben/face_ben.png",
         run: "assets/ben/cours_ben.png",
         jump: "assets/ben/saut_ben.png",
         attack: "assets/ben/coup_droit_ben.png",
         block: "assets/ben/parade_ben.png",
         projectile: "assets/ben/projectile_ben.png",
         upper : "assets/ben/uppercut_ben.png",
         kick:  "assets/ben/coup_pied_ben.png",
         
       },
    
    },
      {
    id: 6,
    name: "😡 DENIS 😡",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/denis/face_denis.png",
         run: "assets/denis/cours_denis.png",
         jump: "assets/denis/saut_denis.png",
         attack: "assets/denis/coup_droit_denis.png",
         block: "assets/denis/parade_denis.png",
         projectile: "assets/denis/projectile_denis.png",
         upper : "assets/denis/uppercut_denis.png",
         kick:  "assets/denis/coup_pied_denis.png",
         
       },
    
    },
      {
    id: 7,
    name: "🗡️HOZAFID SI IL JOUE PAS GAREN",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/martin/face_martin.png",
         run: "assets/martin/cours_martin.png",
         jump: "assets/martin/saut_martin.png",
         attack: "assets/martin/coup_droit_martin.png",
         block: "assets/martin/parade_martin.png",
         projectile: "assets/martin/projectile_martin.png",
         upper : "assets/martin/uppercut_martin.png",
         kick:  "assets/martin/coup_pied_martin.png",
         
       },
    
    },
      {
    id: 8,
    name: "🎬 Triple J (GOLDOOOOR )🎬",
    //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    sprites: {
         idle: "assets/tripleJ/face_triplej.png",
         run: "assets/tripleJ/cours_triplej.png",
         jump: "assets/tripleJ/saut_triplej.png",
         attack: "assets/tripleJ/coup_droit_triplej.png",
         block: "assets/tripleJ/parade_triplej.png",
         projectile: "assets/tripleJ/projectile_triplej.png",
         upper : "assets/tripleJ/uppercut_triplej.png",
         kick:  "assets/tripleJ/coup_pied_triplej.png",
         
       },
    
    },
    //   {
    // id:9,
    // name: "Piggy 🐖",
    // //color: "#f50e0eff", // couleur fallback si sprite ne charge pas
    // sprites: {
    //      idle: "assets/martin/face_martin.png",
    //      run: "assets/martin/cours_martin.png",
    //      jump: "assets/martin/saut_martin.png",
    //      attack: "assets/martin/coup_droit_martin.png",
    //      block: "assets/martin/parade_martin.png",
    //      projectile: "assets/martin/projectile_martin.png",
    //      upper : "assets/martin/uppercut_martin.png",
    //      kick:  "assets/martin/coup_pied_martin.png",
         
    //    },
    
    // },
    
    

    

//   // les autres personnages restent placeholders
//   ...Array.from({ length: 10 }).map((_, i) => ({
//     id: i + 2,
//     name: `Personnage ${i + 2}`,
//     color: `hsl(${((i+1)*33)%360}, 70%, 60%)`,
//   }))
 ];

  // ---------- Input mapping ----------
  const Keys = {
    // Player1
    A: 'KeyA', D: 'KeyD', W: 'KeyW', S: 'KeyS',
    J: 'KeyJ', K: 'KeyK', L: 'KeyL', U: 'KeyU', I: 'KeyI',
    // Player2
    LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown',
    NUM1: 'Numpad1', NUM2: 'Numpad2', NUM3: 'Numpad3', NUM0: 'Numpad0', NUM5: 'Numpad5'
  };
  const keyDown = new Set();
  window.addEventListener('keydown', (e)=> keyDown.add(e.code));
  window.addEventListener('keyup', (e)=> keyDown.delete(e.code));

  // Gamepad
  const gamepads = {};
  window.addEventListener('gamepadconnected', (e) => gamepads[e.gamepad.index] = e.gamepad);
  window.addEventListener('gamepaddisconnected', (e) => delete gamepads[e.gamepad.index]);

  // --- Cache d'images simple pour éviter de recréer des Image() chaque frame
const _imgCache = new Map();
function getCachedImage(src) {
  if (!src) return null;
  if (_imgCache.has(src)) return _imgCache.get(src);
  const im = new Image();
  im.src = src;
  _imgCache.set(src, im);
  return im;
}

// === FOND DE MAP (option A : dessiné dans le canvas) ===
let _mapBgImg = null;
let _mapBgReady = false;

// function setMapBackground(src) {
//   _mapBgReady = false;
//   _mapBgImg = new Image();
//   _mapBgImg.onload  = () => { _mapBgReady = true; };
//   _mapBgImg.onerror = (e) => console.warn("Map BG failed:", src, e);
//   _mapBgImg.src = src;
// }

function isReady(im) {
  return im && im.complete && im.naturalWidth > 0 && im.naturalHeight > 0;
}


  function readGamepad(index) {
    const gp = navigator.getGamepads?.()[index];
    if (!gp) return null;
    const axes = gp.axes || [];
    const b = (i)=> !!(gp.buttons?.[i]?.pressed);
    const dpadLeft = b(14), dpadRight = b(15), dpadUp = b(12), dpadDown = b(13);
    const ax = Math.abs(axes[0]||0) > 0.2 ? axes[0] : 0;
    const ay = Math.abs(axes[1]||0) > 0.2 ? axes[1] : 0;
    return {
      left: dpadLeft || ax < -0.3,
      right: dpadRight || ax > 0.3,
      up: dpadUp || ay < -0.5,
      down: dpadDown || ay > 0.5,
      jump: b(0),        // A / Cross
      punch: b(2),       // X / Square
      kick: b(1),        // B / Circle
      upper: b(3),       // Y / Triangle
      block: b(4),       // LB
      projectile: b(5),  // RB
    };
  }


  // ---------- Utility ----------
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a,b)=> (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

  // ---------- Entities ----------
  class Player {
    constructor(slot, charDef, x, y) {
      this.slot = slot; // 1 or 2
      this.char = charDef;
      this.x = x; this.y = y;
      this.w = 46; this.h = 78; //Hitbox largeur hauteur
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.canDouble = true;
      this.facing = slot===1 ? 1 : -1; // 1:right, -1:left
      this.hp = START_HP;
      this.alive = true;

            // facteurs (par défaut, la hitbox suit le visuel)
      const visScale = (charDef.visualScale ?? 1);          // grossit juste l'image
      const hitScale = (charDef.hitboxScale ?? visScale);   // grossit la collision

      this.w = Math.round(BASE_PLAYER_W * hitScale);
      this.h = Math.round(BASE_PLAYER_H * hitScale);


      //Wall
      this.lastWallTouchT = -9999; // dernier contact "proche mur"
      this.wallDir = 0;            // -1 = mur gauche, 1 = mur droit, 0 = aucun
      this.lastFlipResetT = -9999;  // anti-multi reset
      
      // states
      this.blocking = false;
      this.lastAttackT = -9999;
      this.lastProjT = -9999;

      // TEMP hit flash
      this.hitTimer = 0;
    }
    

    get hurtbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

    applyDamage(amount, kbX, kbY) {
      if (this.blocking) {
        return;
      };
      this.hp = clamp(this.hp - amount, 0, START_HP);
      this.hitTimer = 100;
      // knockback
      this.vx += kbX;
      this.vy += kbY ?? 0;
      if (this.hp <= 0) this.alive = false;
    }

    tryAttack(type, inputs, t) {
      if (t - this.lastAttackT < ATTACK_COOLDOWN) return null;
      this.lastAttackT = t;
      this.lastAttackTime  = t;      // compat si ailleurs tu lis lastAttackTime
    this.lastAttackType  = type;   // 'kick' | 'upper' | 'punch'
  
      if (type === 'punch')  return this.makeHitbox(HB_PUNCH);
      if (type === 'kick')   return this.makeHitbox(HB_KICK);
      if (type === 'upper')  return this.makeHitbox(HB_UPPER);
      return null;
    }

    makeHitbox(spec) {
      const dir = this.facing;
      return {
        owner: this,
        x: this.x + (dir > 0 ? spec.dx : (this.w - spec.dx - spec.w)),
        y: this.y + this.h + spec.dy - spec.h,
        w: spec.w, h: spec.h,
        dmg: spec.dmg,
        kb: spec.kb,
        launch: spec.launch ?? 0,
        ttl: 90 // ms
      };
    }

//    tryProjectile(t) {
//   if (t - this.lastProjT < PROJECTILE_CD) return null;
//   this.lastProjT = t;

//   const dir = this.facing || 1;
//   const spawnOffsetX = dir > 0 ? this.w : -PROJ.w; // spawn devant le joueur
//   const spawnY = this.y + this.h * 0.55;

//   return {
//     owner: this,
//     x: this.x + spawnOffsetX,
//     y: spawnY,
//     w: PROJ.w,
//     h: PROJ.h,
//     vx: dir * PROJ.speed,
//     vy: 0,
//     dmg: PROJ.dmg,
//     kb: PROJ.kb,
//     ttl: 2000 // ms
//   };
// }
 
tryProjectile(t) {
  if (t - this.lastProjT < PROJECTILE_CD) return null;
  this.lastProjT = t;

  const dir = this.facing || 1;

  // Taille du projectile
  const projW = PROJ.w;
  const projH = PROJ.h;
  const projR = Math.max(projW, projH) / 2;  // rayon hitbox centré

  // Position de spawn (centre)
  const spawnX = this.x + (dir > 0 ? this.w : 0) + dir * projW/2;
  const spawnY = this.y + this.h * 0.55; // centre vertical du projectile

  return {
    owner: this,
    x: spawnX,   // 👉 centre X
    y: spawnY,   // 👉 centre Y
    w: projW,
    h: projH,
    r: projR,    // 👉 pour collisions + debug hitbox
    vx: dir * PROJ.speed,
    vy: 0,
    dmg: PROJ.dmg,
    kb: PROJ.kb,
    ttl: 2000 // ms
  };
}




updatePhysics() {
  const nowT = performance.now();

  // 1) Gravité
  this.vy += G;
  if (this.vy > MAX_FALL) this.vy = MAX_FALL;

  // 2) Intégration
  this.x += this.vx;
  this.y += this.vy;

  // 3) Sol
  if (this.y + this.h >= GROUND_Y) {
    this.y = GROUND_Y - this.h;
    this.vy = 0;
    this.onGround = true;
    this.canDouble = true;
  } else {
    this.onGround = false;
  }

  // 4) Plateformes — même logique que le sol
  for (const p of PLATFORMS) {
    if (
      this.x + this.w > p.x &&
      this.x < p.x + p.w &&
      this.y + this.h >= p.y &&
      this.y + this.h <= p.y + p.h
    ) {
      this.y = p.y - this.h;
      this.vy = 0;
      this.onGround = true;
      this.canDouble = true;
      break; // on s'arrête à la première plateforme touchée
    }
  }

  // --- Capteurs mur (zones imaginaires à l'intérieur de l'écran)
const leftZone  = { x: 0, y: 0, w: WALL_SENSOR_INSET, h: H };
const rightZone = { x: W - WALL_SENSOR_INSET, y: 0, w: WALL_SENSOR_INSET, h: H };
const hb = { x: this.x, y: this.y, w: this.w, h: this.h };
const overlap = (a,b)=> (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

const touchingLeft  = overlap(hb, leftZone);
const touchingRight = overlap(hb, rightZone);
const touchingWall  = touchingLeft || touchingRight;

// --- Flip-reset ONE-PRESS (priorité avant le double saut)
if (this.jumpQueued) {
  // 1) si au sol -> saut normal
  if (this.onGround) {
    this.vy = JUMP_VY;
    this.onGround = false;
    // canDouble reste true (on vient de quitter le sol)
  }
  // 2) sinon, si en l'air, double saut déjà consommé, et collé au mur -> reset + saut immédiat
  else if (!this.canDouble && touchingWall && (nowT - (this.lastFlipResetT||-9999) > FLIP_RESET_COOLDOWN)) {
    this.canDouble = true;           // reset comme si tu avais touché le sol
    this.vy = JUMP_VY;               // et on saute tout de suite
    this.onGround = false;
    this.lastFlipResetT = nowT;
  }
  // 3) sinon, si double saut dispo -> double saut
  else if (this.canDouble) {
    this.vy = DOUBLE_JUMP_VY;
    this.canDouble = false;
  }

  this.jumpQueued = false; // on consomme l'intention de saut dans tous les cas
}

// (optionnel) petit wall-slide pour faciliter le timing
if (!this.onGround && touchingWall && this.vy > 3) {
  this.vy = 3;
}


  // 5) Détection proximité murs (pour wall-jump/window)
  const nearLeft  = (this.x <= WALL_NEAR_PX);
  const nearRight = (this.x + this.w >= W - WALL_NEAR_PX);

  if (nearLeft || nearRight) {
    this.lastWallTouchT = nowT;
    this.wallDir = nearLeft ? -1 : 1;   // -1: mur gauche, 1: mur droit
  } else if (this.onGround) {
    // on ne reset que posé au sol, pour garder une petite tolérance en l'air
    this.wallDir = 0;
  }

  // 6) Wall slide doux (facilite le timing)
  // if (!this.onGround && (nearLeft || nearRight) && this.vy > 3) {
  //   this.vy = 3;
  // }

// 1) gravité -> 2) intégration -> 3) sol -> 4) plateformes (set onGround/canDouble)
// ... (détection murs/slide si tu veux)

if (this.jumpQueued) {
  if (this.onGround) {
    // saut normal
    this.vy = JUMP_VY;
    this.onGround = false;
    // canDouble reste true quand on quitte le sol
  } else if (this.canDouble) {
    // double saut
    this.vy = DOUBLE_JUMP_VY;
    this.canDouble = false;
  }
  this.jumpQueued = false;
}

// 5) murs invisibles -> 6) friction -> timers






  // 8) Murs invisibles gauche/droite (empêche de sortir)
  if (this.x < 0) {
    this.x = 0;
    if (this.vx < 0) this.vx = 0;
  }
  if (this.x + this.w > W) {
    this.x = W - this.w;
    if (this.vx > 0) this.vx = 0;
  }

  // (⚠️ ne remets pas un clamp global type: this.x = clamp(this.x, -OUT_MARGIN, W+...);
  //  ça casserait la proximité mur et la fenêtre de wall-jump)

  // 9) Friction au sol
  if (this.onGround && Math.abs(this.vx) > 0.01) this.vx *= FRICTION;

  // 10) Timers
  if (this.hitTimer > 0) this.hitTimer -= dtMs;
}


  
  }


  class Projectile {
  constructor(x, y, vx, vy, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.w = 16;   // largeur sprite projectile
    this.h = 16;   // hauteur sprite projectile
    this.alive = true;
    this.bouncesLeft = 1;   // ✅ autorisé à rebondir 1 fois
  }
}

  // ---------- Match / world ----------
  let state = S.MENU;
  let p1, p2, projectiles = [], hitboxes = [];
  let lastT = performance.now(), dtMs = 16;
  let winner = null;
  let p1Char = null, p2Char = null;

  // Tournament data
  let tSize = 8;
  let tPicks = []; // array of chosen char ids
  let tIndexToPick = 0;
  let bracket = []; // rounds: [ [match], [semis], [final] ]
  let currentRound = 0;
  let currentMatchIndex = 0;

  // ---------- Screens helpers ----------
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) {
  if (el) el.classList.add('hidden');
}

function enterBattleUI() {
  document.getElementById('game')?.classList.remove('hidden');
  document.getElementById('game')?.classList.add('is-playing');
  // ❗ On montre la .game-map (puisqu’on l’utilise pour le fond)
  document.querySelector('.game-map')?.classList.remove('hidden');
}

function leaveBattleUI() {
  const cv = document.getElementById('game');
  cv?.classList.remove('is-playing');
  // si tu veux re-cacher le canvas en quittant le match, décommente :
  // cv?.classList.add('hidden');
}

  function goMenu() {
    hide(elSelect); hide(elHUD); hide(elHelp); hide(elOverlay);
    hide(elTSetup); hide(elTSelect); hide(elTBracket);
    show(elMenu); hide(canvas);
    state = S.MENU;
  }

  function goHelp() {
    hide(elMenu); show(elHelp);
    state = S.HELP;
  }

  // Build character grid
function buildCharGrid(host, clickHandler) {
  if (!host) {                 // ✅ garde-fou
    console.warn('buildCharGrid: host manquant');
    return;
  }
  host.innerHTML = '';
  ROSTER.forEach(char => {
    const d = document.createElement('div');
    d.className = 'char';
    d.dataset.id = char.id;

    const thumbUrl = char.sprites?.idle || null;
    d.innerHTML = `
      <div class="thumb" style="${thumbUrl ? `background-image:url('${thumbUrl}')` : `background:${char.color}`}"></div>
      <div class="label">${char.name}</div>
    `;
    d.addEventListener('click', ()=> clickHandler(char, d));
    host.appendChild(d);
  });
}


  // 1v1 select logic
  let awaitingPick = 1;
  function goSelect() {
    awaitingPick = 1; p1Char = null; p2Char = null;
    p1PickEl.textContent = '—'; p2PickEl.textContent = '—';
    btnEndSelection.disabled = true;
    buildCharGrid(charGrid, (char, el) => {
      if (awaitingPick === 1) {
        p1Char = char; p1PickEl.textContent = char.name;
        charGrid.querySelectorAll('.char').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        awaitingPick = 2;
      } else if (awaitingPick === 2) {
        p2Char = char; p2PickEl.textContent = char.name;
        btnEndSelection.disabled = false;
      }
    });

    hide(elMenu); hide(elHelp); show(elSelect);
    state = S.SELECT;
  }

  // Tournament setup
  function goTournamentSetup() {
    tSize = parseInt(inputTSize.value, 10) || 8;
    tSize = clamp(tSize, 2, 16);
    inputTSize.value = tSize;
    tPicks = []; tIndexToPick = 0;
    hide(elMenu); hide(elSelect); show(elTSetup);
    state = S.TOURNAMENT_SETUP;
  }

  function goTournamentSelect() {
    tPicks = [];
    tIndexToPick = 0;
    tPicked.innerHTML = '';
    btnTStart.disabled = true;
    tInstr.textContent = `Joueur 1, choisis ton personnage`;
    buildCharGrid(tGrid, (char, el) => {
      tPicks.push(char.id);
      const li = document.createElement('li');
      li.textContent = `${char.name}`;
      tPicked.appendChild(li);
      tIndexToPick++;
      if (tIndexToPick >= tSize) {
        btnTStart.disabled = false;
        tInstr.textContent = `Tous les joueurs sont inscrits.`;
      } else {
        tInstr.textContent = `Joueur ${tIndexToPick+1}, choisis ton personnage`;
      }
    });
    hide(elTSetup); show(elTSelect);
    state = S.TOURNAMENT_SELECT;
  }

  function powerOfTwoCeil(n) {
    let p = 1; while (p < n) p <<= 1; return p;
  }

  function buildBracket(players) {
    // players = array of char ids (length tSize)
    // Fill to next power of two with byes (null)
    const target = powerOfTwoCeil(players.length);
    const padded = players.slice();
    while (padded.length < target) padded.push(null);

    // shuffle lightly so brackets differ
    for (let i = padded.length - 1; i > 0; i--) {
      const j = (Math.random() * (i+1))|0;
      [padded[i], padded[j]] = [padded[j], padded[i]];
    }

    // Round 0
    let round = [];
    for (let i=0; i<padded.length; i+=2) {
      round.push([ padded[i], padded[i+1] ]);
    }
    const rounds = [round];

    // Subsequent rounds built empty; winners pushed later
    let size = round.length;
    while (size > 1) {
      size = (size/2)|0;
      rounds.push(Array.from({length:size}).map(()=>[null,null]));
    }
    return rounds;
  }

  function renderBracket() {
    tBracketDiv.innerHTML = '';
    bracket.forEach((round, rIndex) => {
      const rd = document.createElement('div');
      rd.className = 'round';
      rd.innerHTML = `<div><strong>Round ${rIndex+1}${rIndex===bracket.length-1?' (Finale)':''}</strong></div>`;
      round.forEach((m, i) => {
        const [a,b] = m;
        const div = document.createElement('div'); div.className = 'match';
        const an = a==null?'(bye)': (typeof a==='number'? ROSTER.find(c=>c.id===a)?.name : a);
        const bn = b==null?'(bye)': (typeof b==='number'? ROSTER.find(c=>c.id===b)?.name : b);
        div.innerHTML = `<span>${an}</span><span class="vs">vs</span><span>${bn}</span>`;
        rd.appendChild(div);
      });
      tBracketDiv.appendChild(rd);
    });
  }

  function goTournamentView() {
    bracket = buildBracket(tPicks);
    currentRound = 0; currentMatchIndex = 0;
    renderBracket();
    roundStatus.textContent = `Round 1 — Match 1`;
    hide(elTSelect); show(elTBracket);
    state = S.TOURNAMENT_VIEW;

    // Sauter les matches avec bye automatiquement
    setTimeout(() => advanceTournamentIfByes(), 60);
  }

  function advanceTournamentIfByes() {
    while (state === S.TOURNAMENT_VIEW) {
      const round = bracket[currentRound];
      if (!round) break;
      const match = round[currentMatchIndex];
      if (!match) break;
      const [a, b] = match;
      if (a==null && b==null) {
        setWinnerForCurrentMatch(null); // personne
      } else if (a==null) {
        setWinnerForCurrentMatch(b);
      } else if (b==null) {
        setWinnerForCurrentMatch(a);
      } else {
        // lancer un match normal
        const charA = ROSTER.find(c=>c.id===a);
        const charB = ROSTER.find(c=>c.id===b);
        startBattle(charA, charB, /*tournamentMode*/true);
        break;
      }
    }
  }

  function setWinnerForCurrentMatch(winnerCharIdOrName) {
    const round = bracket[currentRound];
    const match = round[currentMatchIndex];
    const nextRound = bracket[currentRound+1];

    if (!nextRound) {
      // Finale terminée
      roundStatus.textContent = `Tournoi terminé — Vainqueur: ${
        winnerCharIdOrName==null? '(bye)': (typeof winnerCharIdOrName==='number'? ROSTER.find(c=>c.id===winnerCharIdOrName)?.name : winnerCharIdOrName)
      }`;
      return;
    }

    // Déterminer la "case" du prochain round
    const slot = (currentMatchIndex/2)|0;
    if (!nextRound[slot]) nextRound[slot] = [null,null];
    const seat = (currentMatchIndex%2===0)? 0 : 1;
    nextRound[slot][seat] = winnerCharIdOrName;

    // Avancer l’index
    currentMatchIndex++;
    if (currentMatchIndex >= round.length) {
      currentRound++;
      currentMatchIndex = 0;
    }
    renderBracket();
    roundStatus.textContent = `Round ${currentRound+1} — Match ${currentMatchIndex+1}`;
  }

  // ---------- Match flow ----------
  function startBattle(charA, charB, tournamentMode=false) {
    hide(elMenu); hide(elSelect); hide(elHelp); hide(elTSetup); hide(elTSelect); hide(elTBracket);
    show(elHUD); show(canvas);
    hide(elOverlay);

    winner = null;
    projectiles = []; hitboxes = [];

    p1 = new Player(1, charA, W*0.25, GROUND_Y-78);
    p2 = new Player(2, charB, W*0.75-46, GROUND_Y-78);
    p1Name.textContent = charA.name;
    p2Name.textContent = charB.name;
    p1HPFill.style.transform = `scaleX(1)`;
    p2HPFill.style.transform = `scaleX(1)`;

    state = S.BATTLE;
    isTournamentMatch = tournamentMode;
  }

  let isTournamentMatch = false;

  // ---------- Controls per player ----------
  function readInputsForPlayer(slot) {
    // Keyboard
    if (slot === 1) {
      return {
        left:  keyDown.has(Keys.A),
        right: keyDown.has(Keys.D),
        down:  keyDown.has(Keys.S),
        jump:  keyDown.has(Keys.W),
        punch: keyDown.has(Keys.J),
        kick:  keyDown.has(Keys.K),
        upper: keyDown.has(Keys.L),
        block: keyDown.has(Keys.U),
        projectile: keyDown.has(Keys.I)
      };
    } else {
      return {
        left:  keyDown.has(Keys.LEFT),
        right: keyDown.has(Keys.RIGHT),
        down:  keyDown.has(Keys.DOWN),
        jump:  keyDown.has(Keys.UP),
        punch: keyDown.has(Keys.NUM1),
        kick:  keyDown.has(Keys.NUM2),
        upper: keyDown.has(Keys.NUM3),
        block: keyDown.has(Keys.NUM0),
        projectile: keyDown.has(Keys.NUM5)
      };
    }
  }

  // prefer controller if present
  function mergeWithGamepad(inputs, gp) {
    if (!gp) return inputs;
    return {
      left: gp.left || inputs.left,
      right: gp.right || inputs.right,
      down: gp.down || inputs.down,
      jump: gp.jump || inputs.jump,
      punch: gp.punch || inputs.punch,
      kick: gp.kick || inputs.kick,
      upper: gp.upper || inputs.upper,
      block: gp.block || inputs.block,
      projectile: gp.projectile || inputs.projectile
    };
  }

const FLIP_RESET_COOLDOWN = 1000;
const RESET_SENSOR_PX     = 20;
const RESET_LOOKAHEAD_PX  = 28;

function nearWallForReset(p) {
  const distL = p.x;
  const distR = W - (p.x + p.w);
  const towardL = p.vx < -0.1;
  const towardR = p.vx >  0.1;
  const look = Math.max(RESET_LOOKAHEAD_PX, Math.min(60, Math.abs(p.vx) * 6));
  const nearNow  = (distL <= RESET_SENSOR_PX) || (distR <= RESET_SENSOR_PX);
  const nearSoon = (towardL && distL <= RESET_SENSOR_PX + look) || (towardR && distR <= RESET_SENSOR_PX + look);
  return nearNow || nearSoon;
}

// mémorise les états de touches/boutons par joueur
const _pressLatch = {};

// Détecte si une touche est "juste pressée" ce frame
function justPressed(isDown, key) {
  if (!_pressLatch[key]) _pressLatch[key] = false;

  let jp = false;
  if (isDown && !_pressLatch[key]) {
    jp = true;              // transition: up -> down
  }

  _pressLatch[key] = isDown;
  return jp;
}



  // ---------- Update ----------
function update(dt) {
  // Ne rien faire si pas en combat ou joueurs absents
  if (state !== S.BATTLE || !p1 || !p2) return;

  // Inputs
  let in1 = readInputsForPlayer(1);
  let in2 = readInputsForPlayer(2);
  const gp1 = readGamepad(0);
  const gp2 = readGamepad(1);
  in1 = mergeWithGamepad(in1, gp1);
  in2 = mergeWithGamepad(in2, gp2);

  // --- justPressed helper requis une seule fois dans le fichier ---
  // const _pressLatch = {};
  // function justPressed(isDown, key){ if(!_pressLatch[key]) _pressLatch[key]=false; const jp=!!isDown&&!_pressLatch[key]; _pressLatch[key]=!!isDown; return jp; }

  // Queue du saut (✅ simple : on ne fait que poser jumpQueued ici)
  const jp1 = justPressed(!!in1.jump, 'p1_jump');
  if (jp1) p1.jumpQueued = true;

  const jp2 = justPressed(!!in2.jump, 'p2_jump');
  if (jp2) p2.jumpQueued = true;

  // Déplacement horizontal (même logique qu’avant)
  const ACCEL_GROUND = 0.6, ACCEL_AIR = 0.35, FRICTION_G = 0.82, FRICTION_A = 0.98;
  function horizontalDir(inp){ const kd=(inp.right?1:0)-(inp.left?1:0); return kd!==0?kd:0; }
  function move(pl, inp){
    const dir = horizontalDir(inp);
    const target = dir * MOVE_SPEED;
    const accel = pl.onGround ? ACCEL_GROUND : ACCEL_AIR;
    if (dir !== 0) pl.facing = dir;
    pl.vx += (target - pl.vx) * accel;
    if (dir === 0){
      pl.vx *= pl.onGround ? FRICTION_G : FRICTION_A;
      if (Math.abs(pl.vx) < 0.05) pl.vx = 0;
    }
  }

  move(p1, in1);
  move(p2, in2);

  // Parade
  p1.blocking = !!in1.block;
  p2.blocking = !!in2.block;

  // Attaques / projos
  
  const t = performance.now();
  if (in1.block == false){
  if (in1.punch) queueHit(p1.tryAttack('punch', in1, t));
  if (in1.kick)  queueHit(p1.tryAttack('kick',  in1, t));
  if (in1.upper) queueHit(p1.tryAttack('upper', in1, t));
  if (in1.projectile) { const pr = p1.tryProjectile(t); if (pr) projectiles.push(pr); }

  if (in2.punch) queueHit(p2.tryAttack('punch', in2, t));
  if (in2.kick)  queueHit(p2.tryAttack('kick',  in2, t));
  if (in2.upper) queueHit(p2.tryAttack('upper', in2, t));
  if (in2.projectile) { const pr = p2.tryProjectile(t); if (pr) projectiles.push(pr); }
  };
  // Physique (gère saut normal / flip-reset one-press / double saut)
  p1.updatePhysics();
  p2.updatePhysics();

  // Orientation fallback
  if (Math.abs(p1.vx) > 0.2) p1.facing = Math.sign(p1.vx);
  if (Math.abs(p2.vx) > 0.2) p2.facing = Math.sign(p2.vx);

  // Collisions / Projos / HUD / KO
  resolveHits();
  updateProjectiles(dt);

  p1HPFill.style.transform = `scaleX(${clamp(p1.hp/START_HP, 0, 1)})`;
  p2HPFill.style.transform = `scaleX(${clamp(p2.hp/START_HP, 0, 1)})`;

  const out1 = (p1.y > H + OUT_MARGIN);
  const out2 = (p2.y > H + OUT_MARGIN);
  if (!p1.alive || out1) endRound(2);
  else if (!p2.alive || out2) endRound(1);
}



  // Orienter en fonction de l


  // Handle single-press jump semantics
  const jumpLatch = { p1:false, p2:false };
  function handleJump(p, inp) {
   const id = (p.slot === 1 ? 'p1' : 'p2');
  const pressed = !!inp.jump;

  if (pressed && !jumpLatch[id]) {
    if (p.onGround) {
      // Premier saut
      p.vy = JUMP_VY;
      p.onGround = false;
    } else if (p.canDouble) {
      // ✅ Double saut
      p.vy = DOUBLE_JUMP_VY;
      p.canDouble = false;
    }
    jumpLatch[id] = true;
  } else if (!pressed) {
    jumpLatch[id] = false;
  }
  }

  function queueHit(hb) { if (hb) hitboxes.push(hb); }

  function resolveHits() {
    const targets = [p1, p2];
    for (let i = hitboxes.length - 1; i >= 0; i--) {
      const hb = hitboxes[i];
      hb.ttl -= dtMs;
      if (hb.ttl <= 0) { hitboxes.splice(i,1); continue; }

      for (const t of targets) {
        if (t === hb.owner) continue;
        if (rectsOverlap({x:hb.x, y:hb.y, w:hb.w, h:hb.h}, t.hurtbox)) {
          const dir = Math.sign(hb.owner.facing) || 1;
          const kbX = dir * (KNOCKBACK_BASE + hb.kb * (1 + (1 - t.hp/START_HP)));
          const kbY = hb.launch ?? -3;
          t.applyDamage(hb.dmg, kbX, kbY);
          hitboxes.splice(i,1);
          break;
        }
      }
    }
  }

 function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.ttl -= dt;
    if (p.ttl <= 0) { projectiles.splice(i,1); continue; }

    // déplacement (x,y sont le CENTRE)
    p.x += p.vx;
    p.y += p.vy;

    // ==== collisions avec joueurs (pas le tireur) ====
    const targets = [p1, p2];
    for (const t of targets) {
      if (t === p.owner) continue;

      let hit = false;

      if (p.r) {
        // cercle (proj) vs AABB (joueur)
        const cx = p.x, cy = p.y, r = p.r;
        const rx = t.x, ry = t.y, rw = t.w, rh = t.h;
        // clamp centre sur le rectangle
        const qx = Math.max(rx, Math.min(cx, rx + rw));
        const qy = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - qx, dy = cy - qy;
        hit = (dx*dx + dy*dy) <= r*r;
      } else {
        // AABB (proj, centré) vs AABB (joueur)
        const pw = p.w || 12, ph = p.h || 12;
        const px = p.x - pw/2, py = p.y - ph/2; // top-left réel
        hit = (px < t.x + t.w && px + pw > t.x && py < t.y + t.h && py + ph > t.y);
      }

      if (hit) {
        const dir = Math.sign(p.vx) || 1;
        t.applyDamage(p.dmg, dir*(9 + p.kb), -4);
        projectiles.splice(i,1);
        break;
      }
    }

    // ==== sortie écran (avec x,y centrés) ====
    const pw = p.w || (p.r ? p.r*2 : 12);
    const ph = p.h || (p.r ? p.r*2 : 12);
    const px = p.x - pw/2, py = p.y - ph/2;
    if (px + pw < 0 || px > W || py + ph < 0 || py > H) {
      projectiles.splice(i,1);
    }
  }
}



  function endRound(who) {
    if (winner) return;
    winner = who; // 1 or 2
    show(elOverlay);
    elOverlayText.textContent = `Victoire Joueur ${who}`;

    if (isTournamentMatch) {
      // Map le vainqueur au char choisi
      const charWinner = (who===1) ? p1.char.id : p2.char.id;
      setWinnerForCurrentMatch(charWinner);
    }
  }
  

  // ---------- Render ----------
  function draw() {
  // Nettoie la frame
  ctx.clearRect(0, 0, W, H);
  // Reset du contexte (au cas où un rendu précédent a changé l'état)
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.lineWidth = 1;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';

 

  // =====================
  // 2) SOL
  // =====================
  ctx.fillStyle = '#2d2f3b';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#212432';
  ctx.fillRect(0, GROUND_Y, W, 8);

  // =====================
  // 3) PLATEFORMES
  // =====================
  if (Array.isArray(PLATFORMS)) {
    ctx.fillStyle = '#3a3f51';
    for (const p of PLATFORMS) {
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // petite lèvre sombre
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.fillStyle = '#3a3f51';
    }
  }

   
    // =====================
  // 4) PROJOS / EFFETS
  // =====================
if (state === S.BATTLE && p1 && p2 && Array.isArray(projectiles)) {
  for (const pr of projectiles) {
    ctx.save(); // isole les changements pour ce projectile

    let drawn = false;

    // Sprite projectile (défini dans le roster du perso)
    const projSprite = pr.owner?.char?.sprites?.projectile;
    if (projSprite) {
      try {
        // dessine le sprite centré sur pr.x / pr.y , const w/h taille
        const w = pr.w || 24 ;
        const h = pr.h || 24 ;
        ctx.drawImage(getCachedImage(projSprite), pr.x - w/2, pr.y - h/2, w, h);
        drawn = true;
      } catch(e) {
        console.warn("Erreur draw projectile:", e);
      }
    }

    // Fallback si aucun sprite affiché
    if (!drawn) {
      const r = pr.r || 6;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }

    ctx.restore(); // restaure l’état (ne touche pas aux joueurs)
  }
}



  // =====================
  // 5) JOUEURS
  // =====================
  if (state === S.BATTLE) {
    if (p1 && typeof drawPlayer === 'function') drawPlayer(p1);
    if (p2 && typeof drawPlayer === 'function') drawPlayer(p2);
  }


  //debug
  if (DEBUG_HITBOX && state === S.BATTLE) {
  // hurtboxes joueurs
  ctx.strokeStyle = 'rgba(0,255,0,0.8)';
  ctx.strokeRect(p1.x, p1.y, p1.w, p1.h);
  ctx.strokeRect(p2.x, p2.y, p2.w, p2.h);

  // hitboxes d'attaque
  ctx.strokeStyle = 'rgba(255,0,0,0.8)';
  for (const hb of hitboxes) ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

  // projectiles
  ctx.strokeStyle = 'rgba(0,200,255,0.8)';
 for (const pr of projectiles) {
  ctx.beginPath();
  if (pr.r) {
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI*2);
    ctx.stroke();
  } else {
    const pw = pr.w || 12, ph = pr.h || 12;
    ctx.strokeRect(pr.x - pw/2, pr.y - ph/2, pw, ph);
  }
}

}

      
  

  // (le HUD est en DOM, pas besoin ici)
}


  // debug flip-reset
// const mark = (pl)=>{
//   if (!pl.onGround && !pl.canDouble && nearWallForReset(pl)) {
//     ctx.fillStyle = "rgba(0,255,120,0.15)";
//     ctx.fillRect(pl.x-6, pl.y-6, pl.w+12, pl.h+12);
//   }
// };
// mark(p1); mark(p2);

// FIN DEBUG

// Détermine quel sprite utiliser selon l'état du joueur
function spriteKeyFor(p, tNow) {
  // ordre de priorité : block > attack > air > run > idle
  if (p.blocking) return 'block';

  // --- Affichage coup récent (kick/upper/punch) ---
const lastT  = (p.lastAttackT ?? p.lastAttackTime ?? 0);     // ← compat: 2 noms possibles
const aType  = (p.lastAttackType || '');                     // 'kick' | 'upper' | 'punch'
const win = (typeof ATTACK_ANIM_MS !== 'undefined')
  ? (ATTACK_ANIM_MS[aType] ?? ATTACK_ANIM_MS.default ?? 180) // si tu utilises ATTACK_ANIM_MS
  : (ATTACK_WINDOW_MS?.[aType] ?? ATTACK_WINDOW_MS?.default ?? 180); // sinon

if (tNow - lastT < win) {
  if (aType && p.char?.sprites?.[aType]) return aType;       // ✅ sprite dédié (kick/upper/punch)
  return 'attack';                                           // fallback si pas de sprite dédié
}


 
  if (!p.onGround) return 'jump';
  const moving = Math.abs(p.vx) > 0.6;
  return moving ? 'run' : 'idle';
}

function drawPlayer(p) {
  ctx.save();

  // centre le dessin sur le joueur
  ctx.translate(p.x + p.w/2, p.y + p.h/2);

  const key = spriteKeyFor(p, performance.now());
  const src = (p.char.sprites && p.char.sprites[key]) || (p.char.sprites && p.char.sprites.idle);
  const img = getCachedImage(src);

  // ✅ flip miroir si on regarde à gauche
  if (p.facing === -1) {
    ctx.scale(-1, 1);  // miroir horizontal
  }

 // taille de rendu basée sur la base * visualScale
const visScale = p.char.visualScale || 1;
const vw = Math.round(BASE_PLAYER_W * visScale);
const vh = Math.round(BASE_PLAYER_H * visScale);

if (isReady(img)) {
  ctx.drawImage(img, -vw/2, -vh/2, vw, vh);
} else {
  ctx.fillStyle = p.char.color || '#9de1ff';
  roundRect(ctx, -vw/2, -vh/2, vw, vh, 10, true);
}

  if (isReady(img)) {
    // dessine l’image avec dimensions positives (flip déjà géré)
    ctx.drawImage(img, -vw/2, -vh/2, vw, vh);
  } else {
    // fallback visible le temps de chargement
    ctx.fillStyle = p.char.color || '#9de1ff';
    roundRect(ctx, -vw/2, -vh/2, vw, vh, 10, true);
  }

  ctx.restore();
}








  function roundRect(ctx, x, y, w, h, r, fill=true) {
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    if (fill) ctx.fill();
    else ctx.stroke();
  }

  // ---------- Loop ----------
  function loop() {
    const t = performance.now();
    dtMs = t - lastT; lastT = t;

    update(dtMs);
    draw();

    requestAnimationFrame(loop);
  }

  // ---------- UI wiring ----------
  btnVersus.addEventListener('click', goSelect);
  btnTournament.addEventListener('click', goTournamentSetup);
  btnHelp.addEventListener('click', goHelp);
  btnHelpBack.addEventListener('click', goMenu);

  btnBackMenu.addEventListener('click', goMenu);
btnEndSelection.addEventListener('click', () => {
  elSelect.classList.add('hidden');        // cacher l’écran persos
  screenMap.classList.remove('hidden');    // montrer l’écran map

  if (!track.children.length) buildCarousel();
  snapTo(0, false);
});


// Retour à la sélection des persos
back.addEventListener('click', ()=>{
  screenMap.classList.add('hidden');
  elSelect.classList.remove('hidden');
});

play.addEventListener('click', ()=>{
  const chosen = MAPS[currentSlide];

  // 👉 applique le fond directement au div .game-map
  const gameMapEl = document.querySelector('.game-map');
  if (gameMapEl) {
    gameMapEl.style.backgroundImage = `url(assets/map/${chosen})`;
    gameMapEl.style.backgroundSize = 'cover';
    gameMapEl.style.backgroundPosition = 'center';
    gameMapEl.style.backgroundRepeat = 'no-repeat';
  }

  // cache l’écran map et lance le match
  screenMap.classList.add('hidden');
  startBattle(p1Char, p2Char, false);
});






  // Overlay buttons
  btnRematch.addEventListener('click', ()=>{
    hide(elOverlay);
    startBattle(p1.char, p2.char, isTournamentMatch);
  });
  btnSelectAgain.addEventListener('click', ()=>{
    hide(elOverlay);
    if (isTournamentMatch) {
      // Dans le tournoi, on retourne à l’arbre
      hide(elHUD); hide(canvas);
      show(elTBracket);
      state = S.TOURNAMENT_VIEW;
      roundStatus.textContent = `Round ${currentRound+1} — Match ${currentMatchIndex+1}`;
      setTimeout(()=>advanceTournamentIfByes(), 60);
    } else {
      goSelect();
    }
  });
  btnMenu.addEventListener('click', goMenu);

  // Tournament buttons
  // btnTPlayers.addEventListener('click', ()=>{
  //   tSize = clamp(parseInt(inputTSize.value,10)||8, 2, 16);
  //   inputTSize.value = tSize;
  //   goTournamentSelect();
  // });
  // btnTBack.addEventListener('click', goMenu);
  // btnTStart.addEventListener('click', goTournamentView);
  // btnTExit.addEventListener('click', goMenu);

  // Build initial selection grids
  buildCharGrid(charGrid, ()=>{});
  buildCharGrid(tGrid, ()=>{});


  // Start
  goMenu();
  requestAnimationFrame(loop);

  // ---------- SPRITES — où brancher vos assets ----------
  
   // 1) Pour chaque perso du ROSTER, ajoutez des chemins sprites :
     
/*
    2) Chargez les images au chargement si vous voulez (ex):
       const IMG = {};
       function loadImage(path){ return new Promise(res=>{ const im = new Image(); im.src=path; im.onload=()=>res(im); });}
       async function preload() {
         for (const c of ROSTER) {
           if (!c.sprites) continue;
           IMG[c.id] = {};
           for (const [k,p] of Object.entries(c.sprites)) {
             IMG[c.id][k] = await loadImage(p);
           }
         }
       }
       // puis avant requestAnimationFrame(loop), appelez await preload()

    3) Dans drawPlayer(), remplacez le rectangle par un drawImage sur l’animation
       qui correspond à l’état (idle/run/jump/block/attack).
       Exemple simplifié:
         const img = IMG[p.char.id]?.idle;
         if (img) ctx.drawImage(img, -w/2, -h/2, w, h);
       Vous pouvez gérer des spritesheets (sx,sy,sw,sh,dx,dy,dw,dh) si besoin.

    4) Projectile:
       Dans draw(), remplacez le rectangle projectile par drawImage(IMG[p.owner.char.id]?.projectile, ...)
  */

})();
