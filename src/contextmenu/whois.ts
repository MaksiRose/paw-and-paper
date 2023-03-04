import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { CustomIdArgs, getProfileMessageOptions } from '../commands/quid_customization/profile';
import { respond } from '../utils/helperFunctions';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import { constructCustomId } from '../utils/customId';
import Webhook from '../models/webhook';
import Quid from '../models/quid';
import User from '../models/user';
import DiscordUser from '../models/discordUser';
import UserToServer from '../models/userToServer';

export const command: ContextMenuCommand = {
	data: {
		name: 'Who is ❓',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }

		/* This is checking whether the message is a webhook message, and if it is, it gets the userId of the webhook. */
		const webhookData = await Webhook.findByPk(interaction.targetId, {
			include: [{
				model: Quid,
				as: 'quid',
				include: [{
					model: User,
					as: 'user',
				}],
			}],
		});
		const webhookQuid = webhookData?.quid;
		const webhookUser = webhookQuid?.user;
		const webhookDiscordUserId = webhookData?.discordUserId;

		if (webhookData === null && interaction.targetMessage.author.bot) {

			await interaction
				.reply({
					content: 'This webhook was not sent by Paw and Paper, or an error occured!',
					ephemeral: true,
				});
			return;
		}

		/* Here, we are first checking if the information has been retrieved by the webhook information. If not, it is assumed that the message is by a normal user and not by a webhook, so we are using that information instead */
		const targetUser = webhookUser ?? (await DiscordUser.findByPk(interaction.targetMessage.author.id, {
			include: [{ model: User, as: 'user' }],
		}))?.user;
		const targetQuid = webhookQuid ?? (targetUser ? (await UserToServer.findOne({
			where: { serverId: interaction.guildId, userId: targetUser.id },
			include: [{ model: Quid, as: 'activeQuid' }],
		}))?.activeQuid ?? undefined : undefined);
		const targetDiscordUserId = webhookDiscordUserId ?? interaction.targetMessage.author.id;

		if (targetUser === undefined) {

			await interaction
				.reply({
					content: 'The user of the message you selected has no account, or an error occured!',
					ephemeral: true,
				});
			return;
		}


		const member = await interaction.guild.members.fetch(targetDiscordUserId).catch(() => { return undefined; });
		const user = member ? member.user : await interaction.client.users.fetch(targetDiscordUserId).catch(() => { return undefined; });

		const embedArray = [new EmbedBuilder()
			.setColor(member?.displayColor || user?.accentColor || '#ffffff')
			.setAuthor({
				name: member?.displayName || user?.username || targetDiscordUserId,
				iconURL: member?.displayAvatarURL() || user?.avatarURL() || undefined,
			})
			.setDescription(`${interaction.targetMessage.content}\n[jump](${interaction.targetMessage.url})`)
			.setFields([{
				name: 'Sent by:',
				value: `<@${targetDiscordUserId}> ${user?.tag ? `/ ${user.tag}` : ''}`,
			}])
			.setTimestamp(new Date())];

		const response = await getProfileMessageOptions(targetDiscordUserId, targetQuid, targetDiscordUserId === interaction.user.id, { serverId: interaction.guildId, user: targetUser }, embedArray);

		// This is always a reply
		await respond(interaction, {
			...response,
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>('profile', interaction.user.id, ['learnabout', targetDiscordUserId]))
					.setLabel('Learn more (sends a DM)')
					.setStyle(ButtonStyle.Success)])],
			ephemeral: true,
		});
	},
};