import { generateId } from 'crystalid';
import { APIMessage } from 'discord-api-types/v9';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionType, Message, MessageComponentInteraction, MessageOptions, ModalSubmitInteraction, ReplyMessageOptions, WebhookEditMessageOptions } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { ErrorStacks } from '../typedef';
const { error_color } = require('../../config.json');

/**
 * It takes a map and a key, and returns the value associated with the key. If the value is undefined, it throws a type error instead.
 * @param map - An object with unknown keys and a property T
 * @param key - The key of the object to get T from
 * @returns T as the property from the key from the object
 */
export function getMapData<T>(
	map: Record<string, T>,
	key: string,
): T {
	const data = map[key];
	if (!data) throw new TypeError(`${key} is undefined`);
	return data;
}

export function getUserIds(
	message: Message,
): Array<string> {

	const array1 = message.mentions.users.map(u => u.id);
	const array2 = (message.content.match(/<@!?(\d{17,19})>/g) || [])?.map(mention => mention.replace('<@', '').replace('>', '').replace('!', ''));

	return [...new Set([...array1, ...array2])];
}

export type ReplyOrEditOptions = Pick<InteractionReplyOptions | WebhookEditMessageOptions, keyof (InteractionReplyOptions | WebhookEditMessageOptions)>
/**
 * It replies to an interaction, and if the interaction has already been replied to, it will edit or followup the reply instead.
 * @param interaction - The interaction object that was passed to the command handler.
 * @param options - WebhookEditMessageOptions & InteractionReplyOptions
 * @param editMessage - boolean - If true, the bot will edit the original message instead of sending a follow-up message.
 * @returns A promise that resolves to a Message<boolean>
 */
export async function respond(
	interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
	options: InteractionReplyOptions,
	editMessage: false,
): Promise<Message<boolean>>;
export async function respond(
	interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
	options: ReplyOrEditOptions,
	editMessage: true,
): Promise<Message<boolean>>;
export async function respond(
	interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
	options: WebhookEditMessageOptions | InteractionReplyOptions,
	editMessage: boolean,
): Promise<Message<boolean>> {

	let botReply: APIMessage | Message<boolean>;
	if (!interaction.replied && !interaction.deferred) {
		botReply = await interaction.reply({ ...options, fetchReply: true });
	}
	else if (editMessage) {
		botReply = await interaction.editReply(options);
	}
	else {
		botReply = await interaction.followUp(options);
	}

	if (botReply instanceof Message) { return botReply; }
	else { throw new Error('Message is APIMessage'); }
}

/**
 * It sends an error message to the user who executed the command, and logs the error to the console
 * @param interaction - The interaction that caused the error.
 * @param error - The error that was thrown.
 */

export async function sendErrorMessage(
	interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
	error: any,
): Promise<any> {

	if (interaction.type === InteractionType.ApplicationCommand) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to execute \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.isSelectMenu()) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to select \x1b[31m${interaction.values[0]} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.isButton()) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to click the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.type === InteractionType.ModalSubmit) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to submit the modal \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	console.error(error);

	let errorId: string | undefined = undefined;

	try {

		const errorStacks = JSON.parse(readFileSync('./database/errorStacks.json', 'utf-8')) as ErrorStacks;
		errorId = generateId();
		errorStacks[errorId] = error?.stack ?? String(error);
		writeFileSync('./database/errorStacks.json', JSON.stringify(errorStacks, null, '\t'));
	}
	catch (e) {

		errorId = undefined;
		console.error('Cannot edit file ', e);
	}

	const messageOptions: Pick<ReplyMessageOptions | WebhookEditMessageOptions | MessageOptions, keyof (ReplyMessageOptions | WebhookEditMessageOptions | MessageOptions)> = {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle('There was an unexpected error executing this command:')
			.setDescription(`\`\`\`${String(error).substring(0, 4090)}\`\`\``)
			.setFooter({ text: 'If this is the first time you encountered the issue, please report it using the button below. After that, only report it again if the issue was supposed to be fixed after an update came out. To receive updates, ask a server administrator to do the "getupdates" command.' })],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`report_${interaction.user.id}${errorId ? `_${errorId}` : ''}`)
				.setLabel('Report')
				.setStyle(ButtonStyle.Success)])],
	};

	await respond(interaction, { ...messageOptions, flags: undefined }, false)
		.catch(async (error2) => {

			console.error('Failed to send error message to user. ' + error2);
			await (async () => {
				if (interaction.isButton() || interaction.isSelectMenu()) { await interaction.message.reply({ ...messageOptions, failIfNotExists: false }); }
				if (interaction.isMessageContextMenuCommand()) { await interaction.targetMessage.reply({ ...messageOptions, failIfNotExists: false }); }
				if (interaction.isUserContextMenuCommand() || interaction.isChatInputCommand() || interaction.type === InteractionType.ModalSubmit) { await interaction.channel?.send(messageOptions); }
			})()
				.catch((error3) => {
					console.error('Failed to send backup error message to user. ' + error3);
				});
		});
}

/**
 * It recursively copies an object, array, date, or regular expression, and returns a copy of the original
 * @param {T} object - The object to be copied.
 * @returns A deep copy of the object.
 */
export const deepCopyObject = <T>(
	object: T,
): T => {

	let returnValue: T;

	switch (typeof object) {
		case 'object':

			if (object === null) {

				returnValue = null as unknown as T;
			}
			else {

				switch (Object.prototype.toString.call(object)) {
					case '[object Array]':

						returnValue = (object as unknown as any[]).map(deepCopyObject) as unknown as T;
						break;
					case '[object Date]':

						returnValue = new Date(object as unknown as Date) as unknown as T;
						break;
					case '[object RegExp]':

						returnValue = new RegExp(object as unknown as RegExp) as unknown as T;
						break;
					default:

						returnValue = Object.keys(object).reduce(function(prev: Record<string, any>, key) {
							prev[key] = deepCopyObject((object as unknown as Record<string, any>)[key]);
							return prev;
						}, {}) as unknown as T;
						break;
				}
			}
			break;
		default:

			returnValue = object;
			break;
	}

	return returnValue;
};

export type KeyOfUnion<T> = T extends object ? T extends T ? keyof T : never : never; // `T extends object` to filter out primitives like `string`
/* What this does is for every key in the inventory (like commonPlants, uncommonPlants etc.), it takes every single sub-key of all the keys and adds it to it. KeyOfUnion is  used to combine all those sub-keys from all the keys. In the case that they are not part of the property, they will be of type never, meaning that they can't accidentally be assigned anything (which makes the type-checking still work) */
export type WidenValues<T> = {
	[K in keyof T]: {
		[K2 in KeyOfUnion<T[keyof T]>]: K2 extends keyof T[K] ? T[K][K2] : never;
	};
};
export function widenValues<T>(obj: T): WidenValues<T> { return obj as any; }
export function unsafeKeys<T>(obj: T): KeyOfUnion<T>[] { return Object.keys(obj) as KeyOfUnion<T>[]; }
export function unsafeEntries<T>(obj: T): KeyOfUnion<T>[] { return Object.entries(obj) as [KeyOfUnion<T>[], any]; }

/**
 * Return the bigger of two numbers
 * @param number1 - number
 * @param number2 - number - This is the second parameter, and it's a number.
 */
export function getBiggerNumber(
	number1: number,
	number2: number,
): number { return number1 > number2 ? number1 : number2; }

/**
 * Return the smaller of two numbers
 * @param number1 - number
 * @param number2 - number - This is the second parameter, and it's a number.
 */
export function getSmallerNumber(
	number1: number,
	number2: number,
): number { return number1 > number2 ? number2 : number1; }