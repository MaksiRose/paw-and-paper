import { client } from '../cluster';
import Server from '../models/server';
import { createGuild } from '../utils/updateGuild';

/** It updates the database to reflect the current state of the servers */
export async function execute(
): Promise<void> {

	/* For each server, it is updating the servers name in the database and adding an entry
		to the database if the server doesn't have one. */
	const allServers = await client.guilds.fetch();
	for (const OAuth2Guild of allServers.values()) {

		const partialServer = await Server.findByPk(OAuth2Guild.id, { attributes: ['id'] });
		if (!partialServer) {

			const guild = await client.guilds.fetch(OAuth2Guild.id);
			await createGuild(guild)
				.catch(async (error) => { console.error(error); });
		}
	}
}