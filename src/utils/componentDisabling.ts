import { ComponentType, ButtonStyle, ActionRowBuilder, MessageActionRowComponentBuilder, ButtonBuilder, StringSelectMenuBuilder, isJSONEncodable, RoleSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, MentionableSelectMenuBuilder, TopLevelComponent } from 'discord.js';

/**
 * Goes through all components in a message and disables them.
 */
export function disableAllComponents(
	messageComponents: ActionRowBuilder<ButtonBuilder>[],
): ActionRowBuilder<ButtonBuilder>[];
export function disableAllComponents(
	messageComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[],
): ActionRowBuilder<MessageActionRowComponentBuilder>[];
export function disableAllComponents(
	messageComponents: TopLevelComponent[],
): TopLevelComponent[];
export function disableAllComponents(
	messageComponents: (ActionRowBuilder<MessageActionRowComponentBuilder> | TopLevelComponent)[],
): (ActionRowBuilder<MessageActionRowComponentBuilder> | TopLevelComponent)[];
export function disableAllComponents(
	messageComponents: (ActionRowBuilder<MessageActionRowComponentBuilder> | TopLevelComponent)[],
): (ActionRowBuilder<MessageActionRowComponentBuilder> | TopLevelComponent)[] {

	return messageComponents.map(component => {

		const newComp = component.toJSON();
		if (newComp.type !== ComponentType.ActionRow) { return component; }

		const newTLC = new ActionRowBuilder<MessageActionRowComponentBuilder>();
		return newTLC.setComponents(newComp.components.map(compcomp => {

			if (compcomp.type !== ComponentType.Button || compcomp.style !== ButtonStyle.Link) { compcomp.disabled = true; }
			return compcomp.type === ComponentType.Button ? new ButtonBuilder(compcomp) : compcomp.type === ComponentType.StringSelect ? new StringSelectMenuBuilder(compcomp) : compcomp.type === ComponentType.RoleSelect ? new RoleSelectMenuBuilder(compcomp) : compcomp.type === ComponentType.UserSelect ? new UserSelectMenuBuilder(compcomp) : compcomp.type === ComponentType.ChannelSelect ? new ChannelSelectMenuBuilder(compcomp) : compcomp.type === ComponentType.MentionableSelect ? new MentionableSelectMenuBuilder(compcomp) : new StringSelectMenuBuilder(compcomp);
		}));
	});
}