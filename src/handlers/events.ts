import { readdirSync } from 'fs';
import { CustomClient, Event } from '../typedef';

/** Starts up all the `listeners` based on their `eventName` and whether or not their are one-time. */
export function execute(client: CustomClient) {

	for (const file of readdirSync('./dist/events/')) {

		const event: Event = require(`../events/${file}`);
		if (event.once) {

			client.once(event.name, (...args) => event.execute(client, ...args));
		}
		else {

			client.on(event.name, (...args) => event.execute(client, ...args));
		}
	}
}