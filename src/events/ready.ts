import { DiscordEvent } from '../typings/main';
import { ActivityType } from 'discord.js';
import { client } from '..';
import { applicationCommands, applicationCommandsGuilds } from '../handlers/commands';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute() {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		if (!client.isReady()) { return; }
		await client.application.commands.set(applicationCommands);
		for (const [guildId, applicationCommandsGuild] of applicationCommandsGuilds) {
			await client.application.commands.set(applicationCommandsGuild, guildId);
		}
	},
};