// @ts-check
import { ButtonInteraction, ChatInputCommandInteraction, SelectMenuInteraction } from 'discord.js';
import { UserData } from '../typings/data/user';
import { respond } from './helperFunctions';


/**
 * It checks if the user's energy is below 80, and if it is, it sends a message to the user telling them to rest
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function restAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<void> {

	if (userData.quid.profile.energy <= 80 && userData.advice.resting === false) {

		await userData.update(
			(u) => {
				u.advice.resting = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nRest via \`/rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`/vote\` to get +30 energy per vote!`,
		}, false);
	}
}

/**
 * It checks if the user's thirst is below 80, and if it is, it sends a message to the user telling them to drink
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function drinkAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<void> {

	if (userData.quid.profile.thirst <= 80 && userData.advice.drinking === false) {

		await userData.update(
			(u) => {
				u.advice.drinking = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nDrink via \`/drink\` to fill up your thirst.`,
		}, false);
	}
}

/**
 * It checks if the user's hunger is below 80, and if it is, it sends a message to the user telling them to eat
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function eatAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<void> {

	if (userData.quid.profile.hunger <= 80 && userData.advice.eating === false) {

		await userData.update(
			(u) => {
				u.advice.eating = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nEat via \`/eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
		}, false);
	}
}

/**
 * It checks if the user has already seen the advice, if not, it sends the advice and sets the user's advice.coloredbuttons to true
 * @param interaction - The interaction this is triggered from
 * @param {UserSchema} userData - The user's data from the database.
 */
export async function coloredButtonsAdvice(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<void> {

	if (userData.advice.coloredbuttons === false) {

		await userData.update(
			(u) => {
				u.advice.coloredbuttons = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nA red button means that you picked wrong, the blue button is what you should've picked instead. A green button means that you picked correct.`,
		}, false);
	}
}