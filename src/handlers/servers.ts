import { client } from '..';
import serverModel from '../models/serverModel';
import { createGuild } from '../utils/updateGuild';

/** It updates the database to reflect the current state of the servers */
export async function execute(
): Promise<void> {

	/* This updates each server to set currentlyVisiting to null. */
	const servers = serverModel.find();

	/* For each server, it is updating the servers name in the database and adding an entry
		to the database if the server doesn't have one. */
	const allServers = await client.guilds.fetch();
	for (const OAuth2Guild of allServers.values()) {

		try {

			const server = servers.find(s => s.serverId === OAuth2Guild.id);
			if (!server) { throw new Error('server is undefined'); }
			if (server.name === OAuth2Guild.name) { continue; }
			serverModel.findOneAndUpdate(
				s => s.serverId === OAuth2Guild.id,
				s => { s.name = OAuth2Guild.name; },
			);
		}
		catch {

			const guild = await client.guilds.fetch(OAuth2Guild.id);
			await createGuild(guild)
				.catch(async (error) => { console.error(error); });
		}
	}
}