import { ActionRowBuilder, ChannelType, Message, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from 'discord.js';
import { readFileSync } from 'fs';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { ContextMenuCommand, WebhookMessages } from '../typedef';

const name: ContextMenuCommand['name'] = 'Edit 📝';
export const command: ContextMenuCommand = {
	name: name,
	data: {
		name: name,
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client, interaction) => {

		/* This gets the webhookCache and userData */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
		const userData = await userModel.findOne(u => u.userId.includes(webhookCache[interaction.targetId]?.split('_')?.[0])).catch(() => { return null; });

		/* This is checking if the user who is trying to edit the message is the same user who sent the message. */
		if (userData === null || !userData.userId.includes(interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can edit a proxied message you sent. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		await interaction.showModal(new ModalBuilder()
			.setCustomId(`edit-${interaction.targetId}`)
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

export const sendEditMessageModalResponse = async (interaction: ModalSubmitInteraction) => {

	/* Returns if interaction.channel is null. This should not happen as this is checked in interactionCreate. */
	if (!interaction.channel) { return; }

	/* This gets the messageId of the message that will be edited. */
	const messageId = interaction.customId.split('-')[1];

	/* This is checking if the channel is a thread, if it is, it will get the parent channel. If the
	channel is a DM, it will throw an error. If the channel is a guild channel, it will get the
	webhook. If the webhook doesn't exist, it will create one. */
	const webhookChannel = (interaction.channel.isThread() || false) ? interaction.channel.parent : interaction.channel;
	if (!webhookChannel) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	if (webhookChannel.type === ChannelType.DM) { throw new Error('Webhook can\'t be edited, channel is DMChannel.'); }
	const webhook = (await webhookChannel
		.fetchWebhooks()
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
		.createWebhook({ name: 'PnP Profile Webhook' })
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	/* This is editing the message with the messageId that was passed in the customId. */
	const webhookMessage = await webhook
		.editMessage(messageId, {
			content: interaction.fields.getTextInputValue('edit-textinput'),
			threadId: interaction.channel.isThread() ? interaction.channel.id : undefined,
		})
		.catch((error) => { throw new Error(error); });

	/* This is sending a message to the user that sent the command. */
	await respond(interaction, {
		content: `${webhookMessage instanceof Message ? `[Edited](${webhookMessage.url})` : 'Edited'}! ✅`,
		ephemeral: true,
	}, false)
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};