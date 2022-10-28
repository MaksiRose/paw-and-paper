import { ActivityType } from 'discord.js';
import { client } from '..';
import { DiscordEvent } from '../typings/main';

export const event: DiscordEvent = {
	name: 'shardReady',
	once: false,
	async execute() {

		client.user?.setActivity('/help', { type: ActivityType.Listening });
	},
};