import { readdirSync } from 'fs';
import { DiscordEvent } from '../typings/main';
import { ActivityType } from 'discord.js';
import path from 'path';
import { client } from '..';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute() {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		/* It's loading all the files in the handlers folder. */
		for (const file of readdirSync(path.join(__dirname, '../handlers'))) {

			console.log(`Execute handler ${file}...`);
			try { await require(`../handlers/${file}`).execute(); } // This waits for the command handler to be done, which is really slow because each file has to be required one after the other. For some reason, no other events play until this is finished.
			catch (error) { console.error(error); }
		}
	},
};