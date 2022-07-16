import { CommandInteraction } from 'discord.js';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { UserSchema } from '../typedef';
const { error_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export function hasName(interaction: CommandInteraction, userData: UserSchema | null): userData is UserSchema {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']];

	if (!characterData || characterData.name === '') {

		userModel.findOne({ userId: interaction.user.id })
			.then(u => {

				respond(interaction, {
					embeds: [{
						color: error_color,
						title: 'Please type "rp name [name]" to create a new character!',
						description: Object.keys(u?.characters || {}).length > 0 ? 'I see that you already have a character. You can switch to it using `rp profile`! If you played the RPG on a different server, server-specific information like stats, levels, rank etc. will not transfer over to prevent cheating.' : undefined,
					}],
				}, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			})
			.catch(() => { return false; });

		return false;
	}

	return true;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
function hasSpecies(interaction: CommandInteraction, userData: UserSchema | null): boolean {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']];

	if (characterData?.species === '') {

		respond(interaction, {
			embeds: [{
				color: error_color,
				title: `To access this command, you need to choose ${characterData?.name}'s species!`,
			}],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return false;
	}

	return true;
}

/**
 * Checks if the user has a name and a species, returns false if they do, and if they don't, sends the appropriate message and returns true.
 */
export function hasCompletedAccount(interaction: CommandInteraction, userData: UserSchema | null): userData is UserSchema {

	if (hasName(interaction, userData) && hasSpecies(interaction, userData)) {

		return true;
	}

	return false;
}