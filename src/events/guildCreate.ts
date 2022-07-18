import { Guild } from 'discord.js';
import { Event } from '../typedef';
import { createGuild } from '../utils/updateGuild';

export const event: Event = {
	name: 'guildCreate',
	once: false,
	async execute(client, guild: Guild) {

		console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully added the bot - It is now in ${client.guilds.cache.size} servers`);
		await createGuild(client, guild);
	},
};