import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { respond } from '../events/interactionCreate';
import { UserSchema } from '../typedef';
const { error_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export const hasName = (
	interaction: ChatInputCommandInteraction,
	userData: UserSchema | null,
): userData is UserSchema => {

	const quidData = userData?.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];
	if (!quidData || quidData.name === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle(Object.keys(userData?.quids || {}).length > 0 ? 'Please type "/profile" to switch to a quid!' : 'Please type "/name" to create a new quid!')],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return false;
	}

	return true;
};

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
function hasSpecies(interaction: ChatInputCommandInteraction, userData: UserSchema | null): boolean {

	const quidData = userData?.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];
	if (quidData?.species === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle(`To access this command, you need to choose ${quidData?.name}'s species!`)],
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
export const hasCompletedAccount = (
	interaction: ChatInputCommandInteraction,
	userData: UserSchema | null,
): userData is UserSchema => {

	if (hasName(interaction, userData) && hasSpecies(interaction, userData)) {

		return true;
	}

	return false;
};

/**
 * This is checking if the interaction is in a guild, if it is not, it will reply to the user with a message saying that the command cannot be executed in DMs.
 */
export const isInGuild = (
	interaction: ChatInputCommandInteraction,
): interaction is ChatInputCommandInteraction<'cached'> => {

	if (!interaction.inCachedGuild()) {

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
};