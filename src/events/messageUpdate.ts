import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import serverModel from '../models/serverModel';
import userModel, { getUserData } from '../models/userModel';
import { DiscordEvent } from '../typings/main';
import { getMapData } from '../utils/helperFunctions';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { checkForProxy } from './messageCreate';

export const event: DiscordEvent = {
	name: 'messageUpdate',
	once: false,
	async execute(oldMessage: Message, newMessage: Message) {

		if (newMessage.author.bot || !newMessage.inGuild()) { return; }

		const _userData = userModel.find(u => u.userId.includes(newMessage.author.id))[0] ?? null;
		const serverData = serverModel.find(s => s.serverId === newMessage.guildId)[0] ?? null;

		if (_userData === null || serverData === null) { return; }

		const { replaceMessage, quidId } = checkForProxy(newMessage, getUserData(_userData, newMessage.guildId, _userData.quids[_userData.currentQuid[newMessage.guildId] ?? '']), serverData);
		const userData = getUserData(_userData, newMessage.guildId, getMapData(_userData.quids, quidId));

		userData
			.update(
				(u) => {
					u.userIds[newMessage.author.id] = {
						...(u.userIds[newMessage.author.id] ?? {}),
						[newMessage.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
					};
				},
			);

		if (userData.quid !== undefined && replaceMessage && (newMessage.content.length > 0 || newMessage.attachments.size > 0)) {

			const isSuccessful = await sendMessage(newMessage.channel, newMessage.content, userData, newMessage.author.id, newMessage.attachments.size > 0 ? Array.from(newMessage.attachments.values()) : undefined, newMessage.reference ?? undefined)
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