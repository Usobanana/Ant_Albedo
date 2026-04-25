import { UNIT_TYPES, ENEMY_TYPES } from './data.js';

// --- Constants & State ---
const GRID_SIZE = 5;
const SPAWN_INTERVAL = 3000;
const ENEMY_SPAWN_INTERVAL = 4500;
const STAGE_WIDTH = 2500; // ステージの広さ

const STATE = { TITLE: 'title', SELECTION: 'selection', BATTLE: 'battle', RESULT: 'result' };

let currentState = STATE.TITLE;
let score = 0;
let grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
let playerHp = 100;
let enemyHp = 100;
let selectedDeck = [];
let activeUnits = [];
let activeEnemies = [];

// Camera State
let isAutoFollow = true;
let lastUserScrollTime = 0;

// Intervals
let spawnTimerId = null;
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
const spawnTimerLabel = document.getElementById('spawn-timer');
const scoreLabel = document.getElementById('score');
const battleField = document.getElementById('battle-field');
const battleContainer = document.getElementById('battle-container');

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

    // スクロール検知
    battleField.addEventListener('scroll', () => {
        const now = Date.now();
        // 自動追従によるスクロールでない場合、ユーザー操作とみなす
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
    score = 0; playerHp = 100; enemyHp = 100;
    selectedDeck = [];
    grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
    activeUnits = []; activeEnemies = [];
    battleContainer.innerHTML = '';
    isAutoFollow = true;
    if (spawnTimerId) clearInterval(spawnTimerId);
    if (enemySpawnerId) clearInterval(enemySpawnerId);
}

// --- Battle Screen ---
function startBattle() {
    battleContainer.style.width = `${STAGE_WIDTH}px`;
    
    // 勇者と魔王の設置
    setupBaseCharacters();

    createGrid();
    renderGrid();
    
    // カメラを勇者に合わせる
    battleField.scrollLeft = 0;

    let timeLeft = SPAWN_INTERVAL / 1000;
    spawnTimerId = setInterval(() => {
        if (currentState !== STATE.BATTLE) return;
        timeLeft -= 1;
        if (timeLeft <= 0) { spawnItem(); timeLeft = SPAWN_INTERVAL / 1000; }
        spawnTimerLabel.textContent = `${Math.max(0, Math.ceil(timeLeft))}s`;
    }, 1000);

    enemySpawnerId = setInterval(() => {
        if (currentState !== STATE.BATTLE) return;
        spawnEnemy();
    }, ENEMY_SPAWN_INTERVAL);
}

function setupBaseCharacters() {
    // 勇者
    const heroEl = document.createElement('div');
    heroEl.className = 'hero';
    heroEl.innerHTML = `
        <div class="char-icon">🛡️</div>
        <div class="char-hp-bar"><div id="hero-hp-fill" class="char-hp-fill" style="background:var(--hp-player);width:100%"></div></div>
    `;
    battleContainer.appendChild(heroEl);

    // 魔王
    const kingEl = document.createElement('div');
    kingEl.className = 'demon-king';
    kingEl.innerHTML = `
        <div class="char-icon">👿</div>
        <div class="char-hp-bar"><div id="king-hp-fill" class="char-hp-fill" style="background:var(--hp-enemy);width:100%"></div></div>
    `;
    battleContainer.appendChild(kingEl);
}

// --- Grid & Merge ---
function createGrid() {
    mergeGrid.innerHTML = '';
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const slot = document.createElement('div');
        slot.classList.add('grid-slot');
        slot.dataset.index = i;
        mergeGrid.appendChild(slot);
    }
}

function spawnItem() {
    const emptyIdx = grid.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (emptyIdx.length > 0) {
        const idx = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
        grid[idx] = { type: selectedDeck[Math.floor(Math.random() * selectedDeck.length)], level: 0 };
        renderGrid();
    }
}

function renderGrid() {
    const slots = document.querySelectorAll('.grid-slot');
    slots.forEach((slot, i) => {
        slot.innerHTML = '';
        if (grid[i]) {
            const item = document.createElement('div');
            item.classList.add('unit-item', `lv${grid[i].level}`);
            item.style.background = UNIT_TYPES[grid[i].type].color;
            item.innerHTML = `<span>Lv${grid[i].level}</span>`;
            item.style.touchAction = 'none';
            item.onpointerdown = (e) => handlePointerDown(e, i, item);
            slot.appendChild(item);
        }
    });
}

// --- Pointer Events ---
function handlePointerDown(e, index, item) {
    draggedElement = item.cloneNode(true);
    dragSourceIdx = index;
    item.style.opacity = '0.3';
    draggedElement.classList.add('dragging');
    draggedElement.style.position = 'fixed';
    draggedElement.style.zIndex = '2000';
    draggedElement.style.width = item.clientWidth + 'px';
    draggedElement.style.height = item.clientHeight + 'px';
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
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slot = target ? target.closest('.grid-slot') : null;
    const field = target ? target.closest('#battle-field') : null;

    if (slot) executeMerge(dragSourceIdx, parseInt(slot.dataset.index));
    else if (field) {
        const unit = grid[dragSourceIdx];
        if (unit && unit.level >= 1) { deployUnit(unit); grid[dragSourceIdx] = null; }
    }
    draggedElement.remove(); draggedElement = null; dragSourceIdx = null;
    document.querySelectorAll('.grid-slot, #battle-field').forEach(el => el.classList.remove('drag-over'));
    renderGrid();
}

function updateDraggedPosition(x, y) {
    if (!draggedElement) return;
    draggedElement.style.left = (x - draggedElement.clientWidth / 2) + 'px';
    draggedElement.style.top = (y - draggedElement.clientHeight / 2) + 'px';
}

function executeMerge(sIdx, tIdx) {
    if (sIdx === tIdx) return;
    const s = grid[sIdx], t = grid[tIdx];
    if (s && t && s.type === t.type && s.level === t.level) {
        grid[tIdx] = { type: s.type, level: s.level + 1 };
        grid[sIdx] = null;
        score += (s.level + 1) * 10;
    } else if (s && !t) {
        grid[tIdx] = s; grid[sIdx] = null;
    }
}

function deployUnit(unitData) {
    const data = UNIT_TYPES[unitData.type];
    const el = document.createElement('div');
    el.classList.add('battle-unit');
    el.style.background = data.color;
    el.innerHTML = `<span>Lv${unitData.level}</span>`;
    battleContainer.appendChild(el);

    activeUnits.push({
        ...unitData, x: 100, // 勇者の位置 (px)
        y: 50 + (Math.random() - 0.5) * 15, // 1ライン+微かな奥行き
        hp: data.stats.hp * (1 + unitData.level * 0.5),
        atk: data.stats.atk * (unitData.level + 1),
        spd: data.stats.spd, el: el
    });
}

function spawnEnemy() {
    const data = ENEMY_TYPES.SKELETON;
    const el = document.createElement('div');
    el.classList.add('battle-unit', 'enemy');
    el.innerHTML = `<span>💀</span>`;
    battleContainer.appendChild(el);

    activeEnemies.push({
        type: 'SKELETON', x: STAGE_WIDTH - 100, // 魔王の位置
        y: 50 + (Math.random() - 0.5) * 15,
        hp: data.stats.hp, atk: data.stats.atk, spd: data.stats.spd, el: el
    });
}

// --- Game Loop ---
function gameLoop(time) {
    if (currentState === STATE.BATTLE) {
        updateEntities();
        checkCollisions(time);
        cleanupEntities();
        updateCamera();
        updateUI();
    }
    requestAnimationFrame(gameLoop);
}

function updateEntities() {
    activeUnits.forEach(u => {
        if (!u.isFighting) u.x += u.spd * 0.2;
        u.el.style.left = `${u.x}px`;
        u.el.style.top = `${u.y}%`;
        if (u.x >= STAGE_WIDTH - 150) { enemyHp = Math.max(0, enemyHp - u.atk); u.hp = 0; }
        u.isFighting = false;
    });
    activeEnemies.forEach(e => {
        if (!e.isFighting) e.x -= e.spd * 0.2;
        e.el.style.left = `${e.x}px`;
        e.el.style.top = `${e.y}%`;
        if (e.x <= 150) { playerHp = Math.max(0, playerHp - e.atk); e.hp = 0; }
        e.isFighting = false;
    });
}

function checkCollisions(time) {
    activeUnits.forEach(u => {
        activeEnemies.forEach(e => {
            if (Math.abs(u.x - e.x) < 40 && Math.abs(u.y - e.y) < 20) {
                u.isFighting = true; e.isFighting = true;
                if (!u.lastAtk || time - u.lastAtk > 1000) { e.hp -= u.atk; u.lastAtk = time; flash(e.el); }
                if (!e.lastAtk || time - e.lastAtk > 1000) { u.hp -= e.atk; e.lastAtk = time; flash(u.el); }
            }
        });
    });
}

function flash(el) {
    el.style.filter = "brightness(3)";
    setTimeout(() => { if (el) el.style.filter = "none"; }, 100);
}

function cleanupEntities() {
    activeUnits = activeUnits.filter(u => { if (u.hp <= 0) u.el.remove(); return u.hp > 0; });
    activeEnemies = activeEnemies.filter(e => { if (e.hp <= 0) e.el.remove(); return e.hp > 0; });
}

function updateCamera() {
    if (!isAutoFollow) {
        // 操作停止から1.5秒経過し、かつ前線が視界内にあれば追従再開
        if (Date.now() - lastUserScrollTime > 1500) {
            isAutoFollow = true;
        }
        return;
    }

    // 味方の最前線(Xの最大値)を探す
    let frontX = 0;
    activeUnits.forEach(u => { if (u.x > frontX) frontX = u.x; });

    // 勇者の位置も考慮
    frontX = Math.max(frontX, 200);

    const targetScroll = frontX - battleField.clientWidth / 2;
    const currentScroll = battleField.scrollLeft;
    
    // スムーズな追従 (線形補間)
    const diff = targetScroll - currentScroll;
    if (Math.abs(diff) > 1) {
        lastUserScrollTime = Date.now(); // 自動スクロール中であることを示す
        battleField.scrollLeft += diff * 0.05;
    }
}

function updateUI() {
    scoreLabel.textContent = score;
    const heroFill = document.getElementById('hero-hp-fill');
    const kingFill = document.getElementById('king-hp-fill');
    if (heroFill) heroFill.style.width = `${playerHp}%`;
    if (kingFill) kingFill.style.width = `${enemyHp}%`;

    if ((enemyHp <= 0 || playerHp <= 0) && currentState === STATE.BATTLE) {
        changeState(STATE.RESULT);
    }
}

function showResultScreen() {
    const title = document.getElementById('result-title');
    title.textContent = enemyHp <= 0 ? "VICTORY!" : "DEFEAT...";
    title.style.color = enemyHp <= 0 ? "var(--hp-player)" : "var(--hp-enemy)";
    document.getElementById('final-score').textContent = score;
}

function setupDebugCommands() {
    window.gameDebug = {
        deploy: (type, lv) => deployUnit({ type, level: lv }),
        spawnEnemy: () => spawnEnemy(),
        changeState: (s) => changeState(s),
        setScroll: (val) => battleField.scrollLeft = val
    };
}

function showSelectionScreen() {
    unitOptionsContainer.innerHTML = '';
    selectedDeck = [];
    updateSelectionUI();
    Object.values(UNIT_TYPES).forEach(unit => {
        const card = document.createElement('div');
        card.classList.add('unit-card');
        card.innerHTML = `<div class="unit-icon" style="background: ${unit.color}"></div><div class="unit-name">${unit.name}</div><div class="check-mark">✔</div>`;
        card.onclick = () => {
            const idx = selectedDeck.indexOf(unit.id);
            if (idx > -1) selectedDeck.splice(idx, 1);
            else if (selectedDeck.length < 3) selectedDeck.push(unit.id);
            updateSelectionUI();
            card.classList.toggle('selected', selectedDeck.includes(unit.id));
        };
        unitOptionsContainer.appendChild(card);
    });
}

function updateSelectionUI() {
    startBattleBtn.disabled = selectedDeck.length < 3;
    startBattleBtn.textContent = `BATTLE START (${selectedDeck.length}/3)`;
}

init();
