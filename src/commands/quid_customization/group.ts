import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../typings/handle';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('group')
		.setDescription('Create, delete, edit, join and leave groups.')
		.toJSON(),
	category: 'page1',
	position: 10,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		// stuff
	},
};