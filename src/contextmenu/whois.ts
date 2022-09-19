import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { getMessageContent } from '../commands/quid_customization/profile';
import { respond } from '../utils/helperFunctions';
import userModel from '../models/userModel';
import { ContextMenuCommand, WebhookMessages } from '../typedef';

const name: ContextMenuCommand['name'] = 'Who is ❓';
export const command: ContextMenuCommand = {
	name: name,
	data: {
		name: name,
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client, interaction) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!interaction.inCachedGuild()) {

			await interaction
				.reply({
					content: 'This interaction is guild-only!',
					ephemeral: true,
				});
			return;
		}

		/* This gets the webhookCache */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;

		/* This sets the userId, userData and quidData to the default for the author of the selected message.
		userId is its own variable here to ensure maintainability for when one account could be associated with several userIds. */
		let userId = interaction.targetMessage.author.id;
		let userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
		let quidData = userData?.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''];

		/* This checks whether there is an entry for this message in webhookCache, and sets the userId, userData and quidData to the entry data if it exist. */
		const webhookCacheEntry = webhookCache[interaction.targetId]?.split('_') || [];
		const uid = webhookCacheEntry[0];
		const charid = webhookCacheEntry[1];
		if (uid && charid) {

			userId = uid;
			userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
			quidData = userData?.quids[charid];
		}

		/* This is checking whether the userData is null, and if it is, it will send a message to the user who clicked on the context menu. */
		if (userData === null) {

			await interaction
				.reply({
					content: 'The user of the message that you clicked on has no account!',
					ephemeral: true,
				});
			return;
		}

		const member = await interaction.guild.members.fetch(userId).catch(() => { return undefined; });

		const embedArray = [new EmbedBuilder()
			.setColor(member?.displayColor || interaction.targetMessage.author.accentColor || '#ffffff')
			.setAuthor({
				name: member?.displayName || interaction.targetMessage.author?.tag,
				iconURL: member?.displayAvatarURL() || interaction.targetMessage.author?.avatarURL() || undefined,
			})
			.setDescription(`${interaction.targetMessage.content}\n[jump](${interaction.targetMessage.url})`)
			.setFields([{
				name: 'Sent by:',
				value: `${interaction.targetMessage.author.toString()} ${member?.nickname ? `/ ${member?.nickname}` : ''}`,
			}])
			.setTimestamp(new Date())];

		const response = await getMessageContent(client, userId, userData, quidData, userData.userId.includes(interaction.user.id), embedArray, interaction.guildId);

		await respond(interaction, {
			...response,
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(`profile_learnabout_${interaction.user.id}`)
					.setLabel('Learn more (sends a DM)')
					.setStyle(ButtonStyle.Success)])],
			ephemeral: true,
			fetchReply: true,
		}, false);
	},
};