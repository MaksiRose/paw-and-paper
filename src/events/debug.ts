import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'debug',
	once: false,
	async execute(info: string) {

		console.log(info);
	},
};