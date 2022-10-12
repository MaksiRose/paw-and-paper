import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { respond } from './helperFunctions';
import { Quid, UserSchema } from '../typedef';
const { default_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export function hasName(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserSchema | null,
): userData is UserSchema {

	const quidData = userData?.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];
	if (!quidData || quidData.name === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription(Object.keys(userData?.quids || {}).length > 0 ? 'Please type "/profile" to switch to a quid!' : 'Please type "/name" to create a new quid!')],
		}, true);

		return false;
	}

	return true;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
export function hasSpecies(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	quidData: Quid,
): quidData is Quid<true> {

	if (quidData.species === '') {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription(`To access this command, you need to choose ${quidData?.name}'s species (with "/species")!`)],
		}, true);

		return false;
	}

	return true;
}

/**
 * This is checking if the interaction is in a guild, if it is not, it will reply to the user with a message saying that the command cannot be executed in DMs.
 */
export function isInGuild(
	interaction: ChatInputCommandInteraction
): interaction is ChatInputCommandInteraction<'cached'>
export function isInGuild(
	interaction: ButtonInteraction
): interaction is ButtonInteraction<'cached'>
export function isInGuild(
	interaction: ChatInputCommandInteraction | ButtonInteraction
): interaction is ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>
export function isInGuild(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
): interaction is ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> {

	if (!interaction.inCachedGuild()) {

		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription('This command cannot be executed in DMs!')],
			ephemeral: true,
		}, false);

		return false;
	}

	return true;
}