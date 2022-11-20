import { ComponentType, ButtonStyle, APIActionRowComponent, ActionRowBuilder, ActionRow, MessageActionRowComponent, APIMessageActionRowComponent, MessageActionRowComponentBuilder, ButtonBuilder, ButtonComponent, APIButtonComponent, SelectMenuBuilder, SelectMenuComponent, APISelectMenuComponent, isJSONEncodable } from 'discord.js';
import { client } from '..';
import { UserData } from '../typings/data/user';
import { userDataServersObject } from './helperFunctions';

/**
 * It deletes the command disabling info from the user data
 * @param userData - The user's database entry.
 * @param {string} guildId - The ID of the guild that the command disabling info is being deleted from.
 */
export async function deleteCommandDisablingInfo(
	userData: UserData<undefined, ''>,
	guildId: string,
): Promise<void> {

	await userData.update(
		(u) => {
			u.servers[guildId] = {
				...userDataServersObject(u, guildId),
				componentDisablingChannelId: null,
				componentDisablingMessageId: null,
				componentDisablingToken: null,
			};
		},
	);
}

/**
 * It disables the command-component by editing the bot's reply to the user's message
 * @param userData - The user's database entry.
 * @returns A promise that resolves when the command-component has been disabled.
 */
export async function disableCommandComponent(
	userData: UserData<undefined, ''>,
): Promise<void> {

	const { serverInfo } = userData;
	if (serverInfo === undefined) { return; }

	if (serverInfo.componentDisablingChannelId !== null && serverInfo.componentDisablingMessageId !== null) {

		const channel = await client.channels.fetch(serverInfo.componentDisablingChannelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {

			console.error(new TypeError(`Unable to disable command-component because the channel with ID ${serverInfo.componentDisablingChannelId} could not be fetched or is not text based`));
			return;
		}

		const botReply = await channel.messages.fetch(serverInfo.componentDisablingMessageId).catch(() => null);
		if (!botReply) {

			console.error(new TypeError(`Unable to disable command-component because the message with ID ${serverInfo.componentDisablingMessageId} could not be fetched`));
			return;
		}

		await Promise.all([
			botReply.edit({
				components: disableAllComponents(botReply.components),
			}),
			deleteCommandDisablingInfo(userData, botReply.guildId || 'DMs'),
		]).catch(error => {
			console.error(error);
		});
	}
}

/**
 * It saves the channel and message IDs of the message that disables the bot's command-component
 * @param userData - The user's database entry.
 * @param {string} guildId - The ID of the guild the command was used in.
 * @param {string} channelId - The ID of the channel where the command disabling message is.
 * @param {string} messageId - The ID of the message to disable the components of.
 */
export async function saveCommandDisablingInfo(
	userData: UserData<undefined, ''>,
	guildId: string,
	channelId: string,
	messageId: string,
	interactionToken: string,
): Promise<void> {

	await userData.update(
		(u) => {
			u.servers[guildId] = {
				...userDataServersObject(u, guildId),
				componentDisablingChannelId: channelId,
				componentDisablingMessageId: messageId,
				componentDisablingToken: interactionToken,
			};
		},
	);
}

/**
 * Goes through all components in a message and disables them.
 */
export function disableAllComponents(
	messageComponents: ActionRowBuilder<ButtonBuilder>[] | ActionRow<ButtonComponent>[] | APIActionRowComponent<APIButtonComponent>[],
): ActionRowBuilder<ButtonBuilder>[];
export function disableAllComponents(
	messageComponents: ActionRowBuilder<SelectMenuBuilder>[] | ActionRow<SelectMenuComponent>[] | APIActionRowComponent<APISelectMenuComponent>[],
): ActionRowBuilder<SelectMenuBuilder>[];
export function disableAllComponents(
	messageComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[] | ActionRow<MessageActionRowComponent>[] | APIActionRowComponent<APIMessageActionRowComponent>[],
): ActionRowBuilder<MessageActionRowComponentBuilder>[];
export function disableAllComponents(
	messageComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[] | ActionRow<MessageActionRowComponent>[] | APIActionRowComponent<APIMessageActionRowComponent>[],
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {

	return messageComponents = messageComponents.map(actionRow => {

		const newActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>(isJSONEncodable(actionRow) ? actionRow.toJSON() : actionRow);
		return newActionRow.setComponents(actionRow.components.map(component => {

			const data = isJSONEncodable(component) ? component.toJSON() : component;

			if (data.type !== ComponentType.Button || data.style !== ButtonStyle.Link) { data.disabled = true; }
			return data.type === ComponentType.Button ? new ButtonBuilder(data) : new SelectMenuBuilder(data);
		}));
	});
}