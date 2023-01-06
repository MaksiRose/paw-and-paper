import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
// import { sendVisitMessage } from '../commands/interaction/requestvisit';
import serverModel from '../models/serverModel';
import { userModel, getUserData } from '../models/userModel';
import { ProxyListType } from '../typings/data/general';
import { ServerSchema } from '../typings/data/server';
import { AutoproxyConfigType, UserData } from '../typings/data/user';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { createGuild } from '../utils/updateGuild';

export const event: DiscordEvent = {
	name: 'messageCreate',
	once: false,
	async execute(message: Message) {

		if (message.author.bot || !message.inGuild()) { return; }

		if (message.content.toLowerCase().startsWith('rp ') && await hasPermission(message.guild.members.me || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

			await message.reply({ content: '**Regular commands were replaced in favour of slash (`/`) commands.**\n\nIf you don\'t know what slash commands are or how to use them, read this article: <https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ>\n\nIf no slash commands for this bot appear, re-invite this bot by clicking on its profile and then on "Add to server".' });
			return;
		}

		const _userData = (() => {
			try { return userModel.findOne(u => Object.keys(u.userIds).includes(message.author.id)); }
			catch { return null; }
		})();
		let serverData = (() => {
			try { return serverModel.findOne(s => s.serverId === message.guildId); }
			catch { return null; }
		})();

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && message.inGuild()) {

			serverData = await createGuild(message.guild)
				.catch(async (error) => {
					console.error(error);
					return null;
				});
		}

		if (_userData === null || serverData === null) { return; }

		let { replaceMessage, quidId } = checkForProxy(message, getUserData(_userData, message.guildId, _userData.quids[_userData.servers[message.guildId]?.currentQuid ?? '']), serverData);
		const userData = getUserData(_userData, message.guildId, _userData.quids[quidId]);

		await userData
			.update(
				(u) => {
					u.userIds[message.author.id] = {
						...(u.userIds[message.author.id] ?? {}),
						[message.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
					};
				},
				{ log: false },
			);

		if (serverData.currentlyVisiting !== null && message.channel.id === serverData.visitChannelId) {

			const otherServerData = await serverModel.findOne(s => s.serverId === serverData?.currentlyVisiting);

			if (otherServerData) {

				// await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (hasName(userData) && replaceMessage && (message.content.length > 0 || message.attachments.size > 0)) {

			const isSuccessful = await sendMessage(message.channel, message.content, userData, message.author.id, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined)
				.catch(error => { console.error(error); });
			if (!isSuccessful) { return; }

			if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, 'ManageMessages')) {

				await message.delete();
			}
			else if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await message.reply(getMissingPermissionContent(permissionDisplay.ManageMessages));
			}
		}
	},
};

export function checkForProxy(
	message: Message<true> & Message<boolean>,
	userData: UserData<undefined, ''>,
	serverData: ServerSchema,
): { replaceMessage: boolean, quidId: string; } {

	let replaceMessage = false;
	let quidId = userData.quid?._id || '';

	const proxyIsDisabled = (
		serverData.proxySettings.channels.setTo === ProxyListType.Blacklist
		&& serverData.proxySettings.channels.blacklist.includes(message.channelId)
	) || (
		serverData.proxySettings.channels.setTo === ProxyListType.Whitelist
		&& !serverData.proxySettings.channels.whitelist.includes(message.channelId)
	);

	/* Checking if the message starts with the quid's proxy start and ends with the quid's
	proxy end. If it does, it will set the current quid to the quid that the message is
	being sent from. */
	for (const quid of userData.quids.values()) {

		/* Checking if the message includes the proxy. If it does, it will change the message content
		to the prefix + 'say ' + the message content without the proxy. */
		const hasProxy = quid.proxy.startsWith !== ''
			|| quid.proxy.endsWith !== '';

		const messageIncludesProxy = message.content.startsWith(quid.proxy.startsWith)
			&& message.content.endsWith(quid.proxy.endsWith);

		if (hasProxy && messageIncludesProxy && !proxyIsDisabled) {

			quidId = quid._id;

			message.content = message.content.substring(quid.proxy.startsWith.length, message.content.length - quid.proxy.endsWith.length);

			replaceMessage = true;
		}
	}

	/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the
	prefix to the message. */
	const autoproxyIsToggled = (
		userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.Whitelist
		&& userData.settings.proxy.server?.autoproxy.channels.whitelist.includes(message.channelId)
	) || (
		userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.Blacklist
		&& !userData.settings.proxy.server?.autoproxy.channels.blacklist.includes(message.channelId)
	) || (
		userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.FollowGlobal
		&& userData.settings.proxy.global.autoproxy === true
	);

	if (autoproxyIsToggled && !proxyIsDisabled) {

		replaceMessage = true;
	}

	return { replaceMessage, quidId };
}