import { Message, ComponentType, ButtonStyle, APIActionRowComponent, ActionRowBuilder, ActionRow, MessageActionRowComponent, APIMessageActionRowComponent, MessageActionRowComponentBuilder, ButtonBuilder, ButtonComponent, APIButtonComponent, SelectMenuBuilder, SelectMenuComponent, APISelectMenuComponent, isJSONEncodable } from 'discord.js';

/**
 * An object with player UUID + guild ID as keys and a property that is a promise function that deletes the entry and disables all components of a message that has been attached when the function was created.
 */
export const disableCommandComponent: Record<string, (() => Promise<void>) | undefined> = {};

/**
 * Creates an entry in the `disableCommandComponent` object that deletes itself and edits the botReply message object that has been attached to disable all components when being called.
 */
export function createCommandComponentDisabler(
	uuid: string,
	guildId: string,
	botReply: Message,
): void {

	disableCommandComponent[uuid + guildId] = async () => {

		delete disableCommandComponent[uuid + guildId];

		botReply = botReply.channel.messages.cache.get(botReply.id) ?? botReply;
		await botReply.edit({
			components: disableAllComponents(botReply.components),
		});
	};
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