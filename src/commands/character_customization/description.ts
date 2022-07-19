import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';

const name: SlashCommand['name'] = 'description';
const description: SlashCommand['description'] = 'Give a more detailed description of your character.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('description')
				.setDescription('The description of your character.')
				.setMaxLength(512),
		)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		const description = interaction.options.getString('description') || '';

		await userModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(u) => {
				u.characters[u.currentCharacter[interaction.guildId || 'DM']].description = description;
			},
		);
		const characterData = userData.characters[userData.currentCharacter[interaction.guildId || 'DM']];

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(characterData.color)
				.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
				.setTitle(characterData.description === '' ? 'Your description has been reset!' : `Description for ${characterData.name} set:`)
				.setDescription(characterData.description || null)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	},
};