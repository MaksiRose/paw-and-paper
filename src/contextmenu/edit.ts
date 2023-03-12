import { ActionRowBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../utils/helperFunctions';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import Webhook from '../models/webhook';
import Quid from '../models/quid';
import User from '../models/user';
import DiscordUser from '../models/discordUser';

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
						.setMinLength(1)
						.setMaxLength(2048)
						.setValue(interaction.targetMessage.content),
					],
				}),
			),
		);
	},
	async sendModalResponse(interaction) {

		/* Returns if interaction.channel is null. This should not happen as this is checked in interactionCreate. */
		if (!interaction.channel) { return; }

		/* This gets the messageId of the message that will be edited. */
		const messageId = interaction.customId.split('_')[1] || '';

		/* This is checking if the channel is a thread, if it is, it will get the parent channel. If the channel is a DM, it will throw an error. If the channel is a guild channel, it will get the webhook. If the webhook doesn't exist, it will create one. */
		const webhookChannel = (interaction.channel.isThread() || false) ? interaction.channel.parent : interaction.channel;
		if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
		if (webhookChannel.type === ChannelType.DM || interaction.channel.type === ChannelType.DM) { throw new Error('Webhook can\'t be edited, channel is DMChannel.'); }
		if (webhookChannel.type === ChannelType.GuildStageVoice) { throw new Error('discord.js is janky'); }
		if (await canManageWebhooks(interaction.channel) === false) { return; }
		const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

		/* This is editing the message with the messageId that was passed in the customId. */
		const webhookMessage = await webhook
			.editMessage(messageId, {
				content: interaction.fields.getTextInputValue('text'),
				threadId: interaction.channel.isThread() ? interaction.channel.id : undefined,
			});

		// This is always a reply
		await respond(interaction, {
			content: `[Edited!](<${webhookMessage.url}>) ✅`,
			ephemeral: true,
		});
		return;
	},
};