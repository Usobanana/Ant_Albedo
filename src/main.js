import { UNIT_TYPES, ENEMY_TYPES } from './data.js';

// --- Constants & State ---
const GRID_SIZE = 5;
const BASE_SPAWN_TIME = 4000;
const ENEMY_SPAWN_INTERVAL = 4500;
const STAGE_WIDTH = 2500;

const STATE = { TITLE: 'title', SELECTION: 'selection', BATTLE: 'battle', RESULT: 'result' };

let currentState = STATE.TITLE;
let grid = [];
let playerHp = 100;
let enemyHp = 100;
let selectedDeck = [];
let activeUnits = [];
let activeEnemies = [];

// Camera & UI State
let isAutoFollow = true;
let lastUserScrollTime = 0;
let lastFrameTime = 0;

// Intervals
let enemySpawnerId = null;

// Drag State
let draggedElement = null;
let dragSourceIdx = null;

// --- DOM Elements ---
const screens = {
    [STATE.TITLE]: document.getElementById('title-screen'),
    [STATE.SELECTION]: document.getElementById('selection-screen'),
    [STATE.BATTLE]: document.getElementById('battle-screen'),
    [STATE.RESULT]: document.getElementById('result-screen')
};

const unitOptionsContainer = document.getElementById('unit-options');
const startBattleBtn = document.getElementById('start-battle-btn');
const mergeGrid = document.getElementById('merge-grid');
const battleField = document.getElementById('battle-field');
const battleContainer = document.getElementById('battle-container');
const minimapViewport = document.getElementById('minimap-viewport');
const minimapEntities = document.getElementById('minimap-entities');

// --- Initialization ---
function init() {
    setupEventListeners();
    setupDebugCommands();
    changeState(STATE.TITLE);
    requestAnimationFrame(gameLoop);
}

function setupEventListeners() {
    document.getElementById('to-selection-btn').onclick = () => changeState(STATE.SELECTION);
    document.getElementById('back-to-title-btn').onclick = () => changeState(STATE.TITLE);
    document.getElementById('start-battle-btn').onclick = () => changeState(STATE.BATTLE);
    document.getElementById('back-to-selection-btn').onclick = () => changeState(STATE.SELECTION);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    battleField.addEventListener('scroll', () => {
        const now = Date.now();
        if (now - lastUserScrollTime > 100) {
            isAutoFollow = false;
            lastUserScrollTime = now;
        }
    });
}

function changeState(newState) {
    currentState = newState;
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('hidden', key !== currentState);
    });

    if (currentState === STATE.TITLE) {
        resetGameData();
    } else if (currentState === STATE.SELECTION) {
        showSelectionScreen();
    } else if (currentState === STATE.BATTLE) {
        startBattle();
    } else if (currentState === STATE.RESULT) {
        showResultScreen();
    }
}

function resetGameData() {
    playerHp = 100; enemyHp = 100;
    selectedDeck = [];
    grid = Array(GRID_SIZE * GRID_SIZE).fill(null).map(() => ({
        unit: null, cooldown: 0, target: BASE_SPAWN_TIME, isNew: false
    }));
    activeUnits = []; activeEnemies = [];
    battleContainer.innerHTML = '';
    isAutoFollow = true;
    if (enemySpawnerId) clearInterval(enemySpawnerId);
}

// --- Battle Screen ---
function startBattle() {
    battleContainer.style.width = `${STAGE_WIDTH}px`;
    setupBaseCharacters();
    createGridUI();
    
    grid.forEach(slot => {
        if (Math.random() > 0.7) {
            slot.unit = { type: selectedDeck[Math.floor(Math.random() * 3)], level: 0 };
            slot.isNew = true; // 初回配置もアニメーション対象
        } else {
            slot.cooldown = Math.random() * BASE_SPAWN_TIME;
        }
    });

    renderGrid();
    battleField.scrollLeft = 0;

    enemySpawnerId = setInterval(() => {
        if (currentState !== STATE.BATTLE) return;
        spawnEnemy();
    }, ENEMY_SPAWN_INTERVAL);
}

function setupBaseCharacters() {
    const heroEl = document.createElement('div');
    heroEl.className = 'hero';
    heroEl.innerHTML = `
        <span class="char-label">HERO</span>
        <div class="char-hp-bar"><div id="hero-hp-fill" class="char-hp-fill" style="background:var(--hp-player);width:100%"></div></div>
        <div class="char-icon">🛡️</div>
    `;
    battleContainer.appendChild(heroEl);

    const kingEl = document.createElement('div');
    kingEl.className = 'demon-king';
    kingEl.innerHTML = `
        <span class="char-label">DEMON KING</span>
        <div class="char-hp-bar"><div id="king-hp-fill" class="char-hp-fill" style="background:var(--hp-enemy);width:100%"></div></div>
        <div class="char-icon">👿</div>
    `;
    battleContainer.appendChild(kingEl);
}

// --- Grid & Spawn ---
function createGridUI() {
    mergeGrid.innerHTML = '';
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const slot = document.createElement('div');
        slot.classList.add('grid-slot');
        slot.dataset.index = i;
        const gauge = document.createElement('div');
        gauge.className = 'spawn-gauge';
        slot.appendChild(gauge);
        mergeGrid.appendChild(slot);
    }
}

function updateSpawns(dt) {
    let changed = false;
    grid.forEach((slot, i) => {
        if (!slot.unit) {
            slot.cooldown += dt;
            if (slot.cooldown >= slot.target) {
                slot.unit = { type: selectedDeck[Math.floor(Math.random() * selectedDeck.length)], level: 0 };
                slot.cooldown = 0;
                slot.isNew = true; // 新規出現フラグ
                changed = true;
            }
        }
    });
    if (changed) renderGrid();
    updateGauges();
}

function updateGauges() {
    const slots = document.querySelectorAll('.grid-slot');
    slots.forEach((slotEl, i) => {
        const slot = grid[i];
        const gauge = slotEl.querySelector('.spawn-gauge');
        if (slot.unit) {
            gauge.style.background = 'none';
        } else {
            const percent = (slot.cooldown / slot.target) * 100;
            gauge.style.background = `conic-gradient(var(--accent-color) ${percent}%, transparent 0%)`;
        }
    });
}

function renderGrid() {
    const slots = document.querySelectorAll('.grid-slot');
    slots.forEach((slot, i) => {
        const existingItem = slot.querySelector('.unit-item');
        
        if (!grid[i].unit) {
            if (existingItem) existingItem.remove();
            return;
        }

        const unit = grid[i].unit;
        if (existingItem && existingItem.dataset.type === unit.type && parseInt(existingItem.dataset.level) === unit.level) {
            existingItem.style.opacity = '1';
            return;
        }

        if (existingItem) existingItem.remove();
        
        const item = document.createElement('div');
        item.classList.add('unit-item', `lv${unit.level}`);
        if (grid[i].isNew) {
            item.classList.add('new-spawn');
            grid[i].isNew = false;
            // アニメーション終了後にクラスを削除して再発を防ぐ
            item.onanimationend = () => item.classList.remove('new-spawn');
        }
        item.dataset.type = unit.type;
        item.dataset.level = unit.level;
        item.style.background = UNIT_TYPES[unit.type].color;
        item.innerHTML = `<span>Lv${unit.level}</span>`;
        item.style.touchAction = 'none';
        item.onpointerdown = (e) => handlePointerDown(e, i, item);
        slot.appendChild(item);
    });
}

// --- Pointer Events ---
function handlePointerDown(e, index, item) {
    draggedElement = item.cloneNode(true);
    dragSourceIdx = index;
    item.style.opacity = '0.3';
    
    // ドラッグ中、他の全アイテムが判定を邪魔しないようにする
    document.querySelectorAll('.unit-item').forEach(u => u.style.pointerEvents = 'none');
    
    draggedElement.classList.add('dragging');
    draggedElement.style.position = 'fixed';
    draggedElement.style.zIndex = '2000';
    draggedElement.style.width = item.clientWidth + 'px';
    draggedElement.style.height = item.clientHeight + 'px';
    draggedElement.style.pointerEvents = 'none'; // これ自体も判定を透過させる
    document.body.appendChild(draggedElement);
    updateDraggedPosition(e.clientX, e.clientY);
}

function handlePointerMove(e) {
    if (!draggedElement) return;
    updateDraggedPosition(e.clientX, e.clientY);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    document.querySelectorAll('.grid-slot, #battle-field').forEach(el => el.classList.remove('drag-over'));
    if (target) {
        const slot = target.closest('.grid-slot');
        const field = target.closest('#battle-field');
        if (slot) slot.classList.add('drag-over');
        else if (field) field.classList.add('drag-over');
    }
}

function handlePointerUp(e) {
    if (!draggedElement) return;

    // 指を離した場所の要素を取得
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slot = target ? target.closest('.grid-slot') : null;
    const field = target ? target.closest('#battle-field') : null;

    if (slot) {
        executeMerge(dragSourceIdx, parseInt(slot.dataset.index));
    } else if (field) {
        const unit = grid[dragSourceIdx].unit;
        if (unit && unit.level >= 1) { 
            deployUnit(unit); 
            grid[dragSourceIdx].unit = null; 
        }
    }

    draggedElement.remove(); draggedElement = null; dragSourceIdx = null;
    document.querySelectorAll('.grid-slot, #battle-field').forEach(el => el.classList.remove('drag-over'));
    // pointer-eventsを元に戻す
    document.querySelectorAll('.unit-item').forEach(u => u.style.pointerEvents = 'auto');
    renderGrid();
}

function updateDraggedPosition(x, y) {
    if (!draggedElement) return;
    draggedElement.style.left = (x - draggedElement.clientWidth / 2) + 'px';
    draggedElement.style.top = (y - draggedElement.clientHeight / 2) + 'px';
}

function executeMerge(sIdx, tIdx) {
    if (sIdx === tIdx) return;
    const s = grid[sIdx].unit, t = grid[tIdx].unit;
    if (!s) return;

    if (t && s.type === t.type && s.level === t.level) {
        grid[tIdx].unit = { type: s.type, level: s.level + 1 };
        grid[sIdx].unit = null;
        grid[tIdx].isNew = true; // マージ後の進化もアニメーション対象に
    } else if (!t) {
        grid[tIdx].unit = s; grid[sIdx].unit = null;
    }
}

// --- Battle Logic ---
function deployUnit(unitData) {
    const data = UNIT_TYPES[unitData.type];
    const el = document.createElement('div');
    el.classList.add('battle-unit');
    el.style.background = data.color;
    el.innerHTML = `<span>Lv${unitData.level}</span>`;
    battleContainer.appendChild(el);
    activeUnits.push({ ...unitData, x: 100, y: 50 + (Math.random() - 0.5) * 15, hp: data.stats.hp * (1 + unitData.level * 0.5), atk: data.stats.atk * (unitData.level + 1), spd: data.stats.spd, el: el });
}

function spawnEnemy() {
    const data = ENEMY_TYPES.SKELETON;
    const el = document.createElement('div');
    el.classList.add('battle-unit', 'enemy');
    el.innerHTML = `<span>💀</span>`;
    battleContainer.appendChild(el);
    activeEnemies.push({ type: 'SKELETON', x: STAGE_WIDTH - 100, y: 50 + (Math.random() - 0.5) * 15, hp: data.stats.hp, atk: data.stats.atk, spd: data.stats.spd, el: el });
}

function gameLoop(currentTime) {
    if (!lastFrameTime) lastFrameTime = currentTime;
    const dt = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    if (currentState === STATE.BATTLE) {
        updateEntities(dt);
        checkCollisions(currentTime);
        cleanupEntities();
        updateSpawns(dt);
        updateCamera();
        updateMinimap();
        updateUI();
    }
    requestAnimationFrame(gameLoop);
}

function updateEntities(dt) {
    activeUnits.forEach(u => { if (!u.isFighting) u.x += u.spd * (dt / 50); u.el.style.left = `${u.x}px`; u.el.style.top = `${u.y}%`; if (u.x >= STAGE_WIDTH - 150) { enemyHp = Math.max(0, enemyHp - u.atk); u.hp = 0; } u.isFighting = false; });
    activeEnemies.forEach(e => { if (!e.isFighting) e.x -= e.spd * (dt / 50); e.el.style.left = `${e.x}px`; e.el.style.top = `${e.y}%`; if (e.x <= 150) { playerHp = Math.max(0, playerHp - e.atk); e.hp = 0; } e.isFighting = false; });
}

function checkCollisions(time) {
    activeUnits.forEach(u => { activeEnemies.forEach(e => { if (Math.abs(u.x - e.x) < 40 && Math.abs(u.y - e.y) < 20) { u.isFighting = true; e.isFighting = true; if (!u.lastAtk || time - u.lastAtk > 1000) { e.hp -= u.atk; u.lastAtk = time; flash(e.el); } if (!e.lastAtk || time - e.lastAtk > 1000) { u.hp -= e.atk; e.lastAtk = time; flash(u.el); } } }); });
}

function flash(el) { el.style.filter = "brightness(3)"; setTimeout(() => { if (el) el.style.filter = "none"; }, 100); }
function cleanupEntities() { activeUnits = activeUnits.filter(u => { if (u.hp <= 0) u.el.remove(); return u.hp > 0; }); activeEnemies = activeEnemies.filter(e => { if (e.hp <= 0) e.el.remove(); return e.hp > 0; }); }

function updateCamera() {
    if (!isAutoFollow) { if (Date.now() - lastUserScrollTime > 1500) isAutoFollow = true; return; }
    let frontX = 0; activeUnits.forEach(u => { if (u.x > frontX) frontX = u.x; });
    frontX = Math.max(frontX, 200);
    const targetScroll = frontX - battleField.clientWidth / 2;
    const currentScroll = battleField.scrollLeft;
    const diff = targetScroll - currentScroll;
    if (Math.abs(diff) > 1) { lastUserScrollTime = Date.now(); battleField.scrollLeft += diff * 0.05; }
}

function updateMinimap() {
    const viewWidth = battleField.clientWidth;
    const mmWidth = minimapEntities.parentElement.clientWidth;
    const ratio = mmWidth / STAGE_WIDTH;
    minimapViewport.style.width = `${viewWidth * ratio}px`;
    minimapViewport.style.left = `${battleField.scrollLeft * ratio}px`;
    minimapEntities.innerHTML = '';
    addMiniDot(100, 'hero');
    addMiniDot(STAGE_WIDTH - 100, 'king');
    activeUnits.forEach(u => addMiniDot(u.x, 'ally'));
    activeEnemies.forEach(e => addMiniDot(e.x, 'enemy'));
}

function addMiniDot(x, type) {
    const ratio = minimapEntities.parentElement.clientWidth / STAGE_WIDTH;
    const dot = document.createElement('div');
    dot.className = `mini-dot ${type}`;
    dot.style.left = `${x * ratio}px`;
    minimapEntities.appendChild(dot);
}

function updateUI() {
    const heroFill = document.getElementById('hero-hp-fill'), kingFill = document.getElementById('king-hp-fill');
    if (heroFill) heroFill.style.width = `${playerHp}%`;
    if (kingFill) kingFill.style.width = `${enemyHp}%`;
    if ((enemyHp <= 0 || playerHp <= 0) && currentState === STATE.BATTLE) changeState(STATE.RESULT);
}

function showResultScreen() {
    const title = document.getElementById('result-title');
    title.textContent = enemyHp <= 0 ? "VICTORY!" : "DEFEAT...";
    title.style.color = enemyHp <= 0 ? "var(--hp-player)" : "var(--hp-enemy)";
}

function setupDebugCommands() {
    window.gameDebug = { deploy: (type, lv) => deployUnit({ type, level: lv }), spawnEnemy: () => spawnEnemy(), changeState: (s) => changeState(s) };
}

function showSelectionScreen() {
    unitOptionsContainer.innerHTML = ''; selectedDeck = []; updateSelectionUI();
    Object.values(UNIT_TYPES).forEach(unit => {
        const card = document.createElement('div'); card.classList.add('unit-card');
        card.innerHTML = `<div class="unit-icon" style="background: ${unit.color}"></div><div class="unit-name">${unit.name}</div><div class="check-mark">✔</div>`;
        card.onclick = () => { const idx = selectedDeck.indexOf(unit.id); if (idx > -1) selectedDeck.splice(idx, 1); else if (selectedDeck.length < 3) selectedDeck.push(unit.id); updateSelectionUI(); card.classList.toggle('selected', selectedDeck.includes(unit.id)); };
        unitOptionsContainer.appendChild(card);
    });
}
function updateSelectionUI() { startBattleBtn.disabled = selectedDeck.length < 3; startBattleBtn.textContent = `BATTLE START (${selectedDeck.length}/3)`; }

init();
