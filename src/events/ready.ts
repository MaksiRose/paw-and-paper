import { readdirSync } from 'fs';
import { CustomClient, DiscordEvent } from '../typedef';
import { ActivityType } from 'discord.js';
import path from 'path';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute(client: CustomClient) {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		/* It's loading all the files in the handlers folder. */
		for (const file of readdirSync(path.join(__dirname, '../handlers'))) {

			try { await require(`../handlers/${file}`).execute(client); }
			catch (error) { console.error(error); }
		}
	},
};