import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, DiscordEvent } from '../typedef';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { checkForProxy } from './messageCreate';

export const event: DiscordEvent = {
	name: 'messageUpdate',
	once: false,
	async execute(client: CustomClient, oldMessage: Message, newMessage: Message) {

		if (newMessage.author.bot || !newMessage.inGuild()) { return; }

		const userData = await userModel.findOne(u => u.userId.includes(newMessage.author.id)).catch(() => { return null; });
		let quidData = userData?.quids?.[userData?.currentQuid?.[newMessage.guildId || 'DM'] || ''];
		const serverData = await serverModel.findOne(s => s.serverId === newMessage.guildId).catch(() => { return null; });

		if (!userData || !quidData || !serverData) { return; }

		const { replaceMessage, messageContent, quidData: newQuid } = checkForProxy(serverData, newMessage, userData);
		newMessage.content = messageContent;
		if (newQuid !== null) { quidData = newQuid; }

		if (replaceMessage && (newMessage.content.length > 0 || newMessage.attachments.size > 0)) {

			const isSuccessful = await sendMessage(newMessage.channel, newMessage.content, userData, quidData, userData._id, newMessage.author.id, newMessage.attachments.size > 0 ? Array.from(newMessage.attachments.values()) : undefined, newMessage.reference ?? undefined)
				.catch(error => { console.error(error); });
			if (!isSuccessful) { return; }

			if (await hasPermission(newMessage.guild.members.me || newMessage.client.user.id, newMessage.channel, 'ManageMessages')) {

				await newMessage.delete();
			}
			else if (await hasPermission(newMessage.guild.members.me || newMessage.client.user.id, newMessage.channel, newMessage.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await newMessage.reply(getMissingPermissionContent(permissionDisplay.ManageMessages));
			}
		}
	},
};