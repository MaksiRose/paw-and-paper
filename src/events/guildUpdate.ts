import { Guild } from 'discord.js';
import serverModel from '../models/serverModel';
import { CustomClient, Event } from '../typedef';

export const event: Event = {
	name: 'guildUpdate',
	once: false,
	async execute(client: CustomClient, oldGuild: Guild, newGuild: Guild) {

		await serverModel.findOneAndUpdate(
			{ serverId: newGuild.id },
			(s) => {
				s.name = newGuild.name;
			},
		);
	},
};