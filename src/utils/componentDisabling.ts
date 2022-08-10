import { Message, ComponentType, ButtonStyle, APIActionRowComponent, APIButtonComponent, APISelectMenuComponent } from 'discord.js';

/**
 * An object with player UUID + guild ID as keys and a property that is a promise function that deletes the entry and disables all components of a message that has been attached when the function was created.
 */
export const disableCommandComponent: Record<string, (() => Promise<void>) | undefined> = {};

/**
 * Creates an entry in the `disableCommandComponent` object that deletes itself and edits the botReply message object that has been attached to disable all components when being called.
 */
export const createCommandComponentDisabler = (
	uuid: string,
	guildId: string,
	botReply: Message,
): void => {

	disableCommandComponent[uuid + guildId] = async () => {

		delete disableCommandComponent[uuid + guildId];

		await botReply
			.edit({
				components: disableAllComponents(botReply.components.map(component => component.toJSON())),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	};
};

/**
 * Goes through all components in a message and disables them.
 */
export const disableAllComponents = (
	messageComponents: Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>>,
): Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>> => {

	for (const actionRow in messageComponents) {

		const messageComponent = messageComponents[actionRow];
		if (!messageComponent) { return messageComponents; }
		for (const component in messageComponent.components) {

			const actionRowComponent = messageComponent.components[component];
			if (!actionRowComponent || (actionRowComponent.type === ComponentType.Button && actionRowComponent.style === ButtonStyle.Link)) { continue; }
			actionRowComponent.disabled = true;
		}
	}

	return messageComponents;
};