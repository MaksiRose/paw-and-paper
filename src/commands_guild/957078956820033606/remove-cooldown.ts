import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { cooldownMap } from '../../events/interactionCreate';
import { client } from '../..';
import { SlashCommand } from '../../typings/handle';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('remove-cooldown')
		.setDescription('Remove the cooldown of a user in a guild')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user to remove the cooldown of')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('guild')
				.setDescription('The guild to remove the cooldown in')
				.setRequired(true))
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		if (!client.isReady()) { return; }

		await client.application.fetch();
		if ((client.application.owner instanceof User) ? interaction.user.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(interaction.user.id) : false) { return; }

		const user = interaction.options.getUser('user');
		const guildId = interaction.options.getString('guild');
		if (user === null || guildId === null) { throw new TypeError('user or guildId is null'); }

		const userData = await userModel
			.findOne(u => u.userId.includes(user.id))
			.catch(() => { return null; });

		if (!userData) {

			await respond(interaction, {
				content: `The user "${user.tag}" does not have an account`,
				ephemeral: true,
			}, false);
			return;
		}

		const guild = await client.guilds
			.fetch(guildId)
			.catch(() => { return null; });

		if (!guild) {

			await respond(interaction, {
				content: `A guild with the ID "${guildId}" does not exist or Paw and Paper isn't in it`,
				ephemeral: true,
			}, false);
			return;
		}

		if (!cooldownMap.has(userData._id + guildId)) {

			await respond(interaction, {
				content: `There is no cooldown entry for ${user.tag} in ${guild.name}`,
				ephemeral: true,
			}, false);
			return;
		}

		if (cooldownMap.get(userData._id + guildId) === false) {

			await respond(interaction, {
				content: `The cooldown for ${user.tag} in ${guild.name} is already set to false`,
				ephemeral: true,
			}, false);
			return;
		}

		cooldownMap.set(userData._id + guildId, false);
		await respond(interaction, {
			content: `Sucessfully set the cooldown for ${user.tag} in ${guild.name} to false`,
		}, false);
	},
};