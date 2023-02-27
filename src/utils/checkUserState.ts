import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, MessageContextMenuCommandInteraction, AnySelectMenuInteraction } from 'discord.js';
import { respond } from './helperFunctions';
import Quid from '../models/quid';
import User from '../models/user';
const { default_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export function hasName(
	quid: Quid | null | undefined,
	options?: {interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction, user: User},
): quid is Quid {

	if (quid === null || quid === undefined || quid.name === '') {

		if (options) {

			// This is always a reply
			respond(options.interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setDescription(options.user.quids.length > 0 ? 'Please type "/profile" to switch to a quid!' : 'Please type "/name" to create a new quid!')],
			});
		}

		return false;
	}

	return true;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
export function hasNameAndSpecies(
	quid: Quid | null | undefined,
	options?: {interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction, user: User},
): quid is Quid<true> {

	if (!hasName(quid, options)) { return false; }
	if (quid.species === '' || quid.species === null) {

		if (options) {

			// This is always a reply
			respond(options.interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setDescription(`To access this command, you need to choose ${quid.name}'s species (with "/species")!`)],
			});
		}

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
	interaction: AnySelectMenuInteraction
): interaction is AnySelectMenuInteraction<'cached'>
export function isInGuild(
	interaction: MessageContextMenuCommandInteraction
): interaction is MessageContextMenuCommandInteraction<'cached'>
export function isInGuild(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | MessageContextMenuCommandInteraction
): interaction is ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'> | MessageContextMenuCommandInteraction<'cached'>
export function isInGuild(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | MessageContextMenuCommandInteraction,
): interaction is ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'> | MessageContextMenuCommandInteraction <'cached'> {

	if (!interaction.inCachedGuild()) {

		// This is always a reply
		respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription('This command cannot be executed in DMs!')],
			ephemeral: true,
		});

		return false;
	}

	return true;
}