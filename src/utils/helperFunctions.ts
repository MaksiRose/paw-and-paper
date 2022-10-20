import { generateId } from 'crystalid';
import { APIMessage } from 'discord-api-types/v9';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionType, Message, MessageContextMenuCommandInteraction, ModalMessageModalSubmitInteraction, ModalSubmitInteraction, RepliableInteraction, SelectMenuInteraction, UserContextMenuCommandInteraction, WebhookEditMessageOptions } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { cooldownMap } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { ErrorStacks } from '../typings/data/general';
const { error_color } = require('../../config.json');

/**
 * It takes a map and a key, and returns the value associated with the key. If the value is undefined, it throws a type error instead.
 * @param map - An object with unknown keys and a property T
 * @param key - The key of the object to get T from
 * @returns T as the property from the key from the object
 */
export function getMapData<T>(
	map: Record<PropertyKey, T>,
	key: PropertyKey,
): T {
	const element = map[key];
	if (element === undefined) throw new TypeError('element is undefined');
	return element;
}

/**
 * It takes an array and an index, and returns the element at that index. If the element is undefined, it throws a type error instead.
 * @param array - The array to get the element from.
 * @param {number} index - The index of the element you want to get.
 * @returns The element at the given index of the array.
 */
export function getArrayElement<T>(
	array: Array<T>,
	index: number,
): T {
	const element = array[index];
	if (element === undefined) throw new TypeError('element is undefined');
	return element;
}

export function getUserIds(
	message: Message,
): Array<string> {

	const array1 = message.mentions.users.map(u => u.id);
	const array2 = (message.content.match(/<@!?(\d{17,19})>/g) || [])?.map(mention => mention.replace('<@', '').replace('>', '').replace('!', ''));

	return [...new Set([...array1, ...array2])];
}

/**
 * It replies to an interaction, and if the interaction has already been replied to, it will edit or followup the reply instead.
 * @param interaction - The interaction object that was passed to the command handler.
 * @param options - WebhookEditMessageOptions & InteractionReplyOptions
 * @param editMessage - boolean - If true, the bot will edit the original message instead of sending a follow-up message.
 * @returns A promise that resolves to a Message<boolean>
 */
export async function respond(
	interaction: RepliableInteraction,
	options: InteractionReplyOptions,
	editMessage: boolean,
): Promise<Message<boolean>> {

	let botReply: APIMessage | Message<boolean>;

	/* It is sending a reply if the interaction hasn't been replied nor deferred, or editing a reply if editMessage is true, else following up */
	try {

		if (!interaction.replied && !interaction.deferred) {
			botReply = await interaction.reply({ ...options, content: options.content === '' ? undefined : options.content, fetchReply: true });
		}
		else if (editMessage) {
			botReply = await interaction.editReply({ ...options, content: options.content === '' ? null : options.content });
		}
		else {
			botReply = await interaction.followUp({ ...options, content: options.content === '' ? undefined : options.content });
		}

	}
	/** If an error occurred and it has status 404, try to either edit the message if editing was tried above, or send a new message in the other two cases */
	catch (error: unknown) {

		if ((objectHasKey(error, 'code') && error.code === 'ECONNRESET') || (objectHasKey(error, 'status') && error.status === 404) || (objectHasKey(error, 'httpStatus') && error.httpStatus === 404)) {

			if ((interaction.replied || interaction.deferred) && editMessage) { botReply = await (await interaction.fetchReply()).edit({ ...options, flags: undefined }); }
			else {

				const channel = interaction.channel || (interaction.channelId ? await interaction.client.channels.fetch(interaction.channelId, { force: false }) : null);
				if (channel && channel.isTextBased()) { botReply = await channel.send({ ...options, flags: undefined }); }
				else { throw error; }

			}
		}
		else if (((objectHasKey(error, 'status') && error.status === 400) || (objectHasKey(error, 'httpStatus') && error.httpStatus === 400)) && !interaction.replied && !interaction.deferred) {

			interaction.replied = true;
			botReply = await respond(interaction, options, editMessage);
		}
		else { throw error; }
	}

	if (botReply instanceof Message) { return botReply; }
	else { throw new TypeError('Message is APIMessage'); }
}

export async function update(
	interaction: ButtonInteraction | SelectMenuInteraction | ModalMessageModalSubmitInteraction,
	options: WebhookEditMessageOptions,
): Promise<Message<boolean>> {

	let botReply: Message<boolean>;

	/* It is sending a reply if the interaction hasn't been replied nor deferred, or editing a reply if editMessage is true, else following up */
	try {

		if (!interaction.replied && !interaction.deferred) {
			botReply = await interaction.update({ ...options, content: options.content === '' ? null : options.content, fetchReply: true });
		}
		else {
			botReply = await interaction.editReply({ ...options, content: options.content === '' ? null : options.content });
		}

	}
	/** If an error occurred and it has status 404, try to either edit the message if editing was tried above, or send a new message in the other two cases */
	catch (error: unknown) {

		if (objectHasKey(error, 'code') && (error.code === 'ECONNRESET' || error.code === 10062)) {

			if (!interaction.replied && !interaction.deferred) { botReply = await interaction.message.edit({ ...options, flags: undefined }); }
			else { botReply = await (await interaction.fetchReply()).edit({ ...options, flags: undefined }); }
		}
		else if (objectHasKey(error, 'code') && error.code === 40060 && !interaction.replied && !interaction.deferred) {

			interaction.replied = true;
			botReply = await update(interaction, options);
		}
		else { throw error; }
	}

	return botReply;
}

/**
 * It sends an error message to the user who executed the command, and logs the error to the console
 * @param interaction - The interaction that caused the error.
 * @param error - The error that was thrown.
 */

export async function sendErrorMessage(
	interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction | SelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction,
	error: unknown,
): Promise<any> {

	try {

		const userData = await userModel.findOne(u => u.userId.includes(interaction.user.id));
		cooldownMap.set(userData._id + interaction.guildId, false);
	}
	catch (newError) { console.error(newError); }

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

	const jsonInteraction = {
		id: interaction.id,
		application_id: interaction.applicationId,
		type: interaction.type,
		data: interaction.isCommand() ? {
			id: interaction.commandId,
			name: interaction.commandName,
			command_type: interaction.commandType,
			options: interaction.options.data,
			target_id: interaction.isContextMenuCommand() ? interaction.targetId : undefined,
		} : {
			component_type: interaction.isMessageComponent() ? interaction.componentType : undefined,
			custom_id: interaction.customId,
			values: interaction.isSelectMenu() ? interaction.values : undefined,
			fields: interaction.isModalSubmit() ? interaction.fields.fields.map(f => f.toJSON()) : undefined,
			components: interaction.isModalSubmit() ? interaction.components : undefined,
		},
		guild_id: interaction.guildId ?? undefined,
		channel_id: interaction.channelId ?? undefined,
		user_id: interaction.user.id,
		message: interaction.isMessageComponent() || (interaction.isModalSubmit() && interaction.isFromMessage()) ? {
			id: interaction.message.id,
			timestamp: interaction.message.createdTimestamp,
			edited_timestamp: interaction.message.editedTimestamp,
			type: interaction.message.type,
			application_id: interaction.message.applicationId ?? undefined,
		} : undefined,
		timestamp: interaction.createdTimestamp,
		app_permission: interaction.appPermissions?.bitfield.toString(),
		locale: interaction.locale,
		guild_locale: interaction.guildLocale,
	};

	if (objectHasKey(error, 'code') && error.code === 10062) {

		console.error('Error 404 - An error is not being sent to the user:', error);
		return;
	}
	else if (objectHasKey(error, 'code') && error.code === 40060) {

		console.error('Error 400 - An error is not being sent to the user:', error);
		return;
	}
	const isECONNRESET = objectHasKey(error, 'code') && error.code === 'ECONNRESET';
	console.error(error, jsonInteraction);

	let errorId: string | undefined = undefined;

	if (!isECONNRESET) {

		try {

			const errorStacks = JSON.parse(readFileSync('./database/errorStacks.json', 'utf-8')) as ErrorStacks;
			errorId = generateId();
			errorStacks[errorId] = `${(objectHasKey(error, 'stack') && error.stack) || JSON.stringify(error, null, '\t')}\n${JSON.stringify(jsonInteraction, null, '\t')}`;
			writeFileSync('./database/errorStacks.json', JSON.stringify(errorStacks, null, '\t'));
		}
		catch (e) {

			errorId = undefined;
			console.error('Cannot edit file ', e);
		}
	}

	const messageOptions = {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle(isECONNRESET ? 'The connection was abruptly closed. Apologies for the inconvenience.' : 'There was an unexpected error executing this command:')
			.setDescription(isECONNRESET ? null : `\`\`\`\n${String(error).substring(0, 4090)}\n\`\`\``)
			.setFooter(isECONNRESET ? null : { text: 'If this is the first time you encountered the issue, please report it using the button below. After that, only report it again if the issue was supposed to be fixed after an update came out. To receive updates, ask a server administrator to do the "getupdates" command.' })],
		components: isECONNRESET ? [] : [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`report_@${interaction.user.id}${errorId ? `_${errorId}` : ''}`)
				.setLabel('Report')
				.setStyle(ButtonStyle.Success)])],
	};

	await respond(interaction, { ...messageOptions, flags: undefined }, false)
		.catch(async (error2) => {

			console.error('Failed to send error message to user:', error2);
			await (async () => {
				if (interaction.isButton() || interaction.isSelectMenu()) { await interaction.message.reply({ ...messageOptions, failIfNotExists: false }); }
				if (interaction.isMessageContextMenuCommand()) { await interaction.targetMessage.reply({ ...messageOptions, failIfNotExists: false }); }
				if (interaction.isUserContextMenuCommand() || interaction.isChatInputCommand() || interaction.type === InteractionType.ModalSubmit) { await interaction.channel?.send(messageOptions); }
			})()
				.catch((error3) => {
					console.error('Failed to send backup error message to user:', error3);
				});
		});
}

/**
 * It recursively copies an object, array, date, or regular expression, and returns a copy of the original
 * @param {T} object - The object to be copied.
 * @returns A deep copy of the object.
 */
export function deepCopyObject<T>(
	object: T,
): T {

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
}

export type KeyOfUnion<T> = T extends object ? T extends T ? keyof T : never : never; // `T extends object` to filter out primitives like `string`
/* What this does is for every key in the inventory (like commonPlants, uncommonPlants etc.), it takes every single sub-key of all the keys and adds it to it. KeyOfUnion is used to combine all those sub-keys from all the keys. In the case that they are not part of the property, they will be of type never, meaning that they can't accidentally be assigned anything (which makes the type-checking still work) */
export type WidenValues<T> = {
	[K in keyof T]: {
		[K2 in KeyOfUnion<T[keyof T]>]: K2 extends keyof T[K] ? T[K][K2] : never;
	};
};
export function widenValues<T>(obj: T): WidenValues<T> { return obj as any; }
export function unsafeKeys<T extends Record<PropertyKey, any>>(obj: T): KeyOfUnion<T>[] { return Object.keys(obj) as KeyOfUnion<T>[]; }

export type ValueOf<T> = T[keyof T];
export function valueInObject<T extends Record<PropertyKey, any>, V extends ValueOf<T>>(
	obj: T,
	value: any,
): value is V {
	return Object.values(obj).includes(value);
}
export function keyInObject<T extends Record<PropertyKey, any>, K extends keyof T>(
	obj: T,
	key: PropertyKey,
): key is K { return Object.hasOwn(obj, key); }

export function objectHasKey<T, K extends PropertyKey>(
	obj: T,
	key: K,
): obj is T & Record<K, any> { return typeof obj === 'object' && obj !== null && Object.hasOwn(obj, key); }

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

/**
 * Given a string, return a new string with the first letter capitalized.
 * @param {string} string - The string to capitalize.
 * @returns The first character of the string is being capitalized and then the rest of the string is being added to it.
 */
export function capitalizeString(
	string: string,
): string { return string.charAt(0).toUpperCase() + string.slice(1); }

export function addCommasAndAnd<T>(
	list: T[],
) {

	if (list.length < 3) { return list.join(' and '); }
	return `${list.slice(0, -1).join(', ')}, and ${getArrayElement(list, list.length - 1)}`;
}