import { UNIT_TYPES, ENEMY_TYPES } from './data.js';

// --- Constants & State ---
const GRID_SIZE = 5;
const SPAWN_INTERVAL = 3000;
const ENEMY_SPAWN_INTERVAL = 4500;

const STATE = {
    TITLE: 'title',
    SELECTION: 'selection',
    BATTLE: 'battle',
    RESULT: 'result'
};

let currentState = STATE.TITLE;
let score = 0;
let grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
let playerHp = 100;
let enemyHp = 100;
let selectedDeck = [];
let activeUnits = [];
let activeEnemies = [];

// Intervals
let spawnTimerId = null;
let enemySpawnerId = null;

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
}

function changeState(newState) {
    currentState = newState;
    
    // UI 切り替え
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('hidden', key !== currentState);
    });

    // 状態に応じた初期化
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
    score = 0;
    playerHp = 100;
    enemyHp = 100;
    selectedDeck = [];
    grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
    activeUnits = [];
    activeEnemies = [];
    battleContainer.innerHTML = '';
    
    if (spawnTimerId) clearInterval(spawnTimerId);
    if (enemySpawnerId) clearInterval(enemySpawnerId);
}

// --- Selection Screen ---
function showSelectionScreen() {
    unitOptionsContainer.innerHTML = '';
    selectedDeck = [];
    updateSelectionUI();
    
    Object.values(UNIT_TYPES).forEach(unit => {
        const card = document.createElement('div');
        card.classList.add('unit-card');
        card.innerHTML = `
            <div class="unit-icon" style="background: ${unit.color}"></div>
            <div class="unit-name">${unit.name}</div>
            <div class="check-mark">✔</div>
        `;
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

// --- Battle Logic ---
function startBattle() {
    createGrid();
    renderGrid();
    
    // Spawn Timer
    let timeLeft = SPAWN_INTERVAL / 1000;
    spawnTimerId = setInterval(() => {
        if (currentState !== STATE.BATTLE) return;
        timeLeft -= 1;
        if (timeLeft <= 0) {
            spawnItem();
            timeLeft = SPAWN_INTERVAL / 1000;
        }
        spawnTimerLabel.textContent = `${Math.ceil(timeLeft)}s`;
    }, 1000);

    // Enemy Spawner
    enemySpawnerId = setInterval(() => {
        if (currentState !== STATE.BATTLE) return;
        spawnEnemy();
    }, ENEMY_SPAWN_INTERVAL);
}

function createGrid() {
    mergeGrid.innerHTML = '';
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const slot = document.createElement('div');
        slot.classList.add('grid-slot');
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => handleDrop(e, i));
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
            item.draggable = true;
            item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', i));
            slot.appendChild(item);
        }
    });
}

function handleDrop(e, targetIdx) {
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(sourceIdx)) return;
    
    const s = grid[sourceIdx];
    const t = grid[targetIdx];
    if (!s) return;

    if (!t) {
        grid[targetIdx] = s;
        grid[sourceIdx] = null;
    } else if (s.type === t.type && s.level === t.level) {
        grid[targetIdx] = { type: s.type, level: s.level + 1 };
        grid[sourceIdx] = null;
        score += (s.level + 1) * 10;
    }
    renderGrid();
}

// Battle UI Drop
battleField.addEventListener('dragover', (e) => e.preventDefault());
battleField.addEventListener('drop', (e) => {
    e.preventDefault();
    const idx = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(idx)) return;
    const unit = grid[idx];
    if (unit && unit.level >= 1) {
        deployUnit(unit);
        grid[idx] = null;
        renderGrid();
    }
});

function deployUnit(unitData) {
    const data = UNIT_TYPES[unitData.type];
    const el = document.createElement('div');
    el.classList.add('battle-unit');
    el.style.background = data.color;
    el.innerHTML = `<span>Lv${unitData.level}</span>`;
    battleContainer.appendChild(el);

    activeUnits.push({
        ...unitData, x: 0, y: Math.random() * 70 + 15,
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
        type: 'SKELETON', x: 100, y: Math.random() * 70 + 15,
        hp: data.stats.hp, atk: data.stats.atk, spd: data.stats.spd, el: el
    });
}

// --- Game Loop ---
function gameLoop(time) {
    if (currentState === STATE.BATTLE) {
        updateEntities();
        checkCollisions(time);
        cleanupEntities();
        updateUI();
    }
    requestAnimationFrame(gameLoop);
}

function updateEntities() {
    const width = battleContainer.clientWidth || 800;
    activeUnits.forEach(u => {
        if (!u.isFighting) u.x += (u.spd / width) * 100 * 0.5;
        u.el.style.left = `${u.x}%`;
        u.el.style.top = `${u.y}%`;
        if (u.x >= 100) { enemyHp = Math.max(0, enemyHp - u.atk); u.hp = 0; }
        u.isFighting = false;
    });
    activeEnemies.forEach(e => {
        if (!e.isFighting) e.x -= (e.spd / width) * 100 * 0.5;
        e.el.style.left = `${e.x}%`;
        e.el.style.top = `${e.y}%`;
        if (e.x <= 0) { playerHp = Math.max(0, playerHp - e.atk); e.hp = 0; }
        e.isFighting = false;
    });
}

function checkCollisions(time) {
    activeUnits.forEach(u => {
        activeEnemies.forEach(e => {
            if (Math.abs(u.x - e.x) < 6 && Math.abs(u.y - e.y) < 15) {
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

function updateUI() {
    scoreLabel.textContent = score;
    document.getElementById('player-hp-fill').style.width = `${playerHp}%`;
    document.getElementById('enemy-hp-fill').style.width = `${enemyHp}%`;
    if (enemyHp <= 0 || playerHp <= 0) changeState(STATE.RESULT);
}

// --- Result Screen ---
function showResultScreen() {
    const title = document.getElementById('result-title');
    title.textContent = enemyHp <= 0 ? "VICTORY!" : "DEFEAT...";
    title.style.color = enemyHp <= 0 ? "var(--hp-player)" : "var(--hp-enemy)";
    document.getElementById('final-score').textContent = score;
}

// --- Debug ---
function setupDebugCommands() {
    window.gameDebug = {
        deploy: (type, lv) => deployUnit({ type, level: lv }),
        spawnEnemy: () => spawnEnemy(),
        changeState: (s) => changeState(s)
    };
}

init();
