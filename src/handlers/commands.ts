import { applicationCommands, applicationCommandsGuilds, client } from '..';

/** Adds all commands to the client */
export async function execute(
): Promise<void> {

	// A check should be added that compares the current commands with the existing commands and only sets the commands when they differ from the existing commands
	if (!client.isReady()) { return; }
	await client.application.commands.set(applicationCommands);
	for (const [guildId, applicationCommandsGuild] of applicationCommandsGuilds) {
		await client.application.commands.set(applicationCommandsGuild, guildId);
	}
}

