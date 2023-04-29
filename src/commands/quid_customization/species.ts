import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import Quid from '../../models/quid';
import { getDisplayname } from '../../utils/getQuidInfo';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('species')
		.setDescription('Change your quid\'s displayed species.')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the species that you want to be displayed for your quid.')
				.setMaxLength(24)
				.setRequired(false))
		.toJSON(),
	category: 'page1',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		const displayedSpecies = interaction.options.getString('name') ?? '';

		await quid.update({ displayedSpecies: displayedSpecies });

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
		});
		return;
	},
};