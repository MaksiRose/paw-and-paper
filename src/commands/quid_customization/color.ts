import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import Quid from '../../models/quid';
import { getDisplayname } from '../../utils/getQuidInfo';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		/* Checking if the user has sent a valid hex code. If they have not, it will send an error message. */
		const hexColor = interaction.options.getString('hex');
		if (!hexColor || !isValidHex(hexColor)) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please send a valid hex code! Valid hex codes consist of 6 characters and contain only letters from \'a\' to \'f\' and/or numbers.')],
				ephemeral: true,
			});
			return;
		}

		/* Changing the hex code and sending a success message. */
		await quid.update({ color: `#${hexColor}` });

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(`Profile color set to ${quid.color}!`)],
		});
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