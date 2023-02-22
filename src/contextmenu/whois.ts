import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { CustomIdArgs, getProfileMessageOptions } from '../commands/quid_customization/profile';
import { respond } from '../utils/helperFunctions';
import { userModel, getUserData } from '../oldModels/userModel';
import { WebhookMessages } from '../typings/data/general';
import { ContextMenuCommand } from '../typings/handle';
import { isInGuild } from '../utils/checkUserState';
import { constructCustomId } from '../utils/customId';

export const command: ContextMenuCommand = {
	data: {
		name: 'Who is ❓',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }

		/* This gets the webhookCache */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;

		/* This sets the userId, userData and quidData to the default for the author of the selected message.
		userId is its own variable here to ensure maintainability for when one account could be associated with several userIds. */
		let userId = interaction.targetMessage.author.id;
		let quidId = '';

		/* This checks whether there is an entry for this message in webhookCache, and sets the userId, userData and quidData to the entry data if it exist. */
		const webhookCacheEntry = webhookCache[interaction.targetId]?.split('_') || [];
		const uid = webhookCacheEntry[0];
		const charid = webhookCacheEntry[1];
		if (uid && charid) {

			userId = uid;
			quidId = charid;
		}

		const _userData = (() => {
			try { return userModel.findOne(u => Object.keys(u.userIds).includes(userId)); }
			catch { return null; }
		})();
		/* This is checking whether the userData is null, and if it is, it will send a message to the user who clicked on the context menu. */
		if (_userData === null) {

			await interaction
				.reply({
					content: 'The user of the message that you clicked on has no account!',
					ephemeral: true,
				});
			return;
		}
		const userData = getUserData(_userData, interaction.guildId || 'DMs', _userData.quids[quidId || _userData.servers[interaction.guildId || 'DMs']?.currentQuid || '']);

		const member = await interaction.guild.members.fetch(userId).catch(() => { return undefined; });
		const user = member ? member.user : await interaction.client.users.fetch(userId).catch(() => { return undefined; });

		const embedArray = [new EmbedBuilder()
			.setColor(member?.displayColor || user?.accentColor || '#ffffff')
			.setAuthor({
				name: member?.displayName || user?.username || userId,
				iconURL: member?.displayAvatarURL() || user?.avatarURL() || undefined,
			})
			.setDescription(`${interaction.targetMessage.content}\n[jump](${interaction.targetMessage.url})`)
			.setFields([{
				name: 'Sent by:',
				value: `<@${userId}> ${user?.tag ? `/ ${user.tag}` : ''}`,
			}])
			.setTimestamp(new Date())];

		const response = await getProfileMessageOptions(userId, userData, Object.keys(userData.userIds).includes(interaction.user.id), embedArray);

		// This is always a reply
		await respond(interaction, {
			...response,
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>('profile', interaction.user.id, ['learnabout', userId]))
					.setLabel('Learn more (sends a DM)')
					.setStyle(ButtonStyle.Success)])],
			ephemeral: true,
		});
	},
};