import { DiscordEvent } from '../typings/main';

export const event: DiscordEvent = {
	name: 'warn',
	once: false,
	async execute(info: string) {

		console.log('Discord\'s warn event was triggered with the following info:\n', info);
	},
};