const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const top_speed = 1;
const player_starting_pos = {
    x: 10,
    y: 10
}
const player_width = 20;
const player_height = 20;

let player;

function Player(){
    this.x = player_starting_pos.x;
    this.y = player_starting_pos.y;
    this.width = player_width;
    this.height = player_height;
    this.dx = 0;
    this.dy = 0;

    this.update = function(){
        if(this.x + this.dx + this.width < canvas.width){
            this.x += this.dx;
        }
        if(this.y + this.dy + this.height < canvas.height){
            this.y += this.dy;
        }
    }

    this.draw = function(){
        ctx.fillStyle = "rgba(255,0,0,1)"
        ctx.fillRect(this.x,this.y,this.width,this.height);
    }
}

function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function loop(){
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.fillRect(0,0,canvas.width,canvas.height)
    player.update();
    player.draw();
    requestAnimationFrame(loop)
}

function start(){
    resize();
    player = new Player()
    loop();
}

document.addEventListener('keydown',(event)=>{
    let key = (event.key).toLocaleLowerCase();
    if(key == "w"){
        player.dy = -2;
    }else if(key == "a"){
        player.dx = -2;
    }else if(key == "s"){
        player.dy = 2;
    }else if(key == "d"){
        player.dx = 2;
    }
});

document.addEventListener('keyup',(event)=>{
    let key = (event.key).toLocaleLowerCase();
    if(key == "w"){
        player.dy = 2;
    }else if(key == "a"){
        player.dx = 2;
    }else if(key == "s"){
        player.dy = -2;
    }else if(key == "d"){
        player.dx = -2;
    }
})

start();