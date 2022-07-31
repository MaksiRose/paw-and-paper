import { Attachment, EmbedBuilder, MessageReference, NewsChannel, PrivateThreadChannel, PublicThreadChannel, SlashCommandBuilder, TextChannel, VoiceChannel } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import { Character, CurrentRegionType, SlashCommand, WebhookMessages } from '../../typedef';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/getInfo';
const { error_color } = require('../../../config.json');
import userModel from '../../models/userModel';
import { readFileSync, writeFileSync } from 'fs';

const name: SlashCommand['name'] = 'say';
const description: SlashCommand['description'] = 'Sends a message as if your character was saying it.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('text')
				.setDescription('The text that you want your character to say.'))
		.addAttachmentOption(option =>
			option.setName('attachment')
				.setDescription('An attachment that you want to attach to the message'))
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData) => {

		if (!isInGuild(interaction)) { return; }
		if (!hasName(interaction, userData)) { return; }

		const characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId));
		const text = interaction.options.getString('text') || '';
		const attachment = interaction.options.getAttachment('attachment');

		if (!text && !attachment) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('I cannot send an empty message!')],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		await sendMessage(interaction.channel, text, characterData, userData.uuid, interaction.user.id, attachment ? [attachment] : undefined);

		await interaction.deferReply();
		await interaction.deleteReply();
	},
};

/**
 * It sends a message to a channel using a webhook
 * @param channel - The channel to send the message to.
 * @param text - The text to send.
 * @param characterData - The character data of the character that is sending the message.
 * @param uuid - The user's UUID
 * @param authorId - The ID of the user who sent the message.
 * @param [attachments] - An array of attachments to send with the message.
 * @param [reference] - MessageReference
 * @returns Nothing
 */
export const sendMessage = async (
	channel: NewsChannel | TextChannel | PublicThreadChannel | PrivateThreadChannel | VoiceChannel | null,
	text: string,
	characterData: Character,
	uuid: string,
	authorId: string,
	attachments?: Array<Attachment>,
	reference?: MessageReference,
): Promise<void> => {

	const webhookChannel = (channel && channel.isThread()) ? channel.parent : channel;
	if (!webhookChannel || !channel) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	const webhook = (await webhookChannel
		.fetchWebhooks()
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
		.createWebhook({ name: 'PnP Profile Webhook' })
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	if (characterData.profiles[webhookChannel.guildId] !== undefined) {

		await userModel.findOneAndUpdate(
			(u => u.uuid === uuid),
			(u) => {
				const p = getMapData(getMapData(u.characters, getMapData(u.currentCharacter, webhookChannel.guildId)).profiles, webhookChannel.guildId);
				p.experience += 1;
				p.currentRegion = CurrentRegionType.Ruins;
			},
		);
	}

	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	const embeds: Array<EmbedBuilder> = [];

	if (reference && reference.messageId) {

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
			username: characterData.name,
			avatarURL: characterData.avatarURL,
			content: text || null,
			files: attachments,
			embeds: embeds,
			threadId: channel.isThread() ? channel.id : undefined,
		})
		.catch((error) => { throw new Error(error); });

	webhookCache[botMessage.id] = authorId + (characterData?._id !== undefined ? `_${characterData?._id}` : '');
	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

	return;
};