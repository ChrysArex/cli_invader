import { WebSocket } from 'ws';
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from 'uuid';


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function shoot(data) {
        let laserY = '\n\n\n\n\n\n\n\n\n\n\n';
        data = data + '      ';
        while(laserY.length !== 0) {
                laserY = laserY.slice(0, laserY.length - 1);
                let adversary = adversaryPosX ? adversaryPosX + '\\\\dest_234//\n' + adversaryPosX + ' ***** ****\n' + adversaryPosX + '     \\/' : '';
        	let laser = laserY ? laserY + data + '|' : '';
		let space = '\n';
        	for(let i = 0; i < (10 - laserY.length); i = i + 1) {
                	space = space + '\n';
        	}
		if (laserY.length === 0 && data.length >= adversaryPosX.length && data.length <= adversaryPosX.length + 10) {
			laser = laserY;
			adversary = adversaryPosX + '\\\\dest_234//\n' + adversaryPosX + ' * * * * * * * * *\n' + adversaryPosX + '     /\\';
			console.clear();
			console.log(adversary + laser + space + vessel);
			await sleep(200);
			adversary = adversaryPosX + '\\\\dest_234//\n' + adversaryPosX + ' ***** ****\n' + adversaryPosX + '     \\/';
		}
        	console.clear();
        	console.log(adversary + laser + space + vessel);
                await sleep(100);
        }
}


process.stdin.setRawMode(true);
process.stdin.resume()

const id = uuidv4();

let vessel = ' ____/\\____\n' + '/|||| ||||\\';

//opponent and self horizotal position
let adversaryPosX = '';
let posX = '';

const client = new WebSocket('ws://localhost:3000/start');
client.on('open', () => {
	client.send(`login_${id}_${posX}`);
	console.log(vessel);
	process.stdin.on('data', async (data) => {
		if (data.toString() === '\u001b') {
			process.exit();
		} else if (data.toString() === '\x1b[C') {
			if (posX.length <= 60) {
				posX = posX + ' ';
			}
		} else if (data.toString() === '\x1b[D') {
                        if (posX.length >= 1) {
                                posX = posX.slice(0, posX.length - 1);
                        }
                } else if (data.toString() === ' ') {
			client.send(`fire_${id}_${posX}`);
			await shoot(posX);
		}
		vessel = posX + ' ____/\\____\n' + posX + '/|||| ||||\\';
		console.log(eraseLines(3) + vessel);
		client.send(`move_${id}_${posX}`);
	}) 
});

client.on('message', (message) => {
	const action = message.toString().split('_')[0];
        const id = message.toString().split('_')[1];
        const data = message.toString().split('_')[2];
	let laserY = '';
	let shootPosX = '';
	let dammage = 0;
	if (action === 'fire') {
		shootPosX = data.split(',')[0];
		laserY = data.split(',')[1] ? data.split(',')[1] : '';
	} else if (action === 'move' || action === 'login'){
		adversaryPosX = data;
	}
	const adversary = adversaryPosX + '\\\\dest_234//\n' + adversaryPosX + ' ***** ****\n' + adversaryPosX + '     \\/';
	let space = '\n'
	let laser = laserY ? laserY + shootPosX + '|' : '';
	for(let i = 0; i < (12 - laserY.length); i = i + 1) {
		space = space + '\n';
	}
	if (laser && laserY.length === 12 && shootPosX.length >= posX.length && shootPosX.length <= posX.length + 10) {
		laser = laserY;
		vessel = posX + ' ----\\/----\n' + posX + '/|||| ||||\\';
		dammage = 10000;
	}
	console.clear();
	console.log(adversary + laser + space + vessel);
	setTimeout(() => {}, dammage);
	vessel = posX + ' ____/\\____\n' + posX + '/|||| ||||\\';
})
