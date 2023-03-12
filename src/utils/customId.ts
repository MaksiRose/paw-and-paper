import { AnySelectMenuInteraction } from 'discord.js';

export type DeconstructedCustomId<T extends string[]> = {
	/** This equals the name of the slash command this interaction belongs to */
	commandName: string;
	/** This can be a user.id, a quid.id, or a discordUser.id */
	executorId: string;
	/** These are additional arguments that were provided */
	args: T
}

/**
 * It takes a string like `commandName_arg1_arg2_arg3_@executorId` and returns an object like `{ commandName: 'commandName', executorId: 'executorId', args: ['arg1', 'arg2', 'arg3'] }`
 * @param {string} customId - The customId to deconstruct.
 * @returns A deconstructed customId.
 */
export function deconstructCustomId<T extends string[]>(
	customId: string,
): DeconstructedCustomId<T> | null {

	const args = customId.split('_');

	const commandName = args.shift();
	if (commandName === undefined) { return null; }

	const executorId = args.pop()?.replace('@', '');
	if (executorId === undefined) { return null; }

	return { commandName, executorId, args: args as T };
}

/**
 * It takes a command name, an executor ID, and an array of arguments, and returns a string that is command name, the arguments, and the executor ID
 * @param {string} commandName - The name of the command.
 * @param {string} executorId - The id of the executor that is executing the command.
 * @param {T} args - The arguments that the command was called with.
 * @returns A string
 */
export function constructCustomId<T extends string[]>(
	commandName: string,
	executorId: string,
	args: T,
): string {

	return `${commandName}_${args.join('_')}_@${executorId}`;
}

/**
 * It takes a AnySelectMenuInteraction and returns an array of strings
 * @param {AnySelectMenuInteraction} interaction - AnySelectMenuInteraction
 * @returns The first element of the array of values, split into its args.
 */
export function deconstructSelectOptions<T extends string[]>(
	interaction: AnySelectMenuInteraction,
): T[] {

	return interaction.values.map(value => value.split('_') as T);
}

/**
 * It takes an array of strings and returns a string
 * @param {T} args - An array of strings
 * @returns A string
 */
export function constructSelectOptions<T extends string[]>(
	args: T,
): string {

	return args.join('_');
}