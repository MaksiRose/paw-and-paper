import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import serverModel from '../models/serverModel';
import { userModel, getUserData } from '../models/userModel';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { userDataServersObject } from '../utils/helperFunctions';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { checkForProxy } from './messageCreate';

export const event: DiscordEvent = {
	name: 'messageUpdate',
	once: false,
	async execute(oldMessage: Message, newMessage: Message) {

		if (newMessage.author.bot || !newMessage.inGuild()) { return; }

		const _userData = (() => {
			try { return userModel.findOne(u => Object.keys(u.userIds).includes(newMessage.author.id)); }
			catch { return null; }
		})();
		const serverData = (() => {
			try { return serverModel.findOne(s => s.serverId === newMessage.guildId); }
			catch { return null; }
		})();

		if (_userData === null || serverData === null) { return; }

		const { replaceMessage, quidId } = checkForProxy(newMessage, getUserData(_userData, newMessage.guildId, _userData.quids[_userData.servers[newMessage.guildId]?.currentQuid ?? '']), serverData);
		const userData = getUserData(_userData, newMessage.guildId, _userData.quids[quidId]);

		userData
			.update(
				(u) => {
					u.userIds[newMessage.author.id] = {
						...(u.userIds[newMessage.author.id] ?? {}),
						[newMessage.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
					};
					if (replaceMessage) {
						u.servers[newMessage.guildId ?? 'DMs'] = {
							...userDataServersObject(u, newMessage.guildId ?? 'DMs'),
							lastProxied: quidId,
						};
						u.servers['DMs'] = {
							...userDataServersObject(u, 'DMs'),
							lastProxied: quidId,
						};
					}
				},
				{ log: false },
			);

		if (hasName(userData) && replaceMessage && (newMessage.content.length > 0 || newMessage.attachments.size > 0)) {

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