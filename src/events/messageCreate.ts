import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import DiscordUser from '../models/discordUser';
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

		if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 1: ${performance.now()}`); }

		const partialUser = (await DiscordUser.findByPk(message.author.id, {
			include: [{ model: User, as: 'user', attributes: ['id', 'antiproxies', 'proxy_setTo', 'lastGlobalActiveQuidId', 'proxy_lastGlobalProxiedQuidId', 'proxy_keepInMessage', 'tag'] }],
		}))?.user;
		if (!partialUser) { return; }

		if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 2: ${performance.now()}`); }

		const partialServer = (await Server.findByPk(message.guildId, { attributes: ['id', 'currentlyVisitingChannelId', 'visitChannelId', 'logChannelId', 'logLimitsId', 'proxy_channelLimitsId', 'proxy_roleLimitsId', 'nameRuleSets'] })) ?? await createGuild(message.guild);

		if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 3: ${performance.now()}`); }

		let { replaceMessage, quid, partialUserToServer } = await checkForProxy(message, partialUser);

		if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 9: ${performance.now()}`); }

		if (partialServer.currentlyVisitingChannelId !== null && message.channel.id === partialServer.visitChannelId) {

			const otherServerData = await Server.findOne({ where: { id: partialServer.currentlyVisitingChannelId } });

			if (otherServerData) {

				// await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (replaceMessage && hasName(quid) && (message.content.length > 0 || message.attachments.size > 0)) {

			const botMessage = await sendMessage(message.channel, message.content, quid, partialUser, partialServer, message.author, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined, partialUserToServer ?? undefined)
				.catch(error => {
					console.error(error);
					return null;
				});

			if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 10: ${performance.now()}`); }

			if (!botMessage) { return; }
			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully \x1b[31mproxied \x1b[0ma new message in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, 'ManageMessages')) {

				await message
					.delete()
					.catch(async e => { if (isObject(e) && e.code === 10008) { await message.channel.messages.delete(botMessage.id); } }); // If the message is unknown, its webhooked message is probbaly not supposed to exist too, so we delete it
				if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 11: ${performance.now()}`); }
			}
			else if (await hasPermission(message.guild.members.me || await message.channel.guild.members.fetchMe({ force: false }) || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await message
					.reply(getMissingPermissionContent(permissionDisplay.ManageMessages))
					.catch(async (e) => {


						if (isObject(e) && e.code === 160002) {

							await message.channel.send(getMissingPermissionContent(permissionDisplay.ManageMessages));
						}
						else { throw e; }
					});
			}
		}
	},
};

export async function checkForProxy(
	message: Message<true> & Message<boolean>,
	partialUser: User,
): Promise<{ replaceMessage: boolean, quid: Quid | null, partialUserToServer: UserToServer | null; }> {

	const [partialUserToServer, partialQuids] = await Promise.all([
		UserToServer.findOne({
			where: { serverId: message.guildId, userId: partialUser.id },
			attributes: ['id', 'autoproxy_setTo', 'autoproxy_setToWhitelist', 'autoproxy_whitelist', 'autoproxy_blacklist', 'activeQuidId', 'lastProxiedQuidId', 'tag'],
		}),
		Quid.findAll({ where: { userId: partialUser.id }, attributes: ['id', 'proxies'] }),
	]);

	if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 4: ${performance.now()}`); }

	DiscordUserToServer
		.update({ isMember: true, lastUpdatedTimestamp: now() }, { where: { discordUserId: message.author.id, serverId: message.guildId }, logging: false })
		.then(([r]) => {
			if (r === 0) { DiscordUserToServer.create({ id: generateId(), discordUserId: message.author.id, serverId: message.guildId, isMember: true, lastUpdatedTimestamp: now() }); }
		});

	if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 5: ${performance.now()}`); }


	const messageIncludesAntiProxy = partialUser.antiproxies.some(
		ap => message.content.startsWith(ap[0] ?? '') && message.content.endsWith(ap[1] ?? ''),
	);
	const followsGlobalSettings = partialUserToServer === null || partialUserToServer.autoproxy_setTo === AutoproxySetTo.followGlobal;

	/* If the message includes an antiproxy, then don't replace the message. If the users settings are set to sticky mode, then update the database so it doesn't proxy anymore. In any case, return the proxy check, because an included antiproxy always means the message should not be proxied. */
	if (messageIncludesAntiProxy) {
		if (partialUser.proxy_setTo === ProxySetTo.onWithStickyMode) {
			if (followsGlobalSettings) {
				await Promise.all([
					partialUserToServer?.update({ lastProxiedQuidId: null }),
					partialUser.update({ proxy_lastGlobalProxiedQuidId: null }),
				]);
			}
			else {
				await partialUserToServer.update({ lastProxiedQuidId: null });
			}
		}
		return { replaceMessage: false, quid: null, partialUserToServer };
	}

	let replaceMessage = true;
	let finalQuid: Quid | null = null;
	let finalQuidId: string | null = null;

	if (followsGlobalSettings) {
		if (partialUser.proxy_setTo === ProxySetTo.off) { replaceMessage = false; }

		finalQuidId = partialUser.proxy_setTo === ProxySetTo.onWithSelectMode ? partialUser.lastGlobalActiveQuidId : partialUser.proxy_lastGlobalProxiedQuidId;
	}
	else {
		if (partialUserToServer.autoproxy_setTo === AutoproxySetTo.off) { replaceMessage = false; }
		if (partialUserToServer.autoproxy_setToWhitelist === true
			? !partialUserToServer.autoproxy_whitelist.includes(message.channelId)
			: partialUserToServer.autoproxy_blacklist.includes(message.channelId)) { replaceMessage = false; }

		finalQuidId = partialUserToServer.autoproxy_setTo === AutoproxySetTo.onWithSelectMode ? partialUserToServer.activeQuidId : partialUserToServer.lastProxiedQuidId;
	}

	if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 7a: ${performance.now()}`); }

	for (const partialQuid of partialQuids) {
		for (const p of partialQuid.proxies) {
			if (message.content.startsWith(p[0] ?? '')
					&& message.content.endsWith(p[1] ?? '')) {
				finalQuid = partialQuid;
				replaceMessage = true;
				if (partialUser.proxy_keepInMessage === false) {
					message.content = message.content.substring(p[0]?.length ?? 0, message.content.length - (p[1]?.length ?? 0));
				}
			}
		}
	}

	if (message.channelId === '962969729247637544') { console.log(`message id: ${message.id} // time 8a: ${performance.now()}`); }

	if (replaceMessage) {
		if (followsGlobalSettings) {
			await Promise.all([partialUserToServer?.update({ lastProxiedQuidId: finalQuid?.id }),
				partialUser.update({ proxy_lastGlobalProxiedQuidId: finalQuid?.id })]);
		}
		else {
			await partialUserToServer.update({ lastProxiedQuidId: finalQuid?.id });
		}
	}

	finalQuidId = finalQuid?.id ?? finalQuidId;
	const quid = finalQuidId ? await Quid.findByPk(finalQuidId) : null;
	return { replaceMessage, quid, partialUserToServer };
}