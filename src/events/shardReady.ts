import { CustomClient, Event } from '../typedef';

export const event: Event = {
	name: 'shardReady',
	once: false,
	async execute(client: CustomClient) {

		client.user?.setActivity('/help', { type: 'PLAYING' });
	},
};