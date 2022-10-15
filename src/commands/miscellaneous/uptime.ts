import { SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typedef';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('uptime')
		.setDescription('How long the bot has been online for and its ping.')
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		await respond(interaction, {
			content: `Uptime: ${Math.floor((client.uptime || 0) / 3600000)} hours ${Math.floor((client.uptime || 0) / 60000) % 60} minutes\nPing: ${client.ws.ping} ms\nFinal permissions: ${interaction.guild!.members.me?.permissionsIn(interaction.channelId).toArray().join(', ')}`,
		}, true);
	},
};