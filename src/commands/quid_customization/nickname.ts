import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData, getQuidDisplayname, respond } from '../../utils/helperFunctions';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('nickname')
		.setDescription('A global or server-specific replacement for your regular name.')
		.addStringOption(option =>
			option.setName('nickname')
				.setDescription('The nickname that you want your quid to have.')
				.setMaxLength(48))
		.toJSON(),
	category: 'page1',
	position: 7,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		if (!hasName(interaction, userData)) { return; }

		const nickname = interaction.options.getString('nickname') || '';

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData?._id,
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DM'));
				if (serverData) { q.nickname.servers[serverData.serverId] = nickname; }
				else { q.nickname.global = nickname; }
			},
		);
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
				.setTitle(serverData ? `Nickname for ${quidData.name} ${quidData.nickname.servers[serverData.serverId] ? `set to ${quidData.nickname.servers[serverData.serverId]}` : 'removed'} in ${serverData.name}!` : `Nickname for ${quidData.name} ${quidData.nickname.global ? `set to ${quidData.nickname.global}` : 'removed'} globally!`)
				.setDescription(serverData ? 'Tip: Nicknames can be set globally too by executing the command in DMs. The global nickname will be displayed when no server-specific nickname has been chosen.' : 'Tip: Nicknames can be set server-specific too by executing the command in the server. The server-specific nickname will overwrite the global nickname for that server.')],
		}, true);
		return;
	},
};