import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import e from 'express';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CustomClient, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
import { hasCooldown } from '../../utils/checkValidity';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'profile';
const description: SlashCommand['description'] = 'Look up all the available info about a character or change the character you are using.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the profile of.')
				.setRequired(false))
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client: CustomClient, interaction: CommandInteraction, userData: UserSchema | null, serverData: ServerSchema | null, embedArray: MessageEmbed[]) => {

		/* Getting userData and characterData either for mentionedUser if there is one or for interaction user otherwise */
		const mentionedUser = interaction.options.getUser('user');
		userData = await userModel.findOne({ userId: !mentionedUser ? interaction.user.id : mentionedUser.id }).catch(() => { return null; });
		const characterData = userData ? userData.characters[userData.currentCharacter[interaction.guildId || 'DM']] : null;

		/* Responding if there is no userData */
		if (!userData) {

			if (!mentionedUser) {

				hasName(interaction, characterData);
			}
			else {

				await respond(interaction, {
					embeds: [{
						color: error_color,
						title: 'This user has no account!',
					}],
				}, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}
		}
		/* Checking if the user has a cooldown. */
		else if (characterData && interaction.inGuild() && await hasCooldown(interaction, userData, module.exports.aliases.concat(module.exports.name))) {

			return;
		}
	},
};