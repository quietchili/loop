const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const roadThickness = 12;
const TOP_SPEED = 600;
const PLAYER_START_POS = {
    x: 0,
    y: 0
}
const CAR_TILE_WIDTH = 64;
const CAR_TILE_HEIGHT = 32;
const PLAYER_WIDTH = CAR_TILE_WIDTH;
const PLAYER_HEIGHT = CAR_TILE_HEIGHT;
const TILE_SIZE = 16;
const TILE_MAP_SRC = 'tilemap.png'; // HAS 1PX PADDING
const CARS_TILE_MAP_SRC = 'cars.png'; // HAS EVEN MORE PADDING: X: 32PX, Y: 24
const TILE_ROAD = 1;
const TILE_LAP_LINE = 2;
const TILE_CHECKPOINT = 3;
const MAX_LAPS = 3;

let gameState = 'notStarted'; // 'notStarted' | 'running' | 'playerWon' | 'aiWon'
let checkpoints = [];
let currentCheckpoint = 0;
let lapCount = 0;
let currentLapTime = 0;
let lapTimes = [];
let carsImg;
let tileMapImg;
let player;
let previoustime = 0;
let world = [];
let aiCar;
let aiCurrentLapTime = 0;
let aiLapTimes = [];
let countdownValue;
let countdownTimerId;

let music = document.getElementById('music');
document.getElementById("music").volume = 0.5; 


function drawStartScreen() {
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "36px sans-serif";
    ctx.fillText(
        "Click anywhere or press any key to start",
        canvas.width / 2,
        canvas.height / 2 - 60
    );


    ctx.font = "28px sans-serif";
    ctx.fillText(
        "Controls",
        canvas.width / 2,
        canvas.height / 2 - 10
    );

    ctx.font = "24px sans-serif";
    ctx.fillText(
        "W = Up   |   A = Left   |   S = Down   |   D = Right",
        canvas.width / 2,
        canvas.height / 2 + 30
    );

    ctx.font = "24px sans-serif";
    ctx.fillText(
        `Collect 4 checkpoints to complete a Lap. Finish ${MAX_LAPS} laps before the other car to win`,
        canvas.width / 2,
        canvas.height / 2 + 70
    );
}



function drawEndScreen() {
    //dim
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    //text
    ctx.fillStyle = "white";
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseLine = 'middle';

    let message = '';
    if (gameState === 'playerWon') {
        message = '🏁 You Win!'
    } else if (gameState === 'aiWon') {
        message = '🚩 You Lose!'
    }

    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function generateWorld(cols, rows, roadThickness) {
    const world = Array.from({ length: rows }, () => Array(cols).fill(0));

    // top & bottom horizontal strips
    for (let yOffset = 0; yOffset < roadThickness; yOffset++) {
        for (let x = 0; x < cols; x++) {
            world[yOffset][x] = 1;
            world[rows - 1 - yOffset][x] = 1;
        }
    }

    // left & right vertical strips
    for (let xOffset = 0; xOffset < roadThickness; xOffset++) {
        for (let y = 0; y < rows; y++) {
            world[y][xOffset] = 1;
            world[y][cols - 1 - xOffset] = 1;
        }
    }

    checkpoints = [
        // top-left
        { row: 0, col: 0, w: roadThickness, h: roadThickness, visible: true },
        // top-right
        { row: 0, col: cols - roadThickness, w: roadThickness, h: roadThickness, visible: true },
        // bottom-right
        { row: rows - roadThickness, col: cols - roadThickness, w: roadThickness, h: roadThickness, visible: true },
        // bottom-left
        { row: rows - roadThickness, col: 0, w: roadThickness, h: roadThickness, visible: true }
    ];

    // checkpoint tiles
    checkpoints.forEach(cp => {
        for (let dy = 0; dy < cp.h; dy++) {
            for (let dx = 0; dx < cp.w; dx++) {
                world[cp.row + dy][cp.col + dx] = TILE_CHECKPOINT;
            }
        }
    });

    return world;
}

function drawSprite(img, sprite_col, sprite_row, x, y, angle) {
    let col_padding = sprite_col;
    let row_padding = sprite_row;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(
        img,
        sprite_col * TILE_SIZE + col_padding,
        sprite_row * TILE_SIZE + row_padding,
        TILE_SIZE, TILE_SIZE,
        0, 0,
        TILE_SIZE, TILE_SIZE
    );
    ctx.restore();
}

class Player {
    constructor(startPos, size) {
        this.pos = { ...startPos };
        this.vel = { x: 0, y: 0 };
        this.acc = 800;
        this.frictionOnRoad = 0.9;
        this.frictionOffRoad = 0.3;
        this.width = size.width;
        this.height = size.height;
        this.input = { up: false, down: false, left: false, right: false }
        this.spriteRow = 0;
        this.spriteCol = 0;
        this.angle = 0;
        this.lastAngle = 0;
    }

    update(dt) {
        this.vel.x = (this.input.right - this.input.left) * TOP_SPEED;
        this.vel.y = (this.input.down - this.input.up) * TOP_SPEED;

        const cx = this.pos.x + this.width / 2;
        const cy = this.pos.y + this.height / 2;
        const col = Math.floor(cx / TILE_SIZE);
        const row = Math.floor(cy / TILE_SIZE);
        const tile = world[row]?.[col];
        const friction = tile === 0 ? this.frictionOffRoad : this.frictionOnRoad;

        this.vel.x *= friction;
        this.vel.y *= friction;

        this.pos.x = Math.max(0, Math.min(canvas.width - this.width, this.pos.x + this.vel.x * dt));
        this.pos.y = Math.max(0, Math.min(canvas.height - this.height, this.pos.y + this.vel.y * dt));

        this.angle = Math.atan2(this.vel.y, this.vel.x);
        if (this.vel.x != 0 || this.vel.y != 0) {
            this.lastAngle = this.angle;
        }

    }

    draw(ctx, image) {

        const cx = this.pos.x + this.width / 2;
        const cy = this.pos.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.lastAngle + Math.PI);
        ctx.drawImage(
            image,
            this.spriteCol, this.spriteRow,
            this.width, this.height,
            -this.width / 2,
            -this.height / 2,
            this.width, this.height
        );
        ctx.restore();

        // ctx.strokeStyle = "rgba(255,0,0,1)";
        // ctx.strokeRect(this.pos.x, this.pos.y, this.width, this.height);
    };
}

class AICar {
    constructor(startPos, size) {
        this.pos = { ...startPos };
        this.vel = { x: 0, y: 0 };
        this.width = size.width;
        this.height = size.height;
        this.angle = 0;
        this.lastAngle = 0;
        this.currentWaypoint = 0;
        this.checkpointCount = 0;
        this.lapCount = 0;
    }

    update(dt) {
        const cp = checkpoints[this.currentWaypoint];
        const targetX = (cp.col + cp.w / 2) * TILE_SIZE - this.width / 2;
        const targetY = (cp.row + cp.h / 2) * TILE_SIZE - this.height / 2;
        const dx = targetX - this.pos.x;
        const dy = targetY - this.pos.y;
        const dist = Math.hypot(dx, dy);
        const speed = TOP_SPEED * 0.9;

        if (dist > 2) {
            this.vel.x = (dx / dist) * speed;
            this.vel.y = (dy / dist) * speed;
        } else {
            this.currentWaypoint = (this.currentWaypoint + 1) % checkpoints.length;
            this.checkpointCount++;
            if (this.currentWaypoint === 0) {
                this.lapCount++;
                this.checkpointCount = 0;
            }

        }

        const cx = this.pos.x + this.width / 2;
        const cy = this.pos.y + this.height / 2;
        const col = Math.floor(cx / TILE_SIZE);
        const row = Math.floor(cy / TILE_SIZE);
        const tile = world[row]?.[col];
        const friction = tile === 0 ? 0.3 : 0.9;

        this.vel.x *= friction;
        this.vel.y *= friction;
        this.pos.x = Math.max(0, Math.min(canvas.width - this.width, this.pos.x + this.vel.x * dt));
        this.pos.y = Math.max(0, Math.min(canvas.height - this.height, this.pos.y + this.vel.y * dt));

        this.angle = Math.atan2(this.vel.y, this.vel.x);
        if (this.vel.x !== 0 || this.vel.y !== 0) {
            this.lastAngle = this.angle;
        }
    }

    draw(ctx, image) {
        const cx = this.pos.x + this.width / 2;
        const cy = this.pos.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.lastAngle + Math.PI);

        const spriteCol = 12 * 8;
        const spriteRow = 0;
        ctx.drawImage(
            image,
            spriteCol, spriteRow,
            this.width, this.height,
            -this.width / 2, -this.height / 2,
            this.width, this.height
        );

        ctx.restore();
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (!world.length) {
        const cols = Math.floor(canvas.width / TILE_SIZE);
        const rows = Math.floor(canvas.height / TILE_SIZE);

        world = generateWorld(cols, rows, roadThickness);
    }
}

function update(dt) {
    if (gameState !== 'running') return;


    currentLapTime += dt;
    aiCurrentLapTime += dt;

    const oldAiLap = aiCar.lapCount;

    player.update(dt);

    aiCar.update(dt);

    const playerRect = {
        x: player.pos.x,
        y: player.pos.y,
        width: player.width,
        height: player.height
    };

    checkpoints.forEach(cp => {
        if (!cp.visible) return;

        const cpRect = {
            x: cp.col * TILE_SIZE,
            y: cp.row * TILE_SIZE,
            width: cp.w * TILE_SIZE,
            height: cp.h * TILE_SIZE
        };

        if (
            playerRect.x < cpRect.x + cpRect.width &&
            playerRect.x + playerRect.width > cpRect.x &&
            playerRect.y < cpRect.y + cpRect.height &&
            playerRect.y + playerRect.height > cpRect.y
        ) {
            cp.visible = false;
        }
    });

    // If every checkpoint is now invisible, complete the lap
    const allCollected = checkpoints.every(cp => !cp.visible);
    if (allCollected) {
        lapCount += 1;
        lapTimes.push(currentLapTime);
        currentLapTime = 0;
        // reset all checkpoints
        checkpoints.forEach(cp => cp.visible = true);
    }

    if (aiCar.lapCount > oldAiLap) {
        aiLapTimes.push(aiCurrentLapTime);
        aiCurrentLapTime = 0;
    }

    // Check if player has won
    if (lapCount >= MAX_LAPS) {
        gameState = 'playerWon';
    } else if (aiCar.lapCount >= MAX_LAPS) {// Or if AI has won
        gameState = 'aiWon';
    }
}

function draw() {
    ctx.fillStyle = "rgba(0,0,0,0.1)" // dont use full opacity so there is end trails
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < world.length; i++) {
        for (let j = 0; j < world[i].length; j++) {
            const tile = world[i][j];
            let x = j * TILE_SIZE;
            let y = i * TILE_SIZE;
            // if (world[i][j] === 0) {
            // let x = j * TILE_SIZE;
            // let y = i * TILE_SIZE;
            // let sprite_col = 9;
            // let sprite_row = 7;
            // drawSprite(tileMapImg, sprite_col, sprite_row, x, y);

            // }
            if (tile === TILE_ROAD) {
                let sprite_col = 9;
                let sprite_row = 16;
                drawSprite(tileMapImg, sprite_col, sprite_row, x, y);

            }
            if (tile === TILE_LAP_LINE) {
                let sprite_col = 3;
                let sprite_row = 16;
                drawSprite(tileMapImg, sprite_col, sprite_row, x, y);

            }
            if (tile === TILE_CHECKPOINT) {
                let sprite_col = 1;
                let sprite_row = 1;
                // find which checkpoint owns this tile
                const idx = checkpoints.findIndex(cp =>
                    i >= cp.row && i < cp.row + cp.h &&
                    j >= cp.col && j < cp.col + cp.w
                );

                // draw it only if visible
                if (idx >= 0 && checkpoints[idx].visible) {
                    drawSprite(tileMapImg, sprite_col, sprite_row, x, y);
                    continue;
                }

            }
        }
    }
    player.draw(ctx, carsImg);

    aiCar.draw(ctx, carsImg);

    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = "20px sans-serif";
    ctx.fillText(`Laps: ${lapCount}`, 10, 24);
    ctx.fillText(`Lap Time: ${currentLapTime.toFixed(2)}`, 10, 48);

    if (lapTimes.length > 0) {
        const prev = lapTimes[lapTimes.length - 1].toFixed(2);
        ctx.fillText(`Previous Lap: ${prev}`, 10, 72);

        // shift AI stats down to make room
        ctx.fillText(`AI Checkpoints: ${aiCar.checkpointCount}/${checkpoints.length}`, 10, 96);
        ctx.fillText(`AI Laps: ${aiCar.lapCount}`, 10, 120);

        if (aiLapTimes.length > 0) {
            const aiPrev = aiLapTimes[aiLapTimes.length - 1].toFixed(2);
            ctx.fillText(`AI Prev Lap Time: ${aiPrev}`, 10, 144);
        }
    } else {
        // no previous lap yet, draw AI stats in original slots
        ctx.fillText(`AI Checkpoints: ${aiCar.checkpointCount}/${checkpoints.length}`, 10, 72);
        ctx.fillText(`AI Laps: ${aiCar.lapCount}`, 10, 96);
        if (aiLapTimes.length > 0) {
            const aiPrev = aiLapTimes[aiLapTimes.length - 1].toFixed(2);
            ctx.fillText(`AI Prev Lap Time: ${aiPrev}`, 10, 120);
        }
    }
    ctx.restore();

    if (gameState === 'countdown') {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 96px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = countdownValue > 0
            ? countdownValue
            : 'START!';

        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }

}


function loop(currentTime) {
    const dt = Math.min((currentTime - previoustime) / 1000, 0.1);
    previoustime = currentTime;

    if (gameState === 'running') {
        update(dt);
    }
    draw();
    if (gameState === 'playerWon' || gameState === 'aiWon') {
        drawEndScreen();
        return;
    }

    if (gameState !== 'running') {
        requestAnimationFrame(loop);
        return;
    }

    requestAnimationFrame(loop);
}


function loadImage(image) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = image;
        img.onload = () => {
            resolve(img);
        }
        img.onerror = () => {
            reject('Error loading image:', image);
        }

    })
}

function start() {
    music.play();
    // reset car positions
    player.pos = { ...PLAYER_START_POS };
    aiCar.pos = { ...PLAYER_START_POS };

    resize();

    gameState = 'countdown';
    countdownValue = 3;

    previoustime = performance.now();
    requestAnimationFrame(loop);

    countdownTimerId = setInterval(() => {
        countdownValue--;

        if (countdownValue < 0) {
            clearInterval(countdownTimerId);
            gameState = 'running';
        }
    }, 1000);
}

const keysMap = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowDown: 'down',
    ArrowRight: 'right'
};

document.addEventListener('keydown', (event) => {
    if (gameState === 'notStarted') {
        start();
    }
    const dir = keysMap[event.key.toLocaleLowerCase()];
    if (dir) player.input[dir] = true;
});

document.addEventListener('keyup', (event) => {
    const dir = keysMap[event.key.toLocaleLowerCase()];
    if (dir) player.input[dir] = false;
});

window.addEventListener('resize', resize);

document.addEventListener('mousedown', (event) => {
    if (gameState === 'notStarted') {
        start();
    }
})

async function init() {

    ctx.imageSmoothingEnabled = false;
    ctx.scale(2, 2);

    try {
        [tileMapImg, carsImg] = await Promise.all([
            loadImage(TILE_MAP_SRC),
            loadImage(CARS_TILE_MAP_SRC),
        ]);
        player = new Player(PLAYER_START_POS, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT });

        aiCar = new AICar(
            { x: PLAYER_START_POS.x, y: PLAYER_START_POS.y },
            { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }
        );

        previoustime = performance.now();

        resize();

        drawStartScreen();


    } catch (error) {
        console.log(error)
    }

}

init();