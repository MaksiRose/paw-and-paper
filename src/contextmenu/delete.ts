import { respond } from '../utils/helperFunctions';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import Webhook from '../models/webhook';
import Quid from '../models/quid';
import DiscordUser from '../models/discordUser';
import Channel from '../models/channel';
import { WebhookClient, Webhook as DiscordWebhook, time } from 'discord.js';
import ProxyLimits from '../models/proxyLimits';
const { webhook_name } = require('../../config.json');

export const command: ContextMenuCommand = {
	data: {
		name: 'Delete ❌',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction, { server }) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }
		if (!server) { throw new TypeError('server is undefined'); }

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		const targetMessageCreatedTimestamp = interaction.targetMessage.createdTimestamp;

		/* This gets the webhookData and discordUsers */
		const webhookData = await Webhook.findByPk(interaction.targetId, {
			include: [{
				model: Quid, as: 'quid', attributes: ['userId'],
			}],
		});

		if (!webhookData) {

			await interaction
				.reply({
					content: 'With this command, you can delete a proxied message you sent. Either the selected message is not a proxied message, or it hasn\'t been proxied by this bot.',
					ephemeral: true,
				});
			return;
		}

		const discordUsers = await DiscordUser.findAll({ where: { userId: webhookData.quid.userId } }) ?? [];

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
		if (await canManageWebhooks(interaction.channel) === false) { return; }

		const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
		if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }

		const channelData = await Channel.findByPk(webhookChannel.id);
		const webhook = channelData
			? new WebhookClient({ url: channelData.webhookUrl })
			: (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === webhook_name)
			|| await webhookChannel.createWebhook({ name: webhook_name });

		if (webhook instanceof DiscordWebhook) { Channel.create({ id: webhookChannel.id, serverId: webhookChannel.guildId, webhookUrl: webhook.url }); }

		/* Deleting the message. */
		await webhook
			.deleteMessage(interaction.targetId, interaction.channel.isThread() ? interaction.channel.id : undefined)
			.catch(async err => {
				if (err.message && (err.message.includes('Unknown Webhook') || err.message.includes('The provided webhook URL is not valid')) && channelData) {

					await channelData.destroy();
					return await command.sendCommand(interaction, { server });
				}
				throw err;
			});

		(async function() {
			if (server.logChannelId !== null) {

				const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
				if (logLimits
					&& (
						(logLimits.setToWhitelist === true && !logLimits.whitelist.includes(interaction.channel!.id) && !logLimits.whitelist.includes(webhookChannel.id))
					|| (logLimits.setToWhitelist === false && (logLimits.blacklist.includes(interaction.channel!.id) || logLimits.blacklist.includes(webhookChannel.id)))
					)) { return; }

				const logChannel = await interaction.guild.channels.fetch(server.logChannelId);
				if (!logChannel || !logChannel.isTextBased()) { return; }

				logChannel.send({
					content: `**A message got deleted**\nMessage Link: https://discord.com/channels/${interaction.guildId}/${interaction.channelId!}/${interaction.targetId}\nSent by: <@${interaction.user.id}> ${interaction.user.tag}\nQuid ID: ${webhookData?.quidId || '`Missing`'}\nOriginally sent on: ${time(Math.floor((targetMessageCreatedTimestamp) / 1000), 'f')}`,
					allowedMentions: { parse: [] },
				});
			}
		})();
		await webhookData?.destroy();

		// This is always a reply
		await respond(interaction, {
			content: 'Deleted! ✅',
			ephemeral: true,
		});
		return;
	},
};