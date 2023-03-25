import { APIMessage, Attachment, EmbedBuilder, GuildTextBasedChannel, Message, MessageReference, SlashCommandBuilder, WebhookClient, Webhook as DiscordWebhook } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { canManageWebhooks, getMissingPermissionContent, hasPermission, missingPermissions, permissionDisplay } from '../../utils/permissionHandler';
import { CurrentRegionType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import QuidToServer from '../../models/quidToServer';
import Quid from '../../models/quid';
import { getDisplayname } from '../../utils/getQuidInfo';
import Webhook from '../../models/webhook';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import Channel from '../../models/channel';
const { error_color } = require('../../../config.json');

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!user) { throw new TypeError('user is undefined'); }
		if (!isInGuild(interaction) || !hasName(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; }

		const text = interaction.options.getString('text') || '';
		const attachment = interaction.options.getAttachment('attachment');

		if (!text && !attachment) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('I cannot send an empty message!')],
				ephemeral: true,
			});
			return;
		}

		if (interaction.channel === null) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('The channel that this interaction came from couldn\'t be found :(')],
				ephemeral: true,
			});
			return;
		}

		const botMessage = await sendMessage(interaction.channel, text, quid, interaction.user.id, attachment ? [attachment] : undefined, undefined, user, userToServer, quidToServer);

		await interaction.deferReply({ ephemeral: true });
		if (!botMessage) { return; }
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
	quid: Quid<true> | Quid<false>,
	discordUserId: string,
	attachments?: Array<Attachment>,
	reference?: MessageReference,
	user?: User | undefined,
	userToServer?: UserToServer | undefined,
	quidToServer?: QuidToServer | undefined,
): Promise<Message | APIMessage | null> {

	console.time(quid.id);
	if (await canManageWebhooks(channel) === false) { return null; }

	const webhookChannel = channel.isThread() ? channel.parent : channel;
	if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }

	const channelData = await Channel.findByPk(webhookChannel.id);
	const webhook = channelData
		? new WebhookClient({ url: channelData.webhookUrl })
		: (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	if (webhook instanceof DiscordWebhook) { Channel.create({ id: webhookChannel.id, serverId: webhookChannel.guildId, webhookUrl: webhook.url }); }
	console.timeLog(quid.id);

	QuidToServer.update({ currentRegion: CurrentRegionType.Ruins }, { where: { quidId: quid.id, serverId: webhookChannel.guildId } });

	const embeds: Array<EmbedBuilder> = [];

	if (reference && reference.messageId) {

		const botMember = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

		if (await hasPermission(botMember || channel.client.user.id, channel.id, 'ReadMessageHistory') === false) {

			if (await hasPermission(channel.guild.members.me || channel.client.user.id, channel, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await channel.send(getMissingPermissionContent(permissionDisplay.ReadMessageHistory));
			}
			return null;
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
	console.timeLog(quid.id);

	const botMessage = await webhook
		.send({
			username: await getDisplayname(quid, { serverId: webhookChannel.guildId, user, userToServer, quidToServer }),
			avatarURL: quid.avatarURL,
			content: text || undefined,
			files: attachments,
			embeds: embeds,
			threadId: channel.isThread() ? channel.id : undefined,
		})
		.catch(async err => {
			if (err.message && err.message.includes('Unknown Webhook') && channelData) {

				await channelData.destroy();
				return await sendMessage(channel, text, quid, discordUserId, attachments, reference, user, userToServer, quidToServer);
			}
			throw err;
		});

	if (botMessage) { Webhook.create({ discordUserId: discordUserId, id: botMessage.id, quidId: quid.id }); }
	console.timeEnd(quid.id);
	return botMessage;
}