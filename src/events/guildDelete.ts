import { Guild } from 'discord.js';
import { client } from '../index';
import Server from '../models/server';
import { DiscordEvent } from '../typings/main';

export const event: DiscordEvent = {
	name: 'guildDelete',
	once: false,
	async execute(guild: Guild) {

		if (!guild.available) { return; }
		console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully removed the bot - it is now in ${client.guilds.cache.size} servers`);

		await Server.destroy({ where: { id: guild.id } });
	},
};