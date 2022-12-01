import { SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { client } from '../..';
import { SlashCommand } from '../../typings/handle';

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

		// This is always a reply
		await respond(interaction, {
			content: `Uptime: ${Math.floor(interaction.client.uptime / 3600000)} hours ${Math.floor(interaction.client.uptime / 60000) % 60} minutes\nPing: ${client.ws.ping} ms\nServer count: ${client.guilds.cache.size}`,
		});
	},
};