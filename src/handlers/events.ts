import { readdirSync } from 'fs';
import { CustomClient, Event } from '../typedef';

/** Starts up all the `listeners` based on their `eventName` and whether or not their are one-time. */
export async function execute(client: CustomClient) {

	for (const file of readdirSync('./dist/events/')) {

		const { event } = require(`../events/${file}`) as { event: Event; };

		if (event.once) {

			client.once(event.name, (...args) => event.execute(client, ...args));
		}
		else {

			client.on(event.name, (...args) => event.execute(client, ...args));
		}
	}
}