import { eraseLines } from "ansi-escapes";

function starShip(posX) {
	const vessel = posX + ' ____/\\____\n' + posX + '/|||| ||||\\';
	return vessel;
}

setInterval(() => {
	process.stdout.write(eraseLines(2) + starShip(''));

}, 1000)
