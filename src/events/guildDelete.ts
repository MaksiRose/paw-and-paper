import { Guild } from 'discord.js';
import { CustomClient, Event } from '../typedef';
import { deleteGuild } from '../utils/updateGuild';

export const event: Event = {
	name: 'guildDelete',
	once: false,
	async execute(client: CustomClient, guild: Guild) {

		console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully removed the bot - it is now in ${client.guilds.cache.size} servers`);
		await deleteGuild(guild.id);
	},
};