import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { getMapData, respond } from '../../utils/helperFunctions';

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (!user) { throw new TypeError('user is undefined'); }
		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // this would always be a reply

		const nickname = interaction.options.getString('nickname') || '';

		await userData.update(
			(u) => {
				const q = getMapData(u.quids, getMapData(u.servers, interaction.guildId || 'DMs').currentQuid ?? '');
				if (serverData) { q.nickname.servers[serverData.serverId] = nickname; }
				else { q.nickname.global = nickname; }
			},
		);

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(serverData ? `Nickname for ${userData.quid.name} ${userData.quid.nickname.server ? `set to ${userData.quid.nickname.server}` : 'removed'} in ${serverData.name}!` : `Nickname for ${userData.quid.name} ${userData.quid.nickname.global ? `set to ${userData.quid.nickname.global}` : 'removed'} globally!`)
				.setDescription(serverData ? 'Tip: Nicknames can be set globally too by executing the command in DMs. The global nickname will be displayed when no server-specific nickname has been chosen.' : 'Tip: Nicknames can be set server-specific too by executing the command in the server. The server-specific nickname will overwrite the global nickname for that server.')],
		});
		return;
	},
};