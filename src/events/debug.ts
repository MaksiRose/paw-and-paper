import { Event } from '../typedef';

export const event: Event = {
	name: 'debug',
	once: false,
	async execute(client, info: string) {

		console.log('Discord\'s debug event was triggered with the following info:\n', info);
	},
};