import { ActionRowBuilder, ForumChannel, Message, ModalBuilder, ModalSubmitInteraction, NewsChannel, StageChannel, TextChannel, TextInputBuilder, TextInputStyle, VoiceChannel, WebhookClient, Webhook as DiscordWebhook, EmbedBuilder, APIMessage, time } from 'discord.js';
import { respond } from '../utils/helperFunctions';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import Webhook from '../models/webhook';
import Quid from '../models/quid';
import User from '../models/user';
import DiscordUser from '../models/discordUser';
import Channel from '../models/channel';
import ProxyLimits from '../models/proxyLimits';
import Server from '../models/server';
import { getDisplayname } from '../utils/getQuidInfo';
import UserToServer from '../models/userToServer';

export const command: ContextMenuCommand = {
	data: {
		name: 'Edit 📝',
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
			include: [{
				model: Quid, as: 'quid', attributes: ['userId'],
			}],
		});
		const discordUsers = await DiscordUser.findAll({ where: { userId: webhookData?.quid?.userId } }) ?? [];

		/* This is checking if the user who is trying to delete the message is the same user who sent the message. */
		if (!discordUsers.some(du => du.id === interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can edit a proxied message you sent. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				});
			return;
		}

		await interaction.showModal(new ModalBuilder()
			.setCustomId(`${command.data.name}_${interaction.targetId}`)
			.setTitle('Edit a message')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>({
					components: [new TextInputBuilder()
						.setCustomId('text')
						.setLabel('Text')
						.setStyle(TextInputStyle.Paragraph)
						.setMinLength(interaction.targetMessage.attachments.size > 0 ? 0 : 1)
						.setMaxLength(2048)
						.setValue(interaction.targetMessage.content),
					],
				}),
			),
		);
	},
	async sendModalResponse(interaction, { server, user, userToServer }) {

		/* Returns if interaction.channel is null. This should not happen as this is checked in interactionCreate. */
		if (!interaction.inCachedGuild()) { return; }

		const messageId = interaction.customId.split('_')[1] || '';

		/* This is checking if the channel is a thread, if it is, it will get the parent channel. If the channel is a DM, it will throw an error. If the channel is a guild channel, it will get the webhook. If the webhook doesn't exist, it will create one. */
		if (!interaction.channel) { return; }
		if (!server) { return; }
		if (await canManageWebhooks(interaction.channel) === false) { return; }

		const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
		if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }

		/* This gets the messageId of the message that will be edited. */
		const webhookMessage = await editWebhookMessage(interaction, messageId, webhookChannel, server, user, userToServer);
		if (!webhookMessage) { return; }

		// This is always a reply
		await respond(interaction, {
			content: `[Edited!](<${webhookMessage instanceof Message ? webhookMessage.url : `https://discord.com/channels/${webhookChannel.guildId}/${webhookMessage.channel_id}/${webhookMessage.id}`}>) ✅`,
			ephemeral: true,
		});
		return;
	},
};

async function editWebhookMessage(
	interaction: ModalSubmitInteraction<'cached'>,
	messageId: string,
	webhookChannel: NewsChannel | StageChannel | TextChannel | VoiceChannel | ForumChannel,
	server: Server,
	user?: User,
	userToServer?: UserToServer,
):Promise<Message<boolean> | APIMessage> {

	const channelData = await Channel.findByPk(webhookChannel.id);
	const webhook = channelData
		? new WebhookClient({ url: channelData.webhookUrl })
		: (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	if (webhook instanceof DiscordWebhook) { Channel.create({ id: webhookChannel.id, serverId: webhookChannel.guildId, webhookUrl: webhook.url }); }

	/* This is editing the message with the messageId that was passed in the customId. */
	const webhookMessage = await webhook
		.editMessage(messageId, {
			content: interaction.fields.getTextInputValue('text'),
			threadId: interaction.channel!.isThread() ? interaction.channel.id : undefined,
		})
		.catch(async (err) => {
			if (err.message && err.message.includes('Unknown Webhook') && channelData) {

				await channelData.destroy();
				return await editWebhookMessage(interaction, messageId, webhookChannel, server, user, userToServer);
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

			const webhookData = await Webhook.findByPk(webhookMessage.id);
			const quid = webhookData ? await Quid.findByPk(webhookData.quidId) : null;

			console.log(webhookMessage instanceof Message, webhookMessage instanceof Message ? webhookMessage.createdTimestamp : webhookMessage.timestamp, webhookMessage instanceof Message ? webhookMessage.createdTimestamp : Number(webhookMessage.timestamp));
			logChannel.send({
				content: `**A message got edited**\nMessage Link: https://discord.com/channels/${interaction.guildId}/${interaction.channelId!}/${webhookMessage.id}\nSent by: <@${interaction.user.id}> ${interaction.user.tag}\nQuid ID: ${webhookData?.quidId || '`Missing`'}\nOriginally sent on: ${time(Math.floor((webhookMessage instanceof Message ? webhookMessage.createdTimestamp : Date.parse(webhookMessage.timestamp)) / 1000), 'f')}`,
				embeds: [new EmbedBuilder()
					.setAuthor({
						name: quid ? await getDisplayname(quid, { serverId: webhookChannel.guildId, user, userToServer }) : 'Missing',
						iconURL: quid?.avatarURL,
					})
					.setColor(quid?.color ?? null)
					.setTitle('New Message:')
					.setDescription(interaction.fields.getTextInputValue('text') || null)],
				allowedMentions: { parse: [] },
			});
		}
	})();

	return webhookMessage;
}
