import { Guild } from 'discord.js';
import serverModel from '../models/serverModel';
import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'guildUpdate',
	once: false,
	async execute(oldGuild: Guild, newGuild: Guild) {

		await serverModel.findOneAndUpdate(
			s => s.serverId === newGuild.id,
			(s) => {
				s.name = newGuild.name;
			},
		);
	},
};