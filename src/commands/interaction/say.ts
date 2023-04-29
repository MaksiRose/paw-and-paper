import { APIMessage, Attachment, EmbedBuilder, GuildTextBasedChannel, Message, MessageReference, SlashCommandBuilder, WebhookClient, Webhook as DiscordWebhook, User as DiscordUser, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { canManageWebhooks, getMissingPermissionContent, hasPermission, missingPermissions, permissionDisplay } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import QuidToServer from '../../models/quidToServer';
import Quid from '../../models/quid';
import { getDisplayname } from '../../utils/getQuidInfo';
import Webhook from '../../models/webhook';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import Channel from '../../models/channel';
import Server from '../../models/server';
import ProxyLimits from '../../models/proxyLimits';
import { explainRuleset, ruleIsBroken } from '../../utils/nameRules';
import { generateId } from 'crystalid';
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
	category: 'page2',
	position: 3,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!server) { throw new TypeError('server is undefined'); }

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

		const botMessage = await sendMessage(interaction.channel, text, quid, user, server, interaction.user, attachment ? [attachment] : undefined, undefined, userToServer, quidToServer);

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
	quid: Quid,
	user: User,
	server: Server,
	discordUser: DiscordUser,
	attachments?: Array<Attachment>,
	reference?: MessageReference,
	userToServer?: UserToServer | undefined,
	quidToServer?: QuidToServer | undefined,
): Promise<Message | APIMessage | null> {

	if (await canManageWebhooks(channel) === false) { return null; }

	let channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
	if (!channelLimits) {
		channelLimits = await ProxyLimits.create({ id: generateId() });
		server.update({ proxy_channelLimitsId: channelLimits.id });
	}

	if (channelLimits.setToWhitelist ? !channelLimits.whitelist.includes(channel.id) : channelLimits.blacklist.includes(channel.id)) { return null; }

	let roleLimits = await ProxyLimits.findByPk(server.proxy_roleLimitsId);
	if (!roleLimits) {
		roleLimits = await ProxyLimits.create({ id: generateId() });
		server.update({ proxy_roleLimitsId: roleLimits.id });
	}

	const guildMember = await channel.guild.members.fetch(discordUser.id);
	if (guildMember.roles.cache.some(r => roleLimits![roleLimits!.setToWhitelist ? 'whitelist' : 'blacklist'].includes(r.id)) === (roleLimits.setToWhitelist ? false : true)) { return null; }

	const quidName = await getDisplayname(quid, { serverId: channel.guildId, user, userToServer, quidToServer });

	if (server.nameRuleSets.length > 0 && await ruleIsBroken(channel, discordUser, server, quidName)) {

		await channel.send({
			content: `${discordUser}, your message can't be proxied because your quid's displayname must contain:\n\n${server.nameRuleSets.map(nameRuleSet => `• ${explainRuleset(nameRuleSet)}`).join('\n')}`,
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`dismiss_@${discordUser.id}`)
						.setLabel('Dismiss')
						.setStyle(ButtonStyle.Secondary),
				])],
			allowedMentions: { parse: [] },
		});
		return null;
	}

	const webhookChannel = channel.isThread() ? channel.parent : channel;
	if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }

	const channelData = await Channel.findByPk(webhookChannel.id);
	const webhook = channelData
		? new WebhookClient({ url: channelData.webhookUrl })
		: (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	if (webhook instanceof DiscordWebhook) { Channel.create({ id: webhookChannel.id, serverId: webhookChannel.guildId, webhookUrl: webhook.url }); }

	const embeds: Array<EmbedBuilder> = [];

	if (reference && reference.messageId) {

		const botMember = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

		if (await hasPermission(botMember || channel.client.user.id, channel.id, 'ReadMessageHistory', channel.client) === false) {

			if (await hasPermission(channel.guild.members.me || channel.client.user.id, channel, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages', channel.client)) {

				await channel.send(getMissingPermissionContent(permissionDisplay.ReadMessageHistory));
			}
			return null;
		}

		const referencedMessage = await channel?.messages.fetch(reference.messageId);
		const referencedMember = referencedMessage.member;
		const referencedUser = referencedMessage.author;
		let referencedMessageContent = referencedMessage.content;
		const hasAttachment = referencedMessage.attachments.size > 0 || referencedMessage.embeds.length > 0;
		if (referencedMessageContent.length === 0 && hasAttachment) { referencedMessageContent = '*Click to see attachment*'; }
		if (referencedMessageContent.length > 28 && hasAttachment) { referencedMessageContent = referencedMessage.content.substring(0, 27) + '…'; }
		if (referencedMessageContent.length > 30) { referencedMessageContent = referencedMessage.content.substring(0, 29) + '…'; }
		if (hasAttachment) { referencedMessageContent += ' 🌄'; }
		embeds.push(new EmbedBuilder()
			.setColor(referencedMember?.displayColor || referencedUser.accentColor || '#ffffff')
			.setAuthor({ name: referencedMember?.displayName || referencedUser.username, iconURL: referencedMember?.displayAvatarURL() || referencedUser.avatarURL() || undefined })
			.setDescription(`[Reply to:](${referencedMessage.url}) ${referencedMessageContent}`));
	}

	const botMessage = await webhook
		.send({
			username: quidName,
			avatarURL: quid.avatarURL,
			content: text || undefined,
			files: attachments,
			embeds: embeds,
			threadId: channel.isThread() ? channel.id : undefined,
		})
		.catch(async err => {
			if (err.message && err.message.includes('Unknown Webhook') && channelData) {

				await channelData.destroy();
				return await sendMessage(channel, text, quid, user, server, discordUser, attachments, reference, userToServer, quidToServer);
			}
			throw err;
		});

	if (botMessage) {

		Webhook.create({ discordUserId: discordUser.id, id: botMessage.id, quidId: quid.id });

		(async function() {
			if (server.logChannelId !== null) {

				const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
				if (logLimits
					&& (
						(logLimits.setToWhitelist === true && !logLimits.whitelist.includes(channel.id) && !logLimits.whitelist.includes(webhookChannel.id))
					|| (logLimits.setToWhitelist === false && (logLimits.blacklist.includes(channel.id) || logLimits.blacklist.includes(webhookChannel.id)))
					)) { return; }

				const logChannel = await channel.guild.channels.fetch(server.logChannelId);
				if (!logChannel || !logChannel.isTextBased()) { return; }

				logChannel.send({
					content: `Message Link: https://discord.com/channels/${channel.guildId}/${channel.id}/${botMessage.id}\nSent by: <@${discordUser.id}> ${discordUser.tag}\nQuid ID: ${quid.id}`,
					embeds: [new EmbedBuilder()
						.setAuthor({
							name: await getDisplayname(quid, { serverId: webhookChannel.guildId, user, userToServer, quidToServer }),
							iconURL: quid.avatarURL,
						})
						.setColor(quid.color)
						.setDescription((text || '') + '\n\n' + (botMessage.attachments instanceof Collection ? botMessage.attachments.map(a => a.url).join('\n') : botMessage.attachments.map(a => a.url).join('\n')))],
					allowedMentions: { parse: [] },
				});
			}
		})();
	}
	return botMessage;
}