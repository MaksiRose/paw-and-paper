import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
// import { sendVisitMessage } from '../commands/interaction/requestvisit';
import serverModel from '../models/serverModel';
import { userModel, getUserData } from '../models/userModel';
import { ProxyListType } from '../typings/data/general';
import { ServerSchema } from '../typings/data/server';
import { AutoproxyConfigType, StickymodeConfigType, UserData, UserSchema } from '../typings/data/user';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { userDataServersObject } from '../utils/helperFunctions';
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

		let { replaceMessage, userData } = checkForProxy(message, _userData, serverData);

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
			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully \x1b[31mproxied \x1b[0ma new message in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

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
	_userData: UserSchema,
	serverData: ServerSchema,
): { replaceMessage: boolean, userData: UserData<undefined, ''>; } {

	let replaceMessage = false;
	let quidId = _userData.servers[message.guildId]?.currentQuid ?? null;

	const proxyIsDisabled = (
		serverData.proxySettings.channels.setTo === ProxyListType.Blacklist
		&& serverData.proxySettings.channels.blacklist.includes(message.channelId)
	) || (
		serverData.proxySettings.channels.setTo === ProxyListType.Whitelist
			&& !serverData.proxySettings.channels.whitelist.includes(message.channelId)
	);
	const serverProxySettings = _userData.settings.proxy.servers[message.guildId];

	/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the prefix to the message. */
	const autoproxyIsToggled = (
		serverProxySettings?.autoproxy.setTo === AutoproxyConfigType.Whitelist
		&& serverProxySettings?.autoproxy.channels.whitelist.includes(message.channelId)
	) || (
		serverProxySettings?.autoproxy.setTo === AutoproxyConfigType.Blacklist
			&& !serverProxySettings?.autoproxy.channels.blacklist.includes(message.channelId)
	) || (
		(
			serverProxySettings === undefined
				|| serverProxySettings?.autoproxy.setTo === AutoproxyConfigType.FollowGlobal
		) && _userData.settings.proxy.global.autoproxy === true
	);

	const stickymodeIsToggledLocally = serverProxySettings?.stickymode === StickymodeConfigType.Enabled;
	const stickymodeIsToggledGlobally = (
		serverProxySettings === undefined
		|| serverProxySettings.stickymode === StickymodeConfigType.FollowGlobal
	) && _userData.settings.proxy.global.stickymode === true;

	if (autoproxyIsToggled && !proxyIsDisabled) {

		replaceMessage = true;

		if (stickymodeIsToggledLocally) { quidId = _userData.servers[serverData.serverId]?.lastProxied ?? _userData.servers['DMs']?.lastProxied ?? quidId; }
		if (stickymodeIsToggledGlobally) { quidId = _userData.servers['DMs']?.lastProxied ?? quidId; }
	}

	/* Checking if the message starts with the quid's proxy start and ends with the quid's proxy end. If it does, it will set the current quid to the quid that the message is being sent from. */
	for (const quid of Object.values(_userData.quids)) {

		/* Checking if the message includes the proxy. If it does, it will change the message content to the prefix + 'say ' + the message content without the proxy. */
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


	let isAntiProxied = false;

	const hasAntiProxy = _userData.antiproxy.startsWith !== ''
		|| _userData.antiproxy.endsWith !== '';
	const messageIncludesAntiProxy = message.content.startsWith(_userData.antiproxy.startsWith)
			&& message.content.endsWith(_userData.antiproxy.endsWith);
	if (hasAntiProxy && messageIncludesAntiProxy) {

		quidId = null;
		replaceMessage = false;
		isAntiProxied = true;
	}

	const userData = getUserData(_userData, message.guildId, _userData.quids[quidId ?? '']);

	userData.update(
		(u) => {
			u.userIds[message.author.id] = {
				...(u.userIds[message.author.id] ?? {}),
				[message.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
			};
			if (replaceMessage || isAntiProxied) {
				u.servers[message.guildId] = {
					...userDataServersObject(u, message.guildId),
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

	return { replaceMessage, userData };
}