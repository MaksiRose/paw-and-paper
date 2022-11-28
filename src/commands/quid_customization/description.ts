import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { reply } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('description')
		.setDescription('Give a more detailed description of your quid.')
		.addStringOption(option =>
			option.setName('description')
				.setDescription('The description of your quid.')
				.setMaxLength(512),
		)
		.toJSON(),
	category: 'page1',
	position: 5,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (!hasName(userData, interaction)) { return; }

		const desc = interaction.options.getString('description') || '';

		await userData.update(
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DMs'));
				q.description = desc;
			},
		);

		await reply(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setTitle(userData.quid.description === '' ? 'Your description has been reset!' : `Description for ${userData.quid.name} set:`)
				.setDescription(userData.quid.description || null)],
		}, true);
		return;
	},
};