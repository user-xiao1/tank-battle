const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const healthBar = document.getElementById('healthBar');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayScore = document.getElementById('overlayScore');
const restartBtn = document.getElementById('restartBtn');

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

const TANK_SIZE = 32;
const BULLET_SIZE = 6;
const ENEMY_SIZE = 30;
const WALL_SIZE = 40;

let gameRunning = true;
let score = 0;
let wave = 1;
let mouseX = 0;
let mouseY = 0;

const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectsIntersect(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

class Tank {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = TANK_SIZE;
        this.height = TANK_SIZE;
        this.angle = 0;
        this.speed = 4;
        this.color = color;
        this.hp = 100;
        this.maxHp = 100;
        this.lastShot = 0;
        this.cooldown = 300;
    }

    get rect() {
        return { x: this.x - this.width / 2, y: this.y - this.height / 2, w: this.width, h: this.height };
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 坦克履带
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-this.width / 2 - 2, -this.height / 2, 6, this.height);
        ctx.fillRect(this.width / 2 - 4, -this.height / 2, 6, this.height);

        // 坦克身体
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 6);
        ctx.fill();

        // 坦克炮塔
        ctx.fillStyle = shadeColor(this.color, -20);
        ctx.beginPath();
        ctx.arc(0, 0, this.width * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 炮管
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -4, this.width * 0.8, 8);

        ctx.restore();
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }

    canShoot(now) {
        return now - this.lastShot > this.cooldown;
    }
}

class Bullet {
    constructor(x, y, angle, isPlayer = true) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = isPlayer ? 10 : 7;
        this.radius = BULLET_SIZE;
        this.isPlayer = isPlayer;
        this.damage = isPlayer ? 25 : 15;
        this.active = true;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT) {
            this.active = false;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.isPlayer ? '#fbbf24' : '#f87171';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Enemy extends Tank {
    constructor(x, y) {
        super(x, y, '#ef4444');
        this.speed = rand(1.2, 2.0) + wave * 0.1;
        this.hp = 50 + wave * 10;
        this.maxHp = this.hp;
        this.cooldown = 1200 - Math.min(600, wave * 40);
        this.angle = Math.random() * Math.PI * 2;
    }

    update(player, walls) {
        const d = dist(this, player);
        const desiredAngle = Math.atan2(player.y - this.y, player.x - this.x);

        // 平滑转向
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.08;

        // 保持距离
        const stopDistance = 160;
        if (d > stopDistance) {
            const nx = Math.cos(this.angle) * this.speed;
            const ny = Math.sin(this.angle) * this.speed;
            this.tryMove(nx, 0, walls);
            this.tryMove(0, ny, walls);
        }

        // 射击
        if (d < 380 && Math.abs(diff) < 0.3 && this.canShoot(performance.now())) {
            this.lastShot = performance.now();
            bullets.push(new Bullet(
                this.x + Math.cos(this.angle) * this.width * 0.6,
                this.y + Math.sin(this.angle) * this.width * 0.6,
                this.angle,
                false
            ));
        }
    }

    tryMove(dx, dy, walls) {
        const next = { ...this.rect };
        next.x += dx;
        next.y += dy;
        if (!walls.some(w => rectsIntersect(next, w.rect)) &&
            next.x >= 0 && next.x + next.w <= GAME_WIDTH &&
            next.y >= 0 && next.y + next.h <= GAME_HEIGHT) {
            this.x += dx;
            this.y += dy;
        }
    }
}

class Wall {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    get rect() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    draw() {
        ctx.fillStyle = '#475569';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        // 砖块纹理
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (let i = this.x + 10; i < this.x + this.w; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, this.y);
            ctx.lineTo(i, this.y + this.h);
            ctx.stroke();
        }
        for (let i = this.y + 10; i < this.y + this.h; i += 20) {
            ctx.beginPath();
            ctx.moveTo(this.x, i);
            ctx.lineTo(this.x + this.w, i);
            ctx.stroke();
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = rand(-3, 3);
        this.vy = rand(-3, 3);
        this.life = 1.0;
        this.decay = rand(0.02, 0.05);
        this.color = color;
        this.size = rand(2, 5);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

let player;
let bullets = [];
let enemies = [];
let walls = [];
let particles = [];
let enemySpawnTimer = 0;
let enemiesToSpawn = 0;

function createMap() {
    walls = [];
    const patterns = [
        { x: 200, y: 160, w: 120, h: 40 },
        { x: 640, y: 160, w: 120, h: 40 },
        { x: 200, y: 440, w: 120, h: 40 },
        { x: 640, y: 440, w: 120, h: 40 },
        { x: 420, y: 80, w: 40, h: 120 },
        { x: 500, y: 440, w: 40, h: 120 },
        { x: 80, y: 300, w: 120, h: 40 },
        { x: 760, y: 300, w: 120, h: 40 },
        { x: 280, y: 280, w: 80, h: 80 }   // 已移离屏幕中央
    ];

    patterns.forEach(p => walls.push(new Wall(p.x, p.y, p.w, p.h)));
}

function isPositionSafe(x, y, size, minDistanceFromPlayer = 0) {
    const rect = { x: x - size / 2, y: y - size / 2, w: size, h: size };

    // 不能超出边界
    if (rect.x < 0 || rect.x + rect.w > GAME_WIDTH || rect.y < 0 || rect.y + rect.h > GAME_HEIGHT) {
        return false;
    }

    // 不能和墙体重叠
    if (walls.some(w => rectsIntersect(rect, w.rect))) {
        return false;
    }

    // 与玩家保持安全距离
    if (player && Math.hypot(x - player.x, y - player.y) < minDistanceFromPlayer) {
        return false;
    }

    return true;
}

function findSafePosition(size, minDistanceFromPlayer = 0, avoidEnemies = false) {
    // 优先尝试几个固定安全点
    const safePoints = [
        { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
        { x: 120, y: 120 },
        { x: GAME_WIDTH - 120, y: 120 },
        { x: 120, y: GAME_HEIGHT - 120 },
        { x: GAME_WIDTH - 120, y: GAME_HEIGHT - 120 },
        { x: GAME_WIDTH / 2, y: 100 },
        { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100 }
    ];

    for (const p of safePoints) {
        if (isPositionSafe(p.x, p.y, size, minDistanceFromPlayer)) {
            if (!avoidEnemies || !enemies.some(e => Math.hypot(p.x - e.x, p.y - e.y) < size * 1.5)) {
                return { x: p.x, y: p.y };
            }
        }
    }

    // 固定点都被占了再随机找
    let x, y;
    let attempts = 0;
    const maxAttempts = 500;

    do {
        x = rand(size, GAME_WIDTH - size);
        y = rand(size, GAME_HEIGHT - size);
        attempts++;

        if (avoidEnemies && enemies.some(e => Math.hypot(x - e.x, y - e.y) < size * 1.5)) {
            continue;
        }
    } while (!isPositionSafe(x, y, size, minDistanceFromPlayer) && attempts < maxAttempts);

    // 如果随机也找不到，返回左上角安全区（地图这里没墙）
    if (!isPositionSafe(x, y, size, minDistanceFromPlayer)) {
        return { x: 60, y: 60 };
    }

    return { x, y };
}

function spawnEnemy() {
    const pos = findSafePosition(ENEMY_SIZE, 300, true);
    enemies.push(new Enemy(pos.x, pos.y));
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function resetGame() {
    bullets = [];
    enemies = [];
    particles = [];
    score = 0;
    wave = 1;
    gameRunning = true;
    enemySpawnTimer = 0;
    enemiesToSpawn = 3;
    createMap();

    // 玩家出生在安全位置
    const pos = findSafePosition(TANK_SIZE);
    player = new Tank(pos.x, pos.y, '#22c55e');

    overlay.classList.add('hidden');
    updateHUD();
}

function updateHUD() {
    scoreEl.textContent = score;
    waveEl.textContent = wave;
    healthBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
}

function showGameOver() {
    gameRunning = false;
    overlayTitle.textContent = '游戏结束';
    overlayScore.textContent = `最终得分: ${score}`;
    overlay.classList.remove('hidden');
}

function updatePlayer() {
    let dx = 0;
    let dy = 0;
    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;
    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;

    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * player.speed;
        dy = (dy / len) * player.speed;

        // 分别移动并检测碰撞
        const nextX = { ...player.rect, x: player.rect.x + dx };
        if (!walls.some(w => rectsIntersect(nextX, w.rect)) &&
            nextX.x >= 0 && nextX.x + nextX.w <= GAME_WIDTH) {
            player.x += dx;
        }

        const nextY = { ...player.rect, y: player.rect.y + dy };
        if (!walls.some(w => rectsIntersect(nextY, w.rect)) &&
            nextY.y >= 0 && nextY.y + nextY.h <= GAME_HEIGHT) {
            player.y += dy;
        }
    }

    // 瞄准
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
}

function update() {
    if (!gameRunning) return;

    updatePlayer();

    // 生成敌人
    if (enemiesToSpawn > 0) {
        enemySpawnTimer--;
        if (enemySpawnTimer <= 0) {
            spawnEnemy();
            enemiesToSpawn--;
            enemySpawnTimer = 60;
        }
    } else if (enemies.length === 0) {
        wave++;
        enemiesToSpawn = 2 + Math.floor(wave * 1.5);
        enemySpawnTimer = 0;
    }

    // 敌人更新
    enemies.forEach(enemy => enemy.update(player, walls));

    // 子弹更新
    bullets.forEach(b => b.update());
    bullets = bullets.filter(b => b.active);

    // 子弹碰撞检测
    bullets.forEach(b => {
        if (!b.active) return;

        // 子弹打墙
        if (walls.some(w =>
            b.x > w.x && b.x < w.x + w.w &&
            b.y > w.y && b.y < w.y + w.h)) {
            b.active = false;
            createExplosion(b.x, b.y, '#94a3b8');
            return;
        }

        if (b.isPlayer) {
            enemies.forEach(e => {
                if (!b.active) return;
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.width / 2 + b.radius) {
                    e.takeDamage(b.damage);
                    b.active = false;
                    createExplosion(b.x, b.y, '#fbbf24');
                    if (e.hp <= 0) {
                        score += 100;
                        createExplosion(e.x, e.y, '#ef4444');
                    }
                }
            });
        } else {
            if (Math.hypot(b.x - player.x, b.y - player.y) < player.width / 2 + b.radius) {
                player.takeDamage(b.damage);
                b.active = false;
                createExplosion(b.x, b.y, '#f87171');
            }
        }
    });

    // 移除死亡敌人
    enemies = enemies.filter(e => e.hp > 0);

    // 粒子更新
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);

    // 玩家死亡
    if (player.hp <= 0) {
        createExplosion(player.x, player.y, '#22c55e');
        showGameOver();
    }

    updateHUD();
}

function draw() {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 网格背景
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GAME_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= GAME_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
        ctx.stroke();
    }

    walls.forEach(w => w.draw());
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());
    if (gameRunning) player.draw();
    particles.forEach(p => p.draw());
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function normalizeKey(key) {
    // 统一字母键为小写，保留方向键名称
    if (key && key.length === 1) return key.toLowerCase();
    return key;
}

// 输入事件
window.addEventListener('keydown', e => {
    const key = normalizeKey(e.key);
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
        e.preventDefault();
    }
    if (key === 'r') resetGame();
});

window.addEventListener('keyup', e => {
    const key = normalizeKey(e.key);
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
    mouseY = (e.clientY - rect.top) * (GAME_HEIGHT / rect.height);
});

window.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // 只响应左键
    if (!gameRunning) return;
    const now = performance.now();
    if (player.canShoot(now)) {
        player.lastShot = now;
        bullets.push(new Bullet(
            player.x + Math.cos(player.angle) * player.width * 0.6,
            player.y + Math.sin(player.angle) * player.width * 0.6,
            player.angle,
            true
        ));
    }
});

restartBtn.addEventListener('click', resetGame);

resetGame();
loop();
