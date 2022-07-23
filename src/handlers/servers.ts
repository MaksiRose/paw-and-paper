import { readdirSync } from 'fs';
import serverModel from '../models/serverModel';
import { ServerSchema } from '../typedef';

export async function execute() {

	const serverFiles = readdirSync('./database/servers').filter(file => file.endsWith('.json'));

	/* This updates each server to set currentlyVisiting to null. */
	for (const file of serverFiles) {

		await serverModel.findOneAndUpdate(
			s => s.uuid === file.replace('.json', ''),
			(s: ServerSchema) => {
				s.currentlyVisiting = null;
			},
		);
	}
}