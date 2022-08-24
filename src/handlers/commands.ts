import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v9';
import { lstatSync, readdirSync } from 'fs';
import { ContextMenuCommand, CustomClient, SlashCommand } from '../typedef';
import path from 'path';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

/** Adds all commands to the client */
export async function execute(
	client: CustomClient,
): Promise<void> {

	const applicationCommands: Array<RESTPostAPIApplicationCommandsJSONBody> = [];

	/* Adds all commands to client.commands property, and to the applicationCommands array if
	the command.data is not undefined. */
	for (const commandPath of getFiles('../commands')) {

		const { command } = require(commandPath) as { command: SlashCommand; };
		if (command.data !== undefined) { applicationCommands.push(command.data); }
		client.slashCommands[command.name] = command;
	}

	for (const commandPath of getFiles('../contextmenu')) {

		const { command } = require(commandPath) as { command: ContextMenuCommand; };
		if (command.data !== undefined) { applicationCommands.push(command.data); }
		client.contextMenuCommands[command.name] = command;
	}

	/* Registers the applicationCommands array to Discord. */
	if (!client.token || !client.user) { return; }

	const rest = new REST({ version: '9' }).setToken(client.token);

	await rest
		.put(
			Routes.applicationCommands(client.user.id),
			{ body: applicationCommands },
		)
		.catch(error => console.error(error));

	for (const folderName of readdirSync(path.join(__dirname, '../commands_guild'))) {

		if (!lstatSync(path.join(__dirname, `../commands_guild/${folderName}`)).isDirectory()) { continue; }

		const applicationCommandsGuild: Array<RESTPostAPIApplicationCommandsJSONBody> = [];

		for (const commandPath of readdirSync(path.join(__dirname, `../commands_guild/${folderName}`))) {

			const { command } = require(`../commands_guild/${folderName}/${commandPath}`) as { command: SlashCommand; };
			if (command.data !== undefined) { applicationCommandsGuild.push(command.data); }
			client.slashCommands[command.name] = command;
		}

		await rest
			.put(
				Routes.applicationGuildCommands(client.user.id, folderName),
				{ body: applicationCommandsGuild },
			)
			.catch(error => console.error(error));
	}
}

/** Adds all file paths in a directory to an array and returns it */
function getFiles(directory: string): Array<string> {

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