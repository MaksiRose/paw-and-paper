import { ChannelType } from 'discord.js';
import { readFileSync } from 'fs';
import { respond } from '../utils/helperFunctions';
import userModel from '../models/userModel';
import { ContextMenuCommand, WebhookMessages } from '../typedef';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';

export const command: ContextMenuCommand = {
	data: {
		name: 'Delete ❌',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client, interaction) => {

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		/* This gets the webhookCache and userData */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
		const userData = await userModel.findOne(u => u.userId.includes(webhookCache[interaction.targetId]?.split('_')[0] || '')).catch(() => { return null; });

		/* This is checking if the user who is trying to delete the message is the same user who sent the message. */
		if (userData === null || !userData.userId.includes(interaction.user.id)) {

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
		if (webhookChannel.type === ChannelType.DM || interaction.channel.type === ChannelType.DM) { throw new Error('Webhook can\'t be edited, channel is DMChannel.'); }
		if (await canManageWebhooks(interaction.channel) === false) { return; }
		const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
			|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

		/* Deleting the message. */
		await webhook.deleteMessage(interaction.targetId, interaction.channel.isThread() ? interaction.channel.id : undefined);

		/* Sending a message to the user who deleted the message. */
		await respond(interaction, {
			content: 'Deleted! ✅',
			ephemeral: true,
		}, false);
		return;
	},
};