import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { getMessageContent } from '../commands/character_customization/profile';
import { respond } from '../events/interactionCreate';
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
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* This gets the webhookCache */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;

		/* This sets the userId, userData and characterData to the default for the author of the selected message.
		userId is its own variable here to ensure maintainability for when one account could be associated with several userIds. */
		let userId = interaction.targetMessage.author.id;
		let userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
		let characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']] || null;

		/* This checks whether there is an entry for this message in webhookCache, and sets the userId, userData and characterData to the entry data if it exist. */
		const webhookCacheEntry: Array<string> | undefined = webhookCache[interaction.targetId]?.split('_');
		if (webhookCacheEntry !== undefined) {

			userId = webhookCacheEntry[0];
			userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
			characterData = userData?.characters?.[webhookCacheEntry[1]] || null;
		}

		/* This is checking whether the userData is null, and if it is, it will send a message to the user who clicked on the context menu. */
		if (userData === null) {

			await interaction
				.reply({
					content: 'The user of the message that you clicked on has no account!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const member = await interaction.guild.members.fetch(userId);

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

		const response = await getMessageContent(client, userData.userId[0], characterData, userData.userId.includes(interaction.user.id), embedArray);

		await respond(interaction, {
			...response,
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(`profile-learnabout-${userData.userId}`)
					.setLabel('Learn more (sends a DM)')
					.setStyle(ButtonStyle.Success)])],
			ephemeral: true,
			fetchReply: true,
		}, true)
			.catch((error) => { throw new Error(error); });
	},
};