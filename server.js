import express from 'express';
import expressWs from 'express-ws';
import { eraseLines } from 'ansi-escapes';
import { v4 as uuidv4 } from 'uuid';


function broadcast(id, message) {
	players.forEach((player) => {
		if (player.id !== id) {
			console.log(`message sent to player ${player.id}`);
			player.ws.send(message);
		}
	})
}

const app = express();
const players = []
expressWs(app);

app.ws('/start', (ws, req) => {
	ws.on('message', (message) => {
		if (message.toString().slice(0, 2) === 'id'){
			const player = {'ws': ws, 'id': message.toString().split('_')[1]}
			players.push(player);
			console.log(`player ${player.id} connected!!!`);
		} else {
			const id = message.toString().split('_')[0];
			const posX = message.toString().split('_')[1];
			broadcast(id, posX);
		}
	})
})

app.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
