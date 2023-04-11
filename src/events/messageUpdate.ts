import { Message } from 'discord.js';
import { sendMessage } from '../commands/interaction/say';
import DiscordUser from '../models/discordUser';
import Server from '../models/server';
import User from '../models/user';
import { DiscordEvent } from '../typings/main';
import { hasName } from '../utils/checkUserState';
import { isObject } from '../utils/helperFunctions';
import { getMissingPermissionContent, hasPermission, permissionDisplay } from '../utils/permissionHandler';
import { createGuild } from '../utils/updateGuild';
import { checkForProxy } from './messageCreate';

export const event: DiscordEvent = {
	name: 'messageUpdate',
	once: false,
	async execute(_oldMessage: Message, message: Message) {

		if (message.author.bot || !message.inGuild()) { return; }

		const discordUser = await DiscordUser.findByPk(message.author.id, {
			include: [{ model: User, as: 'user' }],
		});
		const user = discordUser?.user;

		const server = (await Server.findByPk(message.guildId)) ?? await createGuild(message.guild);

		if (user === undefined || server === null) { return; }
		if (user.proxy_editing === false) { return; }

		const { replaceMessage, quid, userToServer } = await checkForProxy(message, user, server);

		if (replaceMessage && hasName(quid) && (message.content.length > 0 || message.attachments.size > 0)) {

			const botMessage = await sendMessage(message.channel, message.content, quid, message.author.id, message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined, message.reference ?? undefined, user, userToServer ?? undefined)
				.catch(error => {
					console.error(error);
					return null;
				});

			if (!botMessage) { return; }
			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully \x1b[31mproxied \x1b[0man edited message in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (await hasPermission(message.guild.members.me || message.client.user.id, message.channel, 'ManageMessages')) {

				await message
					.delete()
					.catch(async e => { if (isObject(e) && e.code === 10008) { await message.channel.messages.delete(botMessage.id); } }); // If the message is unknown, its webhooked message is probbaly not supposed to exist too, so we delete it
			}
			else if (await hasPermission(message.guild.members.me || message.client.user.id, message.channel, message.channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) {

				await message.reply(getMissingPermissionContent(permissionDisplay.ManageMessages));
			}
		}
	},
};