import { DiscordEvent } from '../typings/main';
import { ActivityType } from 'discord.js';
import { client } from '..';
import { readdirSync } from 'fs';
import path from 'path';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute() {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		/* It's loading all the files in the handlers folder. */
		readdirSync(path.join(__dirname, './handlers')).forEach(function(fileName) {

			console.log(`Execute handler ${fileName}...`);
			import(`./handlers/${fileName}`).then(function(module) { module.execute(); });
		});
	},
};