import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, DiscordEvent } from '../typedef';
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

			await sendMessage(newMessage.channel, newMessage.content, userData, quidData, userData.uuid, newMessage.author.id, newMessage.attachments.size > 0 ? Array.from(newMessage.attachments.values()) : undefined, newMessage.reference ?? undefined)
				.catch(error => { console.error(error); });

			newMessage
				.delete()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						console.error(error);
					}
				});
		}
	},
};