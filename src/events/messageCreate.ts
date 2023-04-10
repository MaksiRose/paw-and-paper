import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import DiscordUser from '../models/discordUser';
import ProxyLimits from '../models/proxyLimits';
import Quid from '../models/quid';
import Server from '../models/server';
import DiscordUserToServer from '../models/discordUserToServer';
import User, { ProxySetTo } from '../models/user';
import UserToServer, { AutoproxySetTo } from '../models/userToServer';
// import { sendVisitMessage } from '../commands/interaction/requestvisit';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { createGuild } from '../utils/updateGuild';
import { isObject, now } from '../utils/helperFunctions';
import { generateId } from 'crystalid';

export const event: DiscordEvent = {
	name: 'messageCreate',
	once: false,
	async execute(message: Message) {

		if (message.author.bot || !message.inGuild()) { return; }

		if (message.content.toLowerCase().startsWith('rp ') && await hasPermission(message.guild.members.me || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

			await message.reply({ content: '**Regular commands were replaced in favour of slash (`/`) commands.**\n\nIf you don\'t know what slash commands are or how to use them, read this article: <https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ>\n\nIf no slash commands for this bot appear, re-invite this bot by clicking on its profile and then on "Add to server".' });
			return;
		}

		const discordUser = await DiscordUser.findByPk(message.author.id, {
			include: [{ model: User, as: 'user' }],
		});
		const user = discordUser?.user;

		const server = (await Server.findByPk(message.guildId)) ?? await createGuild(message.guild);

		if (user === undefined || server === null) { return; }

		let { replaceMessage, quid, userToServer } = await checkForProxy(message, user, server);

		if (server.currentlyVisitingChannelId !== null && message.channel.id === server.visitChannelId) {

			const otherServerData = await Server.findOne({ where: { id: server.currentlyVisitingChannelId } });

			if (otherServerData) {

				// await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (replaceMessage && hasName(quid) && (message.content.length > 0 || message.attachments.size > 0)) {

			const botMessage = await sendMessage(message.channel, message.content, quid, message.author.id, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined, user, userToServer ?? undefined)
				.catch(error => {
					console.error(error);
					return null;
				});

			if (!botMessage) { return; }
			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully \x1b[31mproxied \x1b[0ma new message in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, 'ManageMessages')) {

				await message
					.delete()
					.catch(async e => { if (isObject(e) && e.code === 10008) { await message.channel.messages.delete(botMessage.id); } }); // If the message is unknown, its webhooked message is probbaly not supposed to exist too, so we delete it
			}
			else if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await message.reply(getMissingPermissionContent(permissionDisplay.ManageMessages));
			}
		}
	},
};

export async function checkForProxy(
	message: Message<true> & Message<boolean>,
	user: User,
	server: Server,
): Promise<{ replaceMessage: boolean, quid: Quid | null, userToServer: UserToServer | null; }> {

	let replaceMessage = true;

	DiscordUserToServer
		.update({ isMember: true, lastUpdatedTimestamp: now() }, { where: { discordUserId: message.author.id, serverId: message.guildId } })
		.then(([r]) => {
			if (r === 0) { DiscordUserToServer.create({ id: generateId(), discordUserId: message.author.id, serverId: message.guildId, isMember: true, lastUpdatedTimestamp: now() }); }
		});

	let channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
	if (!channelLimits) {
		channelLimits = await ProxyLimits.create();
		server.update({ proxy_channelLimitsId: channelLimits.id });
	}


	const proxyIsDisabled = channelLimits.setToWhitelist ? !channelLimits.whitelist.includes(message.channelId) : channelLimits.blacklist.includes(message.channelId);
	if (proxyIsDisabled) { replaceMessage = false; }

	const userToServer = await UserToServer.findOne({
		where: { serverId: message.guildId, userId: user.id },
	});


	const hasAntiProxy = user.antiproxy_startsWith !== ''
		|| user.antiproxy_endsWith !== '';
	const messageIncludesAntiProxy = message.content.startsWith(user.antiproxy_startsWith)
		&& message.content.endsWith(user.antiproxy_endsWith);


	const followsGlobalSettings = userToServer === null || userToServer.autoproxy_setTo === AutoproxySetTo.followGlobal;

	if (followsGlobalSettings) {

		if (user.proxy_setTo === ProxySetTo.off) { replaceMessage = false; }
		if (hasAntiProxy && messageIncludesAntiProxy) {

			if (replaceMessage) {

				userToServer?.update({ lastProxiedQuidId: null });
				user.update({ proxy_lastGlobalProxiedQuidId: null });
			}
			replaceMessage = false;
		}


		const finalQuidId = user.proxy_setTo === ProxySetTo.onWithSelectMode ? user.lastGlobalActiveQuidId : user.proxy_lastGlobalProxiedQuidId;
		let finalQuid: Quid | null = null;

		for (const quid of (await Quid.findAll({ where: { userId: user.id }, attributes: ['id', 'proxy_startsWith', 'proxy_endsWith'] }))) {

			const hasProxy = quid.proxy_startsWith !== ''
				|| quid.proxy_endsWith !== '';

			const messageIncludesProxy = message.content.startsWith(quid.proxy_startsWith)
				&& message.content.endsWith(quid.proxy_endsWith);

			if (hasProxy && messageIncludesProxy) {

				finalQuid = quid;
				message.content = message.content.substring(quid.proxy_startsWith.length, message.content.length - quid.proxy_endsWith.length);
			}
		}

		if (replaceMessage) {

			userToServer?.update({ lastProxiedQuidId: finalQuid?.id });
			user.update({ proxy_lastGlobalProxiedQuidId: finalQuid?.id });
		}

		return { replaceMessage, quid: await Quid.findByPk(finalQuid?.id ?? finalQuidId ?? ''), userToServer };
	}
	else {

		if (userToServer.autoproxy_setTo === AutoproxySetTo.off) { replaceMessage = false; }
		if (hasAntiProxy && messageIncludesAntiProxy) {

			if (replaceMessage) { userToServer.update({ lastProxiedQuidId: null }); }
			replaceMessage = false;
		}
		if (userToServer.autoproxy_setToWhitelist === true
			? !userToServer.autoproxy_whitelist.includes(message.channelId)
			: userToServer.autoproxy_blacklist.includes(message.channelId)) { replaceMessage = false; }


		const finalQuidId = userToServer.autoproxy_setTo === AutoproxySetTo.onWithSelectMode ? userToServer.activeQuidId : userToServer.lastProxiedQuidId;
		let finalQuid: Quid | null = null;

		for (const quid of (await Quid.findAll({ where: { userId: user.id }, attributes: ['id', 'proxy_startsWith', 'proxy_endsWith'] }))) {

			const hasProxy = quid.proxy_startsWith !== ''
				|| quid.proxy_endsWith !== '';

			const messageIncludesProxy = message.content.startsWith(quid.proxy_startsWith)
				&& message.content.endsWith(quid.proxy_endsWith);

			if (hasProxy && messageIncludesProxy) {

				finalQuid = quid;
				message.content = message.content.substring(quid.proxy_startsWith.length, message.content.length - quid.proxy_endsWith.length);
			}
		}

		if (replaceMessage) { userToServer.update({ lastProxiedQuidId: finalQuid?.id }); }

		return { replaceMessage, quid: await Quid.findByPk(finalQuid?.id ?? finalQuidId ?? ''), userToServer };
	}
}