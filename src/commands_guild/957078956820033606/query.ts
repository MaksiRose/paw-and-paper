import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { objectHasKey, respond } from '../../utils/helperFunctions';
import { client, sequelize } from '../..';
import { SlashCommand } from '../../typings/handle';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('query')
		.setDescription('Make an SQL query')
		.addStringOption(option =>
			option.setName('query')
				.setDescription('The query you want to run')
				.setRequired(true))
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		if (!client.isReady()) { return; }

		await client.application.fetch();
		if ((client.application.owner instanceof User) ? interaction.user.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(interaction.user.id) : false) { return; }

		const query = interaction.options.getString('query', true);


		try {

			const [result] = await sequelize.query(query);

			// This is always a reply
			await respond(interaction, {
				content: `\`\`\`${JSON.stringify(result, null, 2)}\`\`\``,
			});
		}
		catch (error) {

			// This is always a reply
			await respond(interaction, {
				content: `Error executing query: ${typeof error === 'object' && error !== null && objectHasKey(error, 'message') ? error.message : error}`,
			});
		}
	},
};