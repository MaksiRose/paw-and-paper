import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import Quid from '../../models/quid';
import { getDisplayname } from '../../utils/getQuidInfo';

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		const desc = interaction.options.getString('description') || '';
		await quid.update({ description: desc });

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(quid.description === '' ? 'Your description has been reset!' : `Description for ${quid.name} set:`)
				.setDescription(quid.description || null)],
		});
		return;
	},
};