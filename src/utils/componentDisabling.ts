import { ComponentType, ButtonStyle, APIActionRowComponent, ActionRowBuilder, ActionRow, MessageActionRowComponent, APIMessageActionRowComponent, MessageActionRowComponentBuilder, ButtonBuilder, ButtonComponent, APIButtonComponent, StringSelectMenuBuilder, SelectMenuComponent, APISelectMenuComponent, isJSONEncodable, SnowflakeUtil, RepliableInteraction, RoleSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, MentionableSelectMenuBuilder } from 'discord.js';
import { client } from '..';
import { UserData } from '../typings/data/user';
import { userDataServersObject } from './helperFunctions';

export const componentDisablingInteractions = new Map<string, RepliableInteraction>();

/**
 * It deletes the command disabling info from the user data
 * @param userData - The user's database entry.
 * @param {string} guildId - The ID of the guild that the command disabling info is being deleted from.
 */
export function deleteCommandDisablingInfo(
	userData: UserData<undefined, ''>,
	guildId: string,
): void {

	componentDisablingInteractions.delete(userData._id + guildId);
	userData.update(
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

	const interaction = componentDisablingInteractions.get(userData._id + userData.quid?.profile?.serverId);
	const fifteenMinutesInMs = 900_000;
	if (interaction !== undefined && serverInfo.componentDisablingMessageId !== null && client.isReady() && SnowflakeUtil.deconstruct(interaction.id).timestamp > Date.now() - fifteenMinutesInMs) {

		const botReply = await interaction.webhook.fetchMessage(serverInfo.componentDisablingMessageId)
			.catch(error => {
				componentDisablingInteractions.delete(userData._id + userData.quid?.profile?.serverId);
				console.error(error);
				return undefined;
			});
		if (botReply === undefined) { return; }

		await interaction.webhook.editMessage(serverInfo.componentDisablingMessageId, {
			components: disableAllComponents(botReply.components),
		}).catch(error => {
			componentDisablingInteractions.delete(userData._id + userData.quid?.profile?.serverId);
			console.error(error);
		});

		deleteCommandDisablingInfo(userData, botReply.guildId || 'DMs');
	}
	else if (serverInfo.componentDisablingChannelId !== null && serverInfo.componentDisablingMessageId !== null) {

		const channel = await client.channels.fetch(serverInfo.componentDisablingChannelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {

			console.error(new TypeError(`Unable to disable command-component because the channel with ID ${serverInfo.componentDisablingChannelId} could not be fetched or is not text based`));
			return;
		}

		const botReply = await channel.messages.fetch(serverInfo.componentDisablingMessageId).catch(() => null);
		if (!botReply) {

			console.error(new TypeError(`Unable to disable command-component because the message with ID ${serverInfo.componentDisablingMessageId} could not be fetched`));
			deleteCommandDisablingInfo(userData, channel.isDMBased() ? 'DMs' : channel.guildId);
			return;
		}

		await botReply.edit({
			components: disableAllComponents(botReply.components),
		});

		deleteCommandDisablingInfo(userData, botReply.guildId || 'DMs');
	}
}

/**
 * It saves the channel and message IDs of the message that disables the bot's command-component
 * @param userData - The user's database entry.
 * @param {string} guildId - The ID of the guild the command was used in.
 * @param {string} channelId - The ID of the channel where the command disabling message is.
 * @param {string} messageId - The ID of the message to disable the components of.
 */
export function saveCommandDisablingInfo(
	userData: UserData<undefined, ''>,
	guildId: string,
	channelId: string,
	messageId: string,
	interaction: RepliableInteraction,
): void {

	componentDisablingInteractions.set(userData._id + guildId, interaction);
	userData.update(
		(u) => {
			u.servers[guildId] = {
				...userDataServersObject(u, guildId),
				componentDisablingChannelId: channelId,
				componentDisablingMessageId: messageId,
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
	messageComponents: ActionRowBuilder<StringSelectMenuBuilder>[] | ActionRow<SelectMenuComponent>[] | APIActionRowComponent<APISelectMenuComponent>[],
): ActionRowBuilder<StringSelectMenuBuilder>[];
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
			return data.type === ComponentType.Button ? new ButtonBuilder(data) : data.type === ComponentType.StringSelect ? new StringSelectMenuBuilder(data) : data.type === ComponentType.RoleSelect ? new RoleSelectMenuBuilder(data) : data.type === ComponentType.UserSelect ? new UserSelectMenuBuilder(data) : data.type === ComponentType.ChannelSelect ? new ChannelSelectMenuBuilder(data) :	new MentionableSelectMenuBuilder(data);
		}));
	});
}