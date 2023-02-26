import { Guild } from 'discord.js';
import Server from '../models/server';
import { DiscordEvent } from '../typings/main';

export const event: DiscordEvent = {
	name: 'guildUpdate',
	once: false,
	async execute(oldGuild: Guild, newGuild: Guild) {

		if (oldGuild.name === newGuild.name) { return; }
		await Server.update({ name: newGuild.name }, { where: { id: newGuild.id } });
	},
};