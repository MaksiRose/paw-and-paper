import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import Quid from '../../models/quid';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { getDisplayname } from '../../utils/getQuidInfo';
import { respond } from '../../utils/helperFunctions';

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		const tag = interaction.options.getString('tag') || '';

		if (interaction.inGuild()) {

			if (!userToServer) { throw new TypeError('userToServer is undefined'); }
			await userToServer.update({ tag: tag });
		}
		else { await user.update({ tag: tag }); }

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(userToServer ? `Tag ${userToServer.tag ? `set to ${userToServer.tag}` : 'removed'} in ${interaction.guild?.name}!` : `Tag ${user.tag ? `set to ${user.tag}` : 'removed'} globally!`)
				.setDescription(userToServer ? 'Tip: Tags can be set globally (cross-server) too by executing the command in DMs. The global tag will be displayed when no server-specific tag has been chosen.' : 'Tip: Tags can be set server-specific too by executing the command in the server. The server-specific tag will overwrite the global tag for that server.')],
		});
		return;
	},
};