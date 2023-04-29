import { DiscordEvent } from '../typings/main';
import { ActivityType, Client } from 'discord.js';
import { applicationCommands, applicationCommandsGuilds } from '../handlers/commands';
import { execute as executeServersHandler } from '../handlers/servers';

export const event: DiscordEvent = {
	name: 'ready',
	once: true,
	async execute(client: Client<true>) {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: ActivityType.Listening });

		await client.application.commands.set(applicationCommands);
		for (const [guildId, applicationCommandsGuild] of applicationCommandsGuilds) {
			await client.application.commands.set(applicationCommandsGuild, guildId);
		}

		executeServersHandler(client);
	},
};