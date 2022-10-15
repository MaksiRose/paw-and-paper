import { Attachment, EmbedBuilder, GuildTextBasedChannel, MessageReference, SlashCommandBuilder } from 'discord.js';
import { getQuidDisplayname, respond } from '../../utils/helperFunctions';
import { Quid, CurrentRegionType, SlashCommand, WebhookMessages, UserSchema } from '../../typedef';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
const { error_color } = require('../../../config.json');
import userModel from '../../models/userModel';
import { readFileSync, writeFileSync } from 'fs';
import { canManageWebhooks, getMissingPermissionContent, hasPermission, missingPermissions, permissionDisplay } from '../../utils/permissionHandler';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('say')
		.setDescription('Sends a message as if your quid was saying it.')
		.addStringOption(option =>
			option.setName('text')
				.setDescription('The text that you want your quid to say.'))
		.addAttachmentOption(option =>
			option.setName('attachment')
				.setDescription('An attachment that you want to attach to the message'))
		.setDMPermission(false)
		.toJSON(),
	category: 'page4',
	position: 3,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		if (!isInGuild(interaction)) { return; }
		if (!hasName(interaction, userData)) { return; }

		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const text = interaction.options.getString('text') || '';
		const attachment = interaction.options.getAttachment('attachment');

		if (!text && !attachment) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('I cannot send an empty message!')],
				ephemeral: true,
			}, false);
			return;
		}

		if (interaction.channel === null) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('The channel that this interaction came from couldn\'t be found :(')],
				ephemeral: true,
			}, false);
			return;
		}

		const isSuccessful = await sendMessage(interaction.channel, text, userData, quidData, userData._id, interaction.user.id, attachment ? [attachment] : undefined);

		await interaction.deferReply();
		if (!isSuccessful) { return; }
		await interaction.deleteReply();
	},
};

/**
 * It sends a message to a channel using a webhook
 * @param channel - The channel to send the message to.
 * @param text - The text to send.
 * @param quidData - The quid data of the quid that is sending the message.
 * @param _id - The user's _id
 * @param authorId - The ID of the user who sent the message.
 * @param [attachments] - An array of attachments to send with the message.
 * @param [reference] - MessageReference
 * @returns Nothing
 */
export async function sendMessage(
	channel: GuildTextBasedChannel,
	text: string,
	userData: UserSchema,
	quidData: Quid,
	_id: string,
	authorId: string,
	attachments?: Array<Attachment>,
	reference?: MessageReference,
): Promise<boolean> {

	if (await canManageWebhooks(channel) === false) { return false; }

	const webhookChannel = channel.isThread() ? channel.parent : channel;
	if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	if (quidData.profiles[webhookChannel.guildId] !== undefined) {

		userData = await userModel.findOneAndUpdate(
			(u => u._id === _id),
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, webhookChannel.guildId)).profiles, webhookChannel.guildId);
				p.experience += 1;
				p.currentRegion = CurrentRegionType.Ruins;
			},
		);
		quidData = getMapData(userData.quids, quidData._id);
	}

	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	const embeds: Array<EmbedBuilder> = [];

	if (reference && reference.messageId) {

		const botMember = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

		if (await hasPermission(botMember || channel.client.user.id, channel.id, 'ReadMessageHistory') === false) {

			if (await hasPermission(channel.guild.members.me || channel.client.user.id, channel, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await channel.send(getMissingPermissionContent(permissionDisplay.ReadMessageHistory));
			}
			return false;
		}

		const referencedMessage = await channel?.messages.fetch(reference.messageId);
		const member = referencedMessage.member;
		const user = referencedMessage.author;
		let referencedMessageContent = referencedMessage.content;
		const hasAttachment = referencedMessage.attachments.size > 0 || referencedMessage.embeds.length > 0;
		if (referencedMessageContent.length === 0 && hasAttachment) { referencedMessageContent = '*Click to see attachment*'; }
		if (referencedMessageContent.length > 28 && hasAttachment) { referencedMessageContent = referencedMessage.content.substring(0, 27) + '…'; }
		if (referencedMessageContent.length > 30) { referencedMessageContent = referencedMessage.content.substring(0, 29) + '…'; }
		if (hasAttachment) { referencedMessageContent += ' 🌄'; }
		embeds.push(new EmbedBuilder()
			.setColor(member?.displayColor || user.accentColor || '#ffffff')
			.setAuthor({ name: member?.displayName || user.username, iconURL: member?.displayAvatarURL() || user.avatarURL() || undefined })
			.setDescription(`[Reply to:](${referencedMessage.url}) ${referencedMessageContent}`));
	}

	const botMessage = await webhook
		.send({
			username: getQuidDisplayname(userData, quidData, channel.guildId),
			avatarURL: quidData.avatarURL,
			content: text || undefined,
			files: attachments,
			embeds: embeds,
			threadId: channel.isThread() ? channel.id : undefined,
		});

	webhookCache[botMessage.id] = authorId + (quidData?._id !== undefined ? `_${quidData?._id}` : '');
	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

	return true;
}