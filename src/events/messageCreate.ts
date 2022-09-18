import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
// import { sendVisitMessage } from '../commands/interaction/requestvisit';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, Event, ProxyConfigType, ProxyListType, ServerSchema, UserSchema } from '../typedef';
import { createGuild } from '../utils/updateGuild';

export const event: Event = {
	name: 'messageCreate',
	once: false,
	async execute(client: CustomClient, message: Message) {

		if (message.author.bot || !message.inGuild()) { return; }

		if (message.content.toLowerCase().startsWith('rp ')) {

			await message.reply({ content: '**Regular commands were replaced in favour of slash (`/`) commands.**\n\nIf you don\'t know what slash commands are or how to use them, read this article: <https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ>\n\nIf no slash commands for this bot appear, re-invite this bot by clicking on its profile and then on "Add to server".' });
			return;
		}

		const userData = await userModel.findOne(u => u.userId.includes(message.author.id)).catch(() => { return null; });
		const quidData = userData?.quids?.[userData?.currentQuid?.[message.guildId || 'DM'] || ''];
		let serverData = await serverModel.findOne(s => s.serverId === message.guildId).catch(() => { return null; });

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && message.inGuild()) {

			serverData = await createGuild(client, message.guild)
				.catch(async (error) => {
					console.error(error);
					return null;
				});
		}

		if (!userData || !quidData || !serverData) { return; }

		// eslint-disable-next-line prefer-const
		let { replaceMessage, messageContent } = checkForProxy(serverData, message, userData);
		message.content = messageContent;

		if (serverData.currentlyVisiting !== null && message.channel.id === serverData.visitChannelId) {

			const otherServerData = /** @type {import('../typedef').ServerSchema | null} */ (await serverModel.findOne(s => s.serverId === serverData?.currentlyVisiting));

			if (otherServerData) {

				// await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (replaceMessage && (message.content.length > 0 || message.attachments.size > 0)) {

			await sendMessage(message.channel, message.content, quidData, userData.uuid, message.author.id, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined)
				.catch(error => { console.error(error); });

			message
				.delete()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						console.error(error);
					}
				});
		}
	},
};

export function checkForProxy(
	serverData: ServerSchema,
	message: Message<true> & Message<boolean>,
	userData: UserSchema,
): { replaceMessage: boolean, messageContent: string; } {

	let replaceMessage = false;

	const proxyIsDisabled = (serverData.proxySettings.channels.setTo === ProxyListType.Blacklist && serverData.proxySettings.channels.blacklist.includes(message.channelId)) || (serverData.proxySettings.channels.setTo === ProxyListType.Whitelist && !serverData.proxySettings.channels.whitelist.includes(message.channelId));

	/* Checking if the message starts with the quid's proxy start and ends with the quid's
	proxy end. If it does, it will set the current quid to the quid that the message is
	being sent from. */
	for (const quid of Object.values(userData.quids)) {

		/* Checking if the message includes the proxy. If it does, it will change the message content
		to the prefix + 'say ' + the message content without the proxy. */
		const hasProxy = quid.proxy.startsWith !== '' || quid.proxy.endsWith !== '';
		const messageIncludesProxy = message.content.startsWith(quid.proxy.startsWith) && message.content.endsWith(quid.proxy.endsWith);
		if (hasProxy && messageIncludesProxy && !proxyIsDisabled) {

			if (userData.currentQuid[message.guildId]) { userData.currentQuid[message.guildId] = quid._id; }
			message.content = message.content.substring(quid.proxy.startsWith.length, message.content.length - quid.proxy.endsWith.length);
			replaceMessage = true;
		}
	}

	/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the
	prefix to the message. */
	const autoproxyIsToggled = (userData.settings.proxy.servers[message.guildId]?.autoproxy.setTo === ProxyConfigType.Enabled && (userData.settings.proxy.servers[message.guildId]?.autoproxy.channels.setTo === ProxyListType.Blacklist && !userData.settings.proxy.servers[message.guildId]?.autoproxy.channels.blacklist.includes(message.channelId)) || (userData.settings.proxy.servers[message.guildId]?.autoproxy.channels.setTo === ProxyListType.Whitelist && userData.settings.proxy.servers[message.guildId]?.autoproxy.channels.whitelist.includes(message.channelId))) || (userData.settings.proxy.servers[message.guildId]?.autoproxy.setTo === ProxyConfigType.FollowGlobal && userData.settings.proxy.global.autoproxy === true);
	if (autoproxyIsToggled && !proxyIsDisabled) { replaceMessage = true; }

	return { replaceMessage, messageContent: message.content };
}