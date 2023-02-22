import { Guild } from 'discord.js';
import serverModel from '../oldModels/serverModel';
import { DiscordEvent } from '../typings/main';

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