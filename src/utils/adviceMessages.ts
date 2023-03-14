// @ts-check
import { ButtonInteraction, ChatInputCommandInteraction, AnySelectMenuInteraction } from 'discord.js';
import QuidToServer from '../models/quidToServer';
import User from '../models/user';
import { respond } from './helperFunctions';


/**
 * It checks if the user's energy is below 80, and if it is, it sends a message to the user telling them to rest
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function restAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	user: User,
	quidToServer: QuidToServer,
): Promise<void> {

	if (quidToServer.energy <= 80 && user.advice_resting === false) {

		await user.update({ advice_resting: true });

		// This is always a followUp
		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nRest via \`/rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`/vote\` to get +30 energy per vote!`,
		});
	}
}

/**
 * It checks if the user's thirst is below 80, and if it is, it sends a message to the user telling them to drink
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function drinkAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	user: User,
	quidToServer: QuidToServer,
): Promise<void> {

	if (quidToServer.thirst <= 80 && user.advice_drinking === false) {

		await user.update({ advice_drinking: true });

		// This is always a followUp
		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nDrink via \`/drink\` to fill up your thirst.`,
		});
	}
}

/**
 * It checks if the user's hunger is below 80, and if it is, it sends a message to the user telling them to eat
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function eatAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	user: User,
	quidToServer: QuidToServer,
): Promise<void> {

	if (quidToServer.hunger <= 80 && user.advice_eating === false) {

		await user.update({ advice_eating: true });

		// This is always a followUp
		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nEat via \`/eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
		});
	}
}

export async function coloredButtonsAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	user: User,
): Promise<void> {

	if (user.advice_coloredButtons === false) {

		await user.update({ advice_coloredButtons: true });

		// This is always a followUp
		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nA red button means that you picked wrong, the blue button is what you should've picked instead. A green button means that you picked correct.`,
		});
	}
}