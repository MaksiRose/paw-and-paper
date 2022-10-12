import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData, getQuidDisplayname, respond } from '../../utils/helperFunctions';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('tag')
		.setDescription('A global or server-specific snippet of text appended to your displayed name.')
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('The tag that you want your account to have.')
				.setMaxLength(16))
		.toJSON(),
	category: 'page1',
	position: 8,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		if (!hasName(interaction, userData)) { return; }

		const tag = interaction.options.getString('tag') || '';

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData?._id,
			(u) => {
				if (serverData) { u.tag.servers[serverData.serverId] = tag; }
				else { u.tag.global = tag; }
			},
		);
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
				.setTitle(serverData ? `Tag ${userData.tag.servers[serverData.serverId] ? `set to ${userData.tag.servers[serverData.serverId]}` : 'removed'} in ${serverData.name}!` : `Tag ${userData.tag.global ? `set to ${userData.tag.global}` : 'removed'} globally!`)
				.setDescription(serverData ? 'Tip: Tags can be set globally too by executing the command in DMs. The global tag will be displayed when no server-specific tag has been chosen.' : 'Tip: Tags can be set server-specific too by executing the command in the server. The server-specific tag will overwrite the global tag for that server.')],
		}, true);
		return;
	},
};