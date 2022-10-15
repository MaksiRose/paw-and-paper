import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getQuidDisplayname, respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('color')
		.setDescription('Enter a valid hex code to give your messages and profile that color.')
		.addStringOption(option =>
			option.setName('hex')
				.setDescription('Valid hex codes consist of 6 characters containing letters from \'a\' to \'f\' and/or numbers.')
				.setMinLength(6)
				.setMaxLength(6)
				.setRequired(true))
		.toJSON(),
	category: 'page1',
	position: 4,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		/* Checking if the user has sent a valid hex code. If they have not, it will send an error message. */
		const hexColor = interaction.options.getString('hex');
		if (!hexColor || !isValidHex(hexColor)) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please send a valid hex code! Valid hex codes consist of 6 characters and contain only letters from \'a\' to \'f\' and/or numbers.')],
				ephemeral: true,
			}, false);
			return;
		}

		/* Changing the hex code and sending a success message. */
		userData = await userModel.findOneAndUpdate(
			u => u._id === userData?._id,
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DM'));
				q.color = `#${hexColor}`;
			},
		);
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
				.setTitle(`Profile color set to ${quidData.color}!`)],
		}, true);
		return;
	},
};

/**
 * Checks if a string is a valid hex code.
 * @param input - The string to check.
 * @returns Whether the string is a valid hex code.
 */
function isValidHex(input: string): boolean {

	const hexLegend = '0123456789abcdef';

	if (input.length !== 6) {

		return false;
	}

	for (let i = 0; i < input.length; i++) {

		const char = input[i];
		if (char && hexLegend.includes(char)) { continue; }
		return false;
	}

	return true;
}