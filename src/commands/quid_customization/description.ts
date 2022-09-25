import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getQuidDisplayname, respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';

const name: SlashCommand['name'] = 'description';
const description: SlashCommand['description'] = 'Give a more detailed description of your quid.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('description')
				.setDescription('The description of your quid.')
				.setMaxLength(512),
		)
		.toJSON(),
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		const desc = interaction.options.getString('description') || '';

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData?._id,
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DM'));
				q.description = desc;
			},
		);
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
				.setTitle(quidData.description === '' ? 'Your description has been reset!' : `Description for ${quidData.name} set:`)
				.setDescription(quidData.description || null)],
		}, true);
		return;
	},
};