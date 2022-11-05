import { readdirSync } from 'fs';
import { DiscordEvent } from '../typings/main';
import { ActivityType } from 'discord.js';
import path from 'path';
import { client } from '../client';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute() {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		/* It's loading all the files in the handlers folder. */
		for (const file of readdirSync(path.join(__dirname, '../handlers'))) {

			try { await require(`../handlers/${file}`).execute(); }
			catch (error) { console.error(error); }
		}
	},
};