import { Guild } from 'discord.js';
import { client } from '../client';
import { DiscordEvent } from '../typings/main';
import { createGuild } from '../utils/updateGuild';

export const event: DiscordEvent = {
	name: 'guildCreate',
	once: false,
	async execute(guild: Guild) {

		console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully added the bot - It is now in ${(await client.guilds.fetch()).size} servers`);
		await createGuild(guild)
			.catch((error) => { console.error(error); });
	},
};