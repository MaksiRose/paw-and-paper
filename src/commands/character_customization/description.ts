import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/getInfo';

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

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData?.uuid,
			(u) => {
				const c = getMapData(u.characters, getMapData(u.currentCharacter, interaction.guildId || 'DM'));
				c.description = description;
			},
		);
		const characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId || 'DM'));

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