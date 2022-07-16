import { Message, MessageActionRow } from 'discord.js';

export const disableCommandComponent: Record<string, (() => Promise<void>) | undefined> = {};

export function createCommandComponentDisabler(uuid: string, guildId: string, botReply: Message): void {

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
export function disableAllComponents(messageComponents: Array<MessageActionRow>): Array<MessageActionRow> {

	for (const actionRow of messageComponents) {

		for (const component of actionRow.components) {

			if (component.type === 'BUTTON' && component.style === 'LINK') { continue; }
			component.disabled = true;
		}
	}

	return messageComponents;
}