import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import Quid from '../../models/quid';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { getDisplayname } from '../../utils/getQuidInfo';
import { respond } from '../../utils/helperFunctions';

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!user) { throw new TypeError('user is undefined'); }
		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // this would always be a reply

		const nickname = interaction.options.getString('nickname') || '';

		if (quidToServer) { await quidToServer.update({ nickname: nickname }); }
		else { await quid.update({ nickname: nickname }); }

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(quidToServer ? `Nickname for ${quid.name} ${quidToServer.nickname ? `set to ${quidToServer.nickname}` : 'removed'} in ${interaction.guild?.name}!` : `Nickname for ${quid.name} ${quid.nickname ? `set to ${quid.nickname}` : 'removed'} globally!`)
				.setDescription(quidToServer ? 'Tip: Nicknames can be set globally too by executing the command in DMs. The global nickname will be displayed when no server-specific nickname has been chosen.' : 'Tip: Nicknames can be set server-specific too by executing the command in the server. The server-specific nickname will overwrite the global nickname for that server.')],
		});
		return;
	},
};