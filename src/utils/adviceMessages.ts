// @ts-check
import { ButtonInteraction } from 'discord.js';
import userModel from '../models/userModel';
import { Profile, UserSchema } from '../typedef';
import { respond } from './helperFunctions';


/**
 * It checks if the user's energy is below 80, and if it is, it sends a message to the user telling them to rest
 * @param interaction - The interaction this is triggered from
 * @param userData - The user's data from the database.
 * @param profileData - The user's profile on the server they are using the command on
 */
export async function restAdvice(
	interaction: ButtonInteraction<'cached'>,
	userData: UserSchema,
	profileData: Profile,
): Promise<void> {

	if (profileData.energy <= 80 && userData.advice.resting === false) {

		await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				u.advice.resting = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nRest via \`/rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`/vote\` to get +30 energy per vote!`,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
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
	interaction: ButtonInteraction<'cached'>,
	userData: UserSchema,
	profileData: Profile,
): Promise<void> {

	if (profileData.thirst <= 80 && userData.advice.drinking === false) {

		await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				u.advice.drinking = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nDrink via \`/drink\` to fill up your thirst.`,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
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
	interaction: ButtonInteraction<'cached'>,
	userData: UserSchema,
	profileData: Profile,
): Promise<void> {

	if (profileData.hunger <= 80 && userData.advice.eating === false) {

		await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				u.advice.eating = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nEat via \`/eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * It checks if the user has already seen the advice, if not, it sends the advice and sets the user's advice.coloredbuttons to true
 * @param interaction - The interaction this is triggered from
 * @param {UserSchema} userData - The user's data from the database.
 */
export async function coloredButtonsAdvice(
	interaction: ButtonInteraction<'cached'>,
	userData: UserSchema,
): Promise<void> {

	if (userData.advice.coloredbuttons === false) {

		await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				u.advice.coloredbuttons = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nA red button means that you picked wrong, the blue button is what you should've picked instead. A green button means that you picked correct.`,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}