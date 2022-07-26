import { SlashCommandBuilder } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import { SlashCommand } from '../../typedef';

const name: SlashCommand['name'] = 'uptime';
const description: SlashCommand['description'] = 'How long the bot has been online for and its ping.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction) => {

		await respond(interaction, {
			content: `Uptime: ${Math.floor((client.uptime || 0) / 3600000)} hours ${Math.floor((client.uptime || 0) / 60000) % 60} minutes\nPing: ${client.ws.ping} ms`,
		}, true);
	},
};