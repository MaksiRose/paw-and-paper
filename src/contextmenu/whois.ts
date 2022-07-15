import { MessageContextMenuInteraction, MessageEmbed } from 'discord.js';
import { readFileSync } from 'fs';
import { sendProfile } from '../commands/profile/profile';
import userModel from '../models/userModel';
import { ContextMenuCommand, CustomClient, WebhookMessages } from '../typedef';

const name: ContextMenuCommand['name'] = 'Who is ❓';
export const command: ContextMenuCommand = {
	name: name,
	data: {
		name: name,
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client: CustomClient, interaction: MessageContextMenuInteraction) => {

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
		let userData = await userModel.findOne({ userId: userId }).catch(() => { return null; });
		let characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId || 'DM']];

		/* This checks whether there is an entry for this message in webhookCache, and sets the userId, userData and characterData to the entry data if it exist. */
		const webhookCacheEntry: Array<string> | undefined = webhookCache[interaction.targetId]?.split('_');
		if (webhookCacheEntry !== undefined) {

			userId = webhookCacheEntry[0];
			userData = await userModel.findOne({ userId: userId }).catch(() => { return null; });
			characterData = userData?.characters?.[webhookCacheEntry[1]];
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

		const embedArray = [new MessageEmbed({
			color: member?.displayColor || interaction.targetMessage.author.accentColor || '#ffffff',
			author: {
				name: member?.displayName || interaction.targetMessage.author?.tag,
				icon_url: member?.displayAvatarURL() || interaction.targetMessage.author?.avatarURL() || undefined,
			},
			description: `${interaction.targetMessage.content}\n[jump](${interaction.targetMessage.url})`,
			fields: [
				{
					name: 'Sent by:',
					value: `${interaction.targetMessage.author.toString()} ${member?.nickname ? `/ ${member?.nickname}` : ''}`,
				},
			],
			timestamp: new Date(),
		})];

		// Instead of calling the sendProfile function from the profile command, getMessageContent should be exported, so that it all can be done in here. The button would then include the uuid and characterId, so that the userData and characterData can be gotten for the profile interactionCollector.
		await sendProfile(client, interaction.targetMessage, embedArray, userData, characterData, false, interaction);
	},
};