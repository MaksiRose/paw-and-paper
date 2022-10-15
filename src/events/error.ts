import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'error',
	once: false,
	async execute(error: Error) {

		console.error(error);
	},
};