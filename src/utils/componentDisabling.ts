import { Message, ComponentType, ButtonStyle, APIActionRowComponent, APIButtonComponent, APISelectMenuComponent } from 'discord.js';

export const disableCommandComponent: Record<string, (() => Promise<void>) | undefined> = {};

export function createCommandComponentDisabler(uuid: string, guildId: string, botReply: Message): void {

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
}

/**
 * Goes through all components in a message and disables them.
 */
export function disableAllComponents(messageComponents: Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>>): Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>> {

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
}