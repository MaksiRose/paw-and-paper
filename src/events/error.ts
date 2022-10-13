import { DiscordEvent } from '../typedef';

export const event: DiscordEvent = {
	name: 'error',
	once: false,
	async execute(client, error: Error) {

		console.error(error);
	},
};