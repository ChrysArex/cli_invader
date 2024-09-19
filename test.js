import { WebSocket } from 'ws';
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from 'uuid';

process.stdin.setRawMode(true);
process.stdin.resume()
let vessel = ' ____/\\____\n' + '/|||| ||||\\';
const id = uuidv4();
const client = new WebSocket('ws://localhost:3000/start');
client.on('open', () => {
	let posX = '';
	client.send(`id_${id}`);
	console.log(vessel);
	process.stdin.on('data', (data) => {
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
                } 
		vessel = posX + ' ____/\\____\n' + posX + '/|||| ||||\\';
		console.log(eraseLines(3) + vessel);
		client.send(id + '_' + posX);
	}) 
});

client.on('message', (message) => {
	const adversaryPosX = message.toString();
	const adversary = adversaryPosX + '\\\\dest_234//\n' + adversaryPosX + ' ***** ****\n' + adversaryPosX + '     \\/';
	let space = '\n'
	for(let i = 0; i < 10; i = i + 1) {
		space = space + '\n';
	}
	console.clear();
	console.log(adversary + space + vessel);
})
