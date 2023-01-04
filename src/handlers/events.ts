import { readdirSync } from 'fs';
import path from 'path';
import { client } from '..';
import { DiscordEvent } from '../typings/main';

/** Adds all events to the client */
export async function execute(
): Promise<void> {

	process.on('unhandledRejection', async (err) => {
		console.error('Unhandled Promise Rejection:\n', err);
	});
	process.on('uncaughtException', async (err) => {
		console.error('Uncaught Promise Exception:\n', err);
	});
	process.on('uncaughtExceptionMonitor', async (err) => {
		console.error('Uncaught Promise Exception (Monitor):\n', err);
	});

	await Promise.all(
		readdirSync(path.join(__dirname, '../events')).map((file) => import(`../events/${file}`)),
	).then(function(modules) {

		modules.forEach(function({ event }: {event: DiscordEvent}) {

			console.log(`Activated ${event.name} event`);
			if (event.once) {

				client.once(event.name, (...args) => {
					try { event.execute(...args); }
					catch (error) { console.error(error); }
				});
			}
			else {

				client.on(event.name, (...args) => {
					try { event.execute(...args); }
					catch (error) { console.error(error); }
				});
			}
		});
	});
}