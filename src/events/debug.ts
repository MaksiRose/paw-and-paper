import { Event } from '../typedef';

export const event: Event = {
	name: 'debug',
	once: false,
	async execute(client, info: string) {

		console.trace(info);
	},
};