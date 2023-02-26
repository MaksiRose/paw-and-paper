import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import DiscordUser from '../models/discordUser';
import Server from '../models/server';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { checkForProxy } from './messageCreate';

export const event: DiscordEvent = {
	name: 'messageUpdate',
	once: false,
	async execute(oldMessage: Message, newMessage: Message) {

		if (newMessage.author.bot || !newMessage.inGuild()) { return; }

		const server = await Server.findOne({ where: { id: newMessage.guildId } });
		const user = (await DiscordUser.findOne({ where: { id: newMessage.author.id } }))?.user;

		if (user === undefined || server === null) { return; }

		const { replaceMessage, quid } = await checkForProxy(newMessage, user, server);

		if (replaceMessage && hasName(quid) && (newMessage.content.length > 0 || newMessage.attachments.size > 0)) {

			const isSuccessful = await sendMessage(newMessage.channel, newMessage.content, quid, newMessage.attachments.size > 0 ? Array.from(newMessage.attachments.values()) : undefined, newMessage.reference ?? undefined)
				.catch(error => { console.error(error); });
			if (!isSuccessful) { return; }
			console.log(`\x1b[32m${newMessage.author.tag} (${newMessage.author.id})\x1b[0m successfully \x1b[31mproxied \x1b[0man edited message in \x1b[32m${newMessage.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (await hasPermission(newMessage.guild.members.me || newMessage.client.user.id, newMessage.channel, 'ManageMessages')) {

				await newMessage.delete();
			}
			else if (await hasPermission(newMessage.guild.members.me || newMessage.client.user.id, newMessage.channel, newMessage.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await newMessage.reply(getMissingPermissionContent(permissionDisplay.ManageMessages));
			}
		}
	},
};