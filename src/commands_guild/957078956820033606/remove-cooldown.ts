import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
import DiscordUser from '../../models/discordUser';
import UserModel from '../../models/user';
import UserToServer from '../../models/userToServer';

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

		const application = await interaction.client.application.fetch();
		if ((application.owner instanceof User) ? interaction.user.id !== application.owner.id : application.owner ? !application.owner.members.has(interaction.user.id) : false) { return; }

		const user = interaction.options.getUser('user');
		const guildId = interaction.options.getString('guild');
		if (user === null || guildId === null) { throw new TypeError('user or guildId is null'); }

		const discordUser = await DiscordUser.findByPk(user.id, {
			include: [{ model: UserModel, as: 'user' }],
		});
		const userData = discordUser?.user;

		if (!userData) {

			// This is always a reply
			await respond(interaction, {
				content: `The user "${user.tag}" does not have an account`,
				ephemeral: true,
			});
			return;
		}

		const guild = await interaction.client.guilds
			.fetch(guildId)
			.catch(() => { return null; });

		if (!guild) {

			// This is always a reply
			await respond(interaction, {
				content: `A guild with the ID "${guildId}" does not exist or Paw and Paper isn't in it`,
				ephemeral: true,
			});
			return;
		}

		const serverInfo = await UserToServer.findOne({ where: { userId: userData.id, serverId: guildId } });
		if (serverInfo === null) {

			// This is always a reply
			await respond(interaction, {
				content: `There is no user-to-server relationship between user ${user.tag} and server ${guild.name}`,
				ephemeral: true,
			});
			return;
		}

		if (serverInfo.hasCooldown === false) {

			// This is always a reply
			await respond(interaction, {
				content: `The cooldown for user ${user.tag} in server ${guild.name} is already set to false`,
				ephemeral: true,
			});
			return;
		}

		await serverInfo.update({ hasCooldown: false });

		// This is always a reply
		await respond(interaction, {
			content: `Sucessfully set the cooldown for ${user.tag} in ${guild.name} to false`,
		});
	},
};