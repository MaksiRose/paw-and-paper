import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, MessageContextMenuCommandInteraction, AnySelectMenuInteraction } from 'discord.js';
import { reply } from './helperFunctions';
import { UserData } from '../typings/data/user';
const { default_color } = require('../../config.json');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 */
export function hasName(
	userData: UserData<undefined, ''> | null | undefined,
	interaction?: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
): userData is UserData<never, ''> {

	if (userData?.quid === undefined || userData.quid.name === '') {

		if (interaction) {

			reply(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setDescription(Object.keys(userData?.quids || {}).length > 0 ? 'Please type "/profile" to switch to a quid!' : 'Please type "/name" to create a new quid!')],
			}, true);
		}

		return false;
	}

	return true;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 */
export function hasNameAndSpecies(
	userData: UserData<undefined, ''> | null | undefined,
	interaction?: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
): userData is UserData<never, never> {

	if (!hasName(userData, interaction)) { return false; }
	if (userData.quid.species === '') {

		if (interaction) {

			reply(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setDescription(`To access this command, you need to choose ${userData.quid.name}'s species (with "/species")!`)],
			}, true);
		}

		return false;
	}
	if (userData.quid.profile === undefined) {

		if (interaction) {

			reply(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setDescription('Uh-oh, an error occurred and some data is missing. Please use "/profile" to select another quid (or an empty slot) and then re-select this quid. If this error persists, open a ticket with "/ticket".')],
			}, true);
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

		reply(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription('This command cannot be executed in DMs!')],
			ephemeral: true,
		}, false);

		return false;
	}

	return true;
}