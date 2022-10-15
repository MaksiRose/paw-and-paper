import { Guild } from 'discord.js';
import { client } from '../index';
import { DiscordEvent } from '../typedef';
import { deleteGuild } from '../utils/updateGuild';

export const event: DiscordEvent = {
	name: 'guildDelete',
	once: false,
	async execute(guild: Guild) {

		if (!guild.available) { return; }
		console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully removed the bot - it is now in ${(await client.guilds.fetch()).size} servers`);
		await deleteGuild(guild.id).catch(() => { return; });
	},
};