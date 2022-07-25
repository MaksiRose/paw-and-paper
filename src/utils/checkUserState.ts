import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { respond } from '../events/interactionCreate';
import { UserSchema } from '../typedef';
const { error_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export function hasName(interaction: ChatInputCommandInteraction, userData: UserSchema | null): userData is UserSchema {

	const characterData = userData?.characters[userData.currentCharacter[interaction.guildId || 'DM'] || ''];
	if (!characterData || characterData.name === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle('Please type "/name" to create a new character!')
				.setDescription(Object.keys(userData?.characters || {}).length > 0 ? 'I see that you already have a character. You can switch to it using `rp profile`! If you played the RPG on a different server, server-specific information like stats, levels, rank etc. will not transfer over to prevent cheating.' : null)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return false;
	}

	return true;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
function hasSpecies(interaction: ChatInputCommandInteraction, userData: UserSchema | null): boolean {

	const characterData = userData?.characters[userData.currentCharacter[interaction.guildId || 'DM'] || ''];
	if (characterData?.species === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle(`To access this command, you need to choose ${characterData?.name}'s species!`)],
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
export function hasCompletedAccount(interaction: ChatInputCommandInteraction, userData: UserSchema | null): userData is UserSchema {

	if (hasName(interaction, userData) && hasSpecies(interaction, userData)) {

		return true;
	}

	return false;
}

/**
 * This is checking if the interaction is in a guild, if it is not, it will reply to the user with a message saying that the command cannot be executed in DMs.
 * @param {import('discord.js').Message} message
 * @returns {message is import('discord.js').Message<true>}
 */
export function isInGuild(interaction: ChatInputCommandInteraction): interaction is ChatInputCommandInteraction<'cached' | 'raw'> {

	if (!interaction.inGuild()) {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle('This command cannot be executed in DMs!')],
			ephemeral: true,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return false;
	}

	return true;
}