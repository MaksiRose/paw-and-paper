import { MessageContextMenuInteraction } from 'discord.js';
import { readFileSync } from 'fs';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { ContextMenuCommand, CustomClient, WebhookMessages } from '../typedef';

export const command: ContextMenuCommand = {
	name: 'Delete ❌',
	data: {
		name: module.exports.name,
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client: CustomClient, interaction: MessageContextMenuInteraction) => {

		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
		const userData = await userModel.findOne({ userId: webhookCache?.[interaction.targetId]?.split('_')?.[0] }).catch(() => { return null; });

		if (userData === null || userData.userId !== interaction.user.id) {

			await interaction
				.reply({
					content: 'With this command, you can delete a proxied message you sent. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (!interaction.channel) { throw new Error('Interaction channel cannot be found.'); }
		const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
		if (!webhookChannel || webhookChannel.type === 'DM') { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
		const webhook = (await webhookChannel
			.fetchWebhooks()
			.catch(async (error) => {
				if (error.httpStatus === 403) {
					await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				}
				throw new Error(error);
			})
		).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
			.createWebhook('PnP Profile Webhook')
			.catch(async (error) => {
				if (error.httpStatus === 403) {
					await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				}
				throw new Error(error);
			});

		await webhook
			.deleteMessage(interaction.targetId, interaction.channel.isThread() ? interaction.channel.id : undefined)
			.catch((error) => { throw new Error(error); });

		await respond(interaction, {
			content: 'Deleted! ✅',
			ephemeral: true,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	},
};