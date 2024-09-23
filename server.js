import express from 'express';
import expressWs from 'express-ws';
import { eraseLines } from 'ansi-escapes';
import { v4 as uuidv4 } from 'uuid';


function broadcast(action, id, data) {
	players.forEach((player) => {
		if (player.id !== id) {
			console.log(`Player ${player.id} ${action}`);
			player.ws.send(`${action}_${id}_${data}`);
		}
	})
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function shoot(action, id, data) {
	let fireY = '';
	data = data + '      ';
	while(fireY.length !== 10) {
		fireY = fireY + '\n';
		broadcast(action, id, `${data},${fireY}`);
		await sleep(100);
	}
}

const app = express();
const players = []
expressWs(app);

app.ws('/start', (ws, req) => {
	ws.on('message', async (message) => {
		const action = message.toString().split('_')[0];
		const id = message.toString().split('_')[1];
                const data = message.toString().split('_')[2];
		if (action === 'login') {
			const player = {'ws': ws, 'id': id}
			players.push(player);
			console.log(`player ${player.id} connected!!!`);
		} else if (action === 'fire') {
			await shoot(action, id, data);
		}
		broadcast(action, id, data);
	})
})

app.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
