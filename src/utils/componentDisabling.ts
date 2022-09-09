import { Message, ComponentType, ButtonStyle, APIActionRowComponent, ActionRowBuilder, ActionRow, MessageActionRowComponent, APIMessageActionRowComponent, MessageActionRowComponentBuilder, ButtonBuilder, ButtonComponent, APIButtonComponent, SelectMenuBuilder, SelectMenuComponent, APISelectMenuComponent } from 'discord.js';

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

		await botReply
			.edit({
				components: disableAllComponents(botReply.components),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
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

		actionRow = new ActionRowBuilder(actionRow);
		return actionRow.setComponents(actionRow.components.map(component => {

			const data = component.toJSON();

			if (data.type !== ComponentType.Button || data.style !== ButtonStyle.Link) { component.setDisabled(true); }
			return component;
		}));
	});
}