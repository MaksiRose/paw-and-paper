import { generateId } from 'crystalid';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, InteractionType, Message, RepliableInteraction, WebhookEditMessageOptions, Snowflake, InteractionResponse } from 'discord.js';
import DiscordUser from '../models/discordUser';
import ErrorInfo from '../models/errorInfo';
import Server from '../models/server';
import User from '../models/user';
import UserToServer from '../models/userToServer';
import { UserSchema } from '../typings/data/user';
const { error_color } = require('../../config.json');
const { version } = require('../../package.json');

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
 * It sends a reply or updates the message the interaction comes from if the interaction hasn't been replied nor deferred, or edits a reply if
 * an editId has been provided, else follows up
 * @param {RepliableInteraction} interaction - The interaction object that is being replied to.
 * @param options - The options to send to the message.
 * @param {'reply' | 'update'} [type=reply] - 'reply' | 'update' = 'reply'
 * @param {Snowflake | '@original'} editId - The ID of the message to edit. If it is '@original', it
 * will edit the original message.
 * @returns A promise that resolves to an InteractionResponse<boolean> or a Message<boolean>
 */
export async function respond(
	interaction: RepliableInteraction,
	options: InteractionReplyOptions & WebhookEditMessageOptions & {fetchReply: true},
	type?: 'reply' | 'update',
	editId?: Snowflake | '@original',
): Promise<Message<boolean>>
export async function respond(
	interaction: RepliableInteraction,
	options: InteractionReplyOptions & WebhookEditMessageOptions & {fetchReply?: boolean},
	type?: 'reply' | 'update',
	editId?: Snowflake | '@original',
): Promise<InteractionResponse<boolean> | Message<boolean>>
export async function respond(
	interaction: RepliableInteraction,
	options: InteractionReplyOptions & WebhookEditMessageOptions & {fetchReply?: boolean},
	type: 'reply' | 'update' = 'reply',
	editId?: Snowflake | '@original',
): Promise<InteractionResponse<boolean> | Message<boolean>> {

	let botReply: InteractionResponse<boolean> | Message<boolean>;

	/* It is sending a reply if the interaction hasn't been replied nor deferred, or editing a reply if editMessage is true, else following up */
	try {

		if (!interaction.replied && !interaction.deferred) {
			if ((interaction.isMessageComponent() || (interaction.isModalSubmit() && interaction.isFromMessage())) && type === 'update') {
				botReply = await interaction.update({ ...options, content: options.content === '' ? null : options.content, flags: undefined });
			}
			else {
				botReply = await interaction.reply({ ...options, content: options.content === '' ? undefined : options.content });
			}
		}
		else if (editId !== undefined) {
			botReply = await interaction.webhook.editMessage(editId, { ...options, content: options.content === '' ? null : options.content });
		}
		else {
			botReply = await interaction.followUp({ ...options, content: options.content === '' ? undefined : options.content });
		}

	}
	/** If an error occurred and it has status 404, try to either edit the message if editing was tried above, or send a new message in the other two cases */
	catch (error: unknown) {

		if (isObject(error) && (error.code === 'ECONNRESET' || error.code === 10062)) {

			console.trace(error.code || error.message || error.name || error.cause || error.status || error.httpStatus);
			if (interaction.replied || interaction.deferred) { // Error code 10062 can never lead to this since an Unknown Interaction can't also be replied or deferred. Therefore, it is safe to call respond again
				botReply = await respond(interaction, options, type, editId);
			}
			if (interaction.isMessageComponent() && type === 'update' && (editId === undefined || editId === '@original' || editId === interaction.message.id)) {
				botReply = await interaction.message.edit({ ...options, content: options.content === '' ? null : options.content, flags: undefined });
			}
			else if (editId !== undefined && editId !== '@original') {

				const channel = interaction.channel || (interaction.channelId ? await interaction.client.channels.fetch(interaction.channelId, { force: false }) : null);
				if (channel && channel.isTextBased()) {

					botReply = await channel.messages.edit(editId, { ...options, content: options.content === '' ? undefined : options.content, flags: undefined });
				}
				else { throw error; }
			}
			else {

				const channel = interaction.channel || (interaction.channelId ? await interaction.client.channels.fetch(interaction.channelId, { force: false }) : null);
				if (channel && channel.isTextBased()) { botReply = await channel.send({ ...options, content: options.content === '' ? undefined : options.content, flags: undefined }); }
				else { throw error; }
			}
		}
		else if (isObject(error) && error.code === 40060) {

			console.trace(error.code || error.message || error.name || error.cause || error.status || error.httpStatus);
			interaction.replied = true;
			botReply = await respond(interaction, options, type, editId);
		}
		else { throw error; }
	}

	return botReply;
}

/**
 * It returns the message id of a message or interaction response, or a '@original' if the message is not a message
 * @param {InteractionResponse<boolean> | Message<boolean>} message - The message that you want to get the ID from.
 * @returns The message id or the backup id.
 */
export function getMessageId(
	message: InteractionResponse<boolean> | Message<boolean>,
): string {

	return message instanceof Message ? message.id : '@original';
}

/**
 * It sends an error message to the user who executed the command, and logs the error to the console
 * @param interaction - The interaction that caused the error.
 * @param error - The error that was thrown.
 */

export async function sendErrorMessage(
	interaction: RepliableInteraction,
	error: unknown,
	userToServer?: UserToServer,
): Promise<any> {

	try {

		if (!userToServer) {
			const discordUser = await DiscordUser.findByPk(interaction.user.id, {
				include: [{ model: User, as: 'user' }],
			});
			const user = discordUser?.user;

			const server = interaction.inCachedGuild()
				? ((await Server.findByPk(interaction.guildId)))
				: undefined;

			userToServer = (user && server)
				? (await UserToServer.findOrCreate({
					where: { userId: user.id, serverId: server.id },
				}))[0]
				: undefined;
		}
		if (userToServer) { await setCooldown(userToServer, false); }
	}
	catch (newError) { console.error(newError); }

	if (interaction.type === InteractionType.ApplicationCommand) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to execute \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.isAnySelectMenu()) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to select \x1b[31m${interaction.values.join(', ')} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.isButton()) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to click the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	else if (interaction.type === InteractionType.ModalSubmit) {
		console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to submit the modal \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}

	const interactionInfo = {
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
			values: interaction.isAnySelectMenu() ? interaction.values : undefined,
			fields: interaction.isModalSubmit() ? interaction.fields.fields.values() : undefined,
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

	const isECONNRESET = isObject(error) && error.code === 'ECONNRESET';
	if (isECONNRESET) {

		console.trace('ECONNRESET Error');
	}
	else if (isObject(error) && error.code === 10062) {

		console.error('Error 404 - An error is not being sent to the user:', error);
		return;
	}
	else if (isObject(error) && error.code === 40060) {

		console.error('Error 400 - An error is not being sent to the user:', error);
		return;
	}
	console.error(error, interactionInfo);

	let errorId: string | undefined = undefined;
	let errorIsReported = false;

	if (!isECONNRESET) {

		try {

			const stack = `${(isObject(error) && error.stack) || JSON.stringify(error, null, '\t')}`;
			const errorInfo = await ErrorInfo.findOne({ where: { stack } });

			if (errorInfo) {

				errorId = errorInfo.id;
				if (errorInfo.isReported) { errorIsReported = true; }
			}
			else {

				errorId = generateId();
				await ErrorInfo.create({ id: errorId, stack, interactionInfo, version });
			}
		}
		catch (e) {

			errorId = undefined;
			console.error(e);
		}
	}

	const messageOptions = {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle(isECONNRESET ? 'The connection was abruptly closed. Apologies for the inconvenience.' : 'There was an unexpected error executing this command:')
			.setDescription(isECONNRESET ? null : `\`\`\`\n${String(error).substring(0, 4090)}\n\`\`\``)
			.setFooter(isECONNRESET ? null : { text: errorIsReported ? 'This error already got reported and the devs are working hard to resolve it.\nIf you want to know when the bot gets updated, you can join our support server (Link is in the help command page 5), or ask an admin of this server to enable getting updates via the server-settings command.' : 'Please report this error using the button below to help us improving the bot and keeping it bug-free. We might get in touch with you for some context if we have trouble reproducing the bug.' })],
		components: (isECONNRESET || errorIsReported) ? [] : [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`report_@${interaction.user.id}${errorId ? `_${errorId}` : ''}`)
				.setLabel('Report')
				.setStyle(ButtonStyle.Success)])],
	};

	// This is a reply or a followUp
	await respond(interaction, { ...messageOptions, flags: undefined })
		.catch(async (error2) => {

			console.error('Failed to send error message to user:', error2);
			await (async () => {
				if (interaction.isMessageComponent()) { await interaction.message.reply({ ...messageOptions, failIfNotExists: false }); }
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

function isObject(val: any): val is Record<string | number | symbol, unknown> { return typeof val === 'object' && val !== null; }

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

export function userDataServersObject(
	u: UserSchema,
	guildId: string,
): UserSchema['servers'][string] {

	return {
		currentQuid: u.servers[guildId]?.currentQuid ?? null,
		lastInteractionTimestamp: u.servers[guildId]?.lastInteractionTimestamp ?? null,
		lastInteractionToken: null,
		lastInteractionChannelId: u.servers[guildId]?.lastInteractionChannelId ?? null,
		restingMessageId: u.servers[guildId]?.restingMessageId ?? null,
		restingChannelId: u.servers[guildId]?.restingChannelId ?? null,
		componentDisablingChannelId: u.servers[guildId]?.componentDisablingChannelId ?? null,
		componentDisablingMessageId: u.servers[guildId]?.componentDisablingMessageId ?? null,
		componentDisablingToken: null,
		hasCooldown: u.servers[guildId]?.hasCooldown ?? false,
		lastProxied: u.servers[guildId]?.lastProxied ?? null,
	};
}

export async function setCooldown(
	userToServer: UserToServer,
	setTo: boolean,
) {

	await userToServer.update({
		hasCooldown: setTo,
	});
}

/**
 * Delay returns a promise that resolves after the given number of milliseconds.
 * @param {number} ms - number - The number of milliseconds to delay.
 * @returns A function that returns a promise that resolves after a delay.
 */
export function delay(
	ms: number,
): Promise<void> {
	return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}