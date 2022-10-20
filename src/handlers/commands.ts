import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v9';
import { lstatSync, readdirSync } from 'fs';
import { ContextMenuCommand, SlashCommand } from '../typings/handle';
import path from 'path';
import { client, handle } from '..';

/** Adds all commands to the client */
export async function execute(
): Promise<void> {

	if (!client.application) { return; }

	const applicationCommands: Array<RESTPostAPIApplicationCommandsJSONBody> = [];
	/* Adds all commands to client.commands property, and to the applicationCommands array if
	the command.data is not undefined. */
	for (const commandPath of getFiles('../commands')) {

		const { command } = require(commandPath) as { command: SlashCommand; };
		if (command.data !== undefined) { applicationCommands.push(command.data); }
		handle.slashCommands.set(command.data.name, command);
	}

	for (const commandPath of getFiles('../contextmenu')) {

		const { command } = require(commandPath) as { command: ContextMenuCommand; };
		if (command.data !== undefined) { applicationCommands.push(command.data); }
		handle.contextMenuCommands.set(command.data.name, command);
	}

	/* Registers the applicationCommands array to Discord. */
	await client.application.commands.set(applicationCommands);


	for (const folderName of readdirSync(path.join(__dirname, '../commands_guild'))) {

		if (!lstatSync(path.join(__dirname, `../commands_guild/${folderName}`)).isDirectory()) { continue; }

		const applicationCommandsGuild: Array<RESTPostAPIApplicationCommandsJSONBody> = [];

		for (const commandPath of readdirSync(path.join(__dirname, `../commands_guild/${folderName}`))) {

			const { command } = require(`../commands_guild/${folderName}/${commandPath}`) as { command: SlashCommand; };
			if (command.data !== undefined) { applicationCommandsGuild.push(command.data); }
			handle.slashCommands.set(command.data.name, command);
		}

		await client.application.commands.set(applicationCommandsGuild, folderName);
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
		else if (content.endsWith('.js')) {

			commandFiles.push(`${directory}/${content.slice(0, -3)}`);
		}
	}

	return commandFiles;
}