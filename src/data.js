export const UNIT_TYPES = {
    SOLDIER: {
        id: 'SOLDIER',
        name: 'ソルジャー',
        icon: '⚔️',
        description: '平均的な能力を持つ歩兵。',
        color: '#4ade80', // Green
        stats: { hp: 100, atk: 10, spd: 2, range: 40 }
    },
    ARCHER: {
        id: 'ARCHER',
        name: 'アーチャー',
        icon: '🏹',
        description: '射程が長く、遠くから攻撃可能。',
        color: '#60a5fa', // Blue
        stats: { hp: 60, atk: 8, spd: 1.5, range: 150 }
    },
    KNIGHT: {
        id: 'KNIGHT',
        name: 'ナイト',
        icon: '🛡️',
        description: '高いHPで前線を維持する盾役。',
        color: '#fbbf24', // Yellow
        stats: { hp: 400, atk: 5, spd: 1, range: 30 }
    },
    ROGUE: {
        id: 'ROGUE',
        name: 'ローグ',
        icon: '🗡️',
        description: '移動が速く、攻撃頻度も高い。',
        color: '#f472b6', // Pink
        stats: { hp: 70, atk: 15, spd: 3.5, range: 30 }
    },
    MAGE: {
        id: 'MAGE',
        name: 'メイジ',
        icon: '✨',
        description: '攻撃速度は遅いが、威力は絶大。',
        color: '#a78bfa', // Purple
        stats: { hp: 50, atk: 30, spd: 1, range: 120 }
    }
};

export const ENEMY_TYPES = {
    SKELETON: {
        id: 'SKELETON',
        name: 'スケルトン',
        icon: '💀',
        color: '#e2e8f0', // Whiteish
        stats: { hp: 100, atk: 10, spd: 1, range: 30 }
    },
    LARGE_SKELETON: {
        id: 'LARGE_SKELETON',
        name: 'ラージスケルトン',
        icon: '☠️',
        color: '#94a3b8', // Grayish
        stats: { hp: 400, atk: 30, spd: 0.7, range: 40 }
    }
};

export const STAGES = [
    {
        id: 1,
        title: "はじまりの草原",
        enemies: ["SKELETON"],
        difficulty: 1
    },
    {
        id: 2,
        title: "静かな森",
        enemies: ["GOBLIN", "SKELETON"],
        difficulty: 2
    }
];
