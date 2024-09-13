import { readdirSync } from 'fs';
import path from 'path';
import { client } from '../cluster';
import { DiscordEvent } from '../typings/main';

const events = new Map<string, (...args: any[]) => Promise<void>>();
let pendingOperations = 0;
let resolvePromise: (value: void | PromiseLike<void>) => void;

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

		modules.forEach(function({ event }: { event: DiscordEvent; }) {

			const func = async (...args: any[]) => {
				pendingOperations += 1;
				try { await event.execute(...args); }
				catch (error) { console.error(error); }
				finally {
					pendingOperations -= 1;
					if (pendingOperations === 0 && resolvePromise) { resolvePromise(); }
				}
			};
			events.set(event.name, func);

			if (event.once) { client.once(event.name, func); }
			else { client.on(event.name, func); }

			console.log(`Activated ${event.name} event`);
		});
	});
}

export function killEvents(
): void {

	client.removeAllListeners();
}

export function waitForOperations() {
	if (pendingOperations === 0) { return Promise.resolve(); }
	else {
		return new Promise<void>(resolve => { resolvePromise = resolve; });
	}
}