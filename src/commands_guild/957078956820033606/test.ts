import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../typedef';
import { PlayerData } from '../../utils/playerData';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('test the bot')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData) => {

		await interaction.reply({ ephemeral: true, content: ':)' });
		if (userData === null || interaction.guildId === null) { return; }
		const playerData = new PlayerData(userData, interaction.guildId);
		console.log(playerData.quid?.profile.energy);
		await playerData.update(u => u.quids[playerData.quid!._id]!.profiles[interaction.guildId!]!.energy += 1);
		console.log(playerData.quid?.profile.energy);
	},
};