import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import DiscordUser from '../models/discordUser';
import ProxyLimits from '../models/proxyLimits';
import Quid from '../models/quid';
import Server from '../models/server';
import DiscordUserToServer from '../models/discordUserToServer';
import User from '../models/user';
import UserToServer from '../models/userToServer';
// import { sendVisitMessage } from '../commands/interaction/requestvisit';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { createGuild } from '../utils/updateGuild';
import { isObject, now } from '../utils/helperFunctions';

export const event: DiscordEvent = {
	name: 'messageCreate',
	once: false,
	async execute(message: Message) {

		console.log(message.id, '| ' + (Date.now() - message.createdTimestamp) + 'ms');
		console.time(message.id);
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

		console.timeLog(message.id);
		let { replaceMessage, quid, userToServer } = await checkForProxy(message, user, server);
		console.timeLog(message.id);

		if (server.currentlyVisitingChannelId !== null && message.channel.id === server.visitChannelId) {

			const otherServerData = await Server.findOne({ where: { id: server.currentlyVisitingChannelId } });

			if (otherServerData) {

				// await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (replaceMessage && hasName(quid) && (message.content.length > 0 || message.attachments.size > 0)) {

			console.timeLog(message.id);
			const botMessage = await sendMessage(message.channel, message.content, quid, message.author.id, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined, user, userToServer ?? undefined)
				.catch(error => {
					console.error(error);
					return null;
				});
			console.timeEnd(message.id);

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

	let channelLimits = await ProxyLimits.findByPk(server.proxy_channelLimitsId);
	if (!channelLimits) {
		channelLimits = await ProxyLimits.create();
		server.update({ proxy_channelLimitsId: channelLimits.id });
	}

	const proxyIsDisabled = channelLimits.setToWhitelist ? !channelLimits.whitelist.includes(message.channelId) : channelLimits.blacklist.includes(message.channelId);
	if (proxyIsDisabled) { return { replaceMessage: false, quid: null, userToServer: null }; }

	let replaceMessage = false;
	let isAntiProxy = false;

	const userToServer = await UserToServer.findOne({
		where: { serverId: message.guildId, userId: user.id },
	});
	let chosenQuidId = userToServer?.activeQuidId ?? null;

	/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the prefix to the message. */
	const autoproxyIsToggled = userToServer
		? userToServer.autoproxy_setToWhitelist === null
			? user.proxy_globalAutoproxy === true
			: userToServer.autoproxy_setToWhitelist === true
				? userToServer.autoproxy_whitelist.includes(message.channelId)
				: !userToServer.autoproxy_blacklist.includes(message.channelId)
		: user.proxy_globalAutoproxy === true;

	if (autoproxyIsToggled) {

		replaceMessage = true;

		/* Checking if the user has stickymode enabled eitehr locally or globally. If they do, the quid is changed to the quidId (which is null if the last proxied quid is "nothing") */
		const quidId = userToServer?.stickymode_setTo === true
			? userToServer.lastProxiedQuidId
			: (
				userToServer === null
				|| userToServer.stickymode_setTo === null
			) && user.proxy_globalStickymode === true
				? user.proxy_lastGlobalProxiedQuidId
				: false;
		if (quidId !== false) { chosenQuidId = quidId; }
		if (chosenQuidId === null) {

			replaceMessage = false;
			isAntiProxy = true;
		}
	}

	/* Checking if the message starts with the quid's proxy start and ends with the quid's proxy end. If it does, it will set the current quid to the quid that the message is being sent from. */
	const hasAntiProxy = user.antiproxy_startsWith !== ''
		|| user.antiproxy_endsWith !== '';
	const messageIncludesAntiProxy = message.content.startsWith(user.antiproxy_startsWith)
		&& message.content.endsWith(user.antiproxy_endsWith);
	if (hasAntiProxy && messageIncludesAntiProxy) {

		chosenQuidId = null;
		replaceMessage = false;
		isAntiProxy = true;
	}
	else {

		for (const quid of (await Quid.findAll({ where: { userId: user.id }, attributes: ['id', 'proxy_startsWith', 'proxy_endsWith'] }))) {

			/* Checking if the message includes the proxy. If it does, it will change the message content to the prefix + 'say ' + the message content without the proxy. */
			const hasProxy = quid.proxy_startsWith !== ''
				|| quid.proxy_endsWith !== '';

			const messageIncludesProxy = message.content.startsWith(quid.proxy_startsWith)
				&& message.content.endsWith(quid.proxy_endsWith);

			if (hasProxy && messageIncludesProxy) {

				chosenQuidId = quid.id;
				message.content = message.content.substring(quid.proxy_startsWith.length, message.content.length - quid.proxy_endsWith.length);
				replaceMessage = true;
			}
		}
	}

	DiscordUserToServer.update({ isMember: true, lastUpdatedTimestamp: now() }, { where: { discordUserId: message.author.id, serverId: message.guildId } });

	if (replaceMessage || isAntiProxy) {

		userToServer?.update({ lastProxiedQuidId: chosenQuidId });
		user.update({ proxy_lastGlobalProxiedQuidId: chosenQuidId });
	}

	return { replaceMessage, quid: chosenQuidId ? await Quid.findOne({ where: { id: chosenQuidId } }) : null, userToServer };
}