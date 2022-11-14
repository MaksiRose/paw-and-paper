import { ActionRowBuilder, ChannelType, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from 'discord.js';
import { readFileSync } from 'fs';
import { respond } from '../utils/helperFunctions';
import userModel from '../models/userModel';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';
import { WebhookMessages } from '../typings/data/general';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';

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

		/* This gets the webhookCache and userData */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
		const userData = (() => {
			try { return userModel.findOne(u => u.userId.includes(webhookCache[interaction.targetId]?.split('_')[0] || '')); }
			catch { return null; }
		})();

		/* This is checking if the user who is trying to edit the message is the same user who sent the message. */
		if (userData === null || !userData.userId.includes(interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can edit a proxied message you sent. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				});
			return;
		}

		await interaction.showModal(new ModalBuilder()
			.setCustomId(`edit_${interaction.targetId}`)
			.setTitle('Edit a message')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>({
					components: [new TextInputBuilder()
						.setCustomId('edit-textinput')
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
};

export async function sendEditMessageModalResponse(
	interaction: ModalSubmitInteraction,
) {

	/* Returns if interaction.channel is null. This should not happen as this is checked in interactionCreate. */
	if (!interaction.channel) { return; }

	/* This gets the messageId of the message that will be edited. */
	const messageId = interaction.customId.split('_')[1] || '';

	/* This is checking if the channel is a thread, if it is, it will get the parent channel. If the
	channel is a DM, it will throw an error. If the channel is a guild channel, it will get the
	webhook. If the webhook doesn't exist, it will create one. */
	const webhookChannel = (interaction.channel.isThread() || false) ? interaction.channel.parent : interaction.channel;
	if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	if (webhookChannel.type === ChannelType.DM || interaction.channel.type === ChannelType.DM) { throw new Error('Webhook can\'t be edited, channel is DMChannel.'); }
	if (await canManageWebhooks(interaction.channel) === false) { return; }
	const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	/* This is editing the message with the messageId that was passed in the customId. */
	const webhookMessage = await webhook
		.editMessage(messageId, {
			content: interaction.fields.getTextInputValue('edit-textinput'),
			threadId: interaction.channel.isThread() ? interaction.channel.id : undefined,
		});

	/* This is sending a message to the user that sent the command. */
	await respond(interaction, {
		content: `[Edited!](<${webhookMessage.url}>) ✅`,
		ephemeral: true,
	}, false);
	return;
}