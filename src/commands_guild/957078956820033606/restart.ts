import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('restart')
		.setDescription('Restart the bot')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		const application = await interaction.client.application.fetch();
		if ((application.owner instanceof User) ? interaction.user.id !== application.owner.id : application.owner ? !application.owner.members.has(interaction.user.id) : false) { return; }

		// This is always a reply
		await respond(interaction, {
			content: 'Restarted!',
		});

		interaction.client.destroy();
		process.exit();
	},
};