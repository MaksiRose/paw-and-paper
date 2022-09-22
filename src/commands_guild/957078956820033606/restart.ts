import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typedef';

const name: SlashCommand['name'] = 'restart';
const description: SlashCommand['description'] = 'Restart the bot';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction) => {

		if (!client.isReady()) { return; }

		await client.application.fetch();
		if ((client.application.owner instanceof User) ? interaction.user.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(interaction.user.id) : false) { return; }

		await respond(interaction, {
			content: 'Restarted!',
		}, false);

		client.destroy();
		process.exit();
	},
};