import { respond } from '../utils/helperFunctions';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import Webhook from '../models/webhook';
import Quid from '../models/quid';
import User from '../models/user';
import DiscordUser from '../models/discordUser';
import { ChannelType } from 'discord.js';

export const command: ContextMenuCommand = {
	data: {
		name: 'Delete ❌',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		/* This gets the webhookData and discordUsers */
		const webhookData = await Webhook.findByPk(interaction.targetId, {
			attributes: [], include: [{
				model: Quid, as: 'quid', attributes: ['userId'], include: [{
					model: User, as: 'user', attributes: ['id'], include: [{
						model: DiscordUser, as: 'discordUsers', attributes: ['id'],
					}],
				}],
			}],
		});
		const discordUsers = webhookData?.quid?.user?.discordUsers ?? [];

		/* This is checking if the user who is trying to delete the message is the same user who sent the message. */
		if (!discordUsers.some(du => du.id === interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can delete a proxied message you sent. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				});
			return;
		}

		/* This is checking if the channel is a thread, if it is, it will get the parent channel. If the
		channel is a DM, it will throw an error. If the channel is a guild channel, it will get the
		webhook. If the webhook doesn't exist, it will create one. */
		if (interaction.channel === null) { throw new Error('Interaction channel is null.'); }
		const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
		if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
		if (webhookChannel.type === ChannelType.GuildStageVoice) { throw new Error('discord.js is janky'); }
		if (await canManageWebhooks(interaction.channel) === false) { return; }
		const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
			|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

		/* Deleting the message. */
		await webhook.deleteMessage(interaction.targetId, interaction.channel.isThread() ? interaction.channel.id : undefined);
		await webhookData?.destroy();

		// This is always a reply
		await respond(interaction, {
			content: 'Deleted! ✅',
			ephemeral: true,
		});
		return;
	},
};