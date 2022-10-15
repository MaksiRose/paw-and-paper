import { ActivityType } from 'discord.js';
import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'shardReady',
	once: false,
	async execute(client) {

		client.user?.setActivity('/help', { type: ActivityType.Listening });
	},
};