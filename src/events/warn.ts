import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'warn',
	once: false,
	async execute(client, info: string) {

		console.log('Discord\'s warn event was triggered with the following info:\n', info);
	},
};