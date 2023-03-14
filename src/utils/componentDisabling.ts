import { ComponentType, ButtonStyle, APIActionRowComponent, ActionRowBuilder, ActionRow, MessageActionRowComponent, APIMessageActionRowComponent, MessageActionRowComponentBuilder, ButtonBuilder, ButtonComponent, APIButtonComponent, StringSelectMenuBuilder, APISelectMenuComponent, isJSONEncodable, RoleSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, MentionableSelectMenuBuilder, StringSelectMenuComponent } from 'discord.js';

/**
 * Goes through all components in a message and disables them.
 */
export function disableAllComponents(
	messageComponents: ActionRowBuilder<ButtonBuilder>[] | ActionRow<ButtonComponent>[] | APIActionRowComponent<APIButtonComponent>[],
): ActionRowBuilder<ButtonBuilder>[];
export function disableAllComponents(
	messageComponents: ActionRowBuilder<StringSelectMenuBuilder>[] | ActionRow<StringSelectMenuComponent>[] | APIActionRowComponent<APISelectMenuComponent>[],
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