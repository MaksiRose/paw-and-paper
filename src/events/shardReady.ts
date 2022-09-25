import { ActivityType } from 'discord.js';
import { CustomClient, DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'shardReady',
	once: false,
	async execute(client: CustomClient) {

		client.user?.setActivity('/help', { type: ActivityType.Listening });
	},
};