import { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { readdirSync, lstatSync } from 'fs';
import path from 'path';
import { handle } from '..';
import { SlashCommand, ContextMenuCommand } from '../typings/handle';

export const applicationCommands: Array<RESTPostAPIApplicationCommandsJSONBody> = [];
export const applicationCommandsGuilds: Map<string, Array<RESTPostAPIApplicationCommandsJSONBody>> = new Map();

/** Adds all commands to the client */
export async function execute(
): Promise<void> {

	/* Adds all commands to client.commands property, and to the applicationCommands array if the command.data is not undefined. */
	Promise.all(
		getFiles('../commands').map((commandPath) => import(commandPath)),
	).then(modules => modules.forEach(function({ command }: { command: SlashCommand; }) {

		if (command.data !== undefined) { applicationCommands.push(command.data); }
		handle.slashCommands.set(command.data.name, command);
		console.log(`Added ${command.data.name} to the slash commands`);
	}));

	Promise.all(
		getFiles('../contextmenu').map((commandPath) => import(commandPath)),
	).then(modules => modules.forEach(function({ command }: { command: ContextMenuCommand; }) {

		if (command.data !== undefined) { applicationCommands.push(command.data); }
		handle.contextMenuCommands.set(command.data.name, command);
		console.log(`Added ${command.data.name} to the context menu commands`);
	}));

	/* Registers the applicationCommands array to Discord. */
	for (const folderName of readdirSync(path.join(__dirname, '../commands_guild'))) {

		if (!lstatSync(path.join(__dirname, `../commands_guild/${folderName}`)).isDirectory()) { continue; }

		const applicationCommandsGuild: Array<RESTPostAPIApplicationCommandsJSONBody> = [];

		Promise.all(
			getFiles(`../commands_guild/${folderName}`).map((commandPath) => import(commandPath)),
		).then(modules => modules.forEach(function({ command }: { command: SlashCommand; }) {

			if (command.data !== undefined) { applicationCommandsGuild.push(command.data); }
			handle.slashCommands.set(command.data.name, command);
			console.log(`Added ${command.data.name} to the slash commands of guild ${folderName}`);
		})).finally(function() { applicationCommandsGuilds.set(folderName, applicationCommandsGuild); });
	}
}

/** Adds all file paths in a directory to an array and returns it */
function getFiles(
	directory: string,
): Array<string> {

	let commandFiles: Array<string> = [];

	for (const content of readdirSync(path.join(__dirname, directory))) {

		if (lstatSync(path.join(__dirname, `${directory}/${content}`)).isDirectory()) {

			commandFiles = [
				...commandFiles,
				...getFiles(`${directory}/${content}`),
			];
		}
		else if (content.endsWith('.js') || content.endsWith('.ts')) {

			commandFiles.push(`${directory}/${content.slice(0, -3)}`);
		}
	}

	return commandFiles;
}