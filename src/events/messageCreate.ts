import { Message } from 'discord.js';
import { sendVisitMessage } from '../commands/interaction/requestvisit';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, Event } from '../typedef';
import { createGuild } from '../utils/updateGuild';

export const event: Event = {
	name: 'messageCreate',
	once: false,
	async execute(client: CustomClient, message: Message) {

		if (message.author.bot || !message.inGuild()) { return; }

		if (message.content.toLowerCase().startsWith('rp ')) {

			await message.reply({ content: '**Regular commands are being replaced in favour of slash (`/`) commands.**\n\nIf you don\'t know what slash commands are or how to use them, read this article: https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ\n\nIf no slash commands for this bot appear, re-invite this bot by clicking on its profile and then on "Add to server".' });
			return;
		}

		const userData = await userModel.findOne({ userId: message.author.id }).catch(() => { return null; });
		const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId || 'DM']];
		let serverData = await serverModel.findOne({ serverId: message.guildId }).catch(() => { return null; });

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && message.inGuild()) {

			serverData = await createGuild(client, message.guild);
		}

		if (!userData || !characterData || !serverData) { return; }

		let replaceMessage = false;

		const allproxyIsDisabled = serverData.proxysetting.all.includes(message.channel.id) || serverData.proxysetting.all.includes('everywhere');
		const autoproxyIsDisabled = serverData.proxysetting.auto.includes(message.channel.id) || serverData.proxysetting.auto.includes('everywhere');

		/* Checking if the message starts with the character's proxy start and ends with the character's
		proxy end. If it does, it will set the current character to the character that the message is
		being sent from. */
		for (const character of Object.values(userData.characters)) {

			/* Checking if the message includes the proxy. If it does, it will change the message content
			to the prefix + 'say ' + the message content without the proxy. */
			const hasProxy = character.proxy.startsWith !== '' || character.proxy.endsWith !== '';
			const messageIncludesProxy = message.content.startsWith(character.proxy.startsWith) && message.content.endsWith(character.proxy.endsWith);
			if (hasProxy && messageIncludesProxy && !allproxyIsDisabled) {

				if (userData.currentCharacter[message.guildId]) { userData.currentCharacter[message.guildId] = character._id; }
				message.content = message.content.substring(character.proxy.startsWith.length, message.content.length - character.proxy.endsWith.length);
				replaceMessage = true;
			}
		}

		/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the
		prefix to the message. */
		const autoproxyIsToggled = userData.autoproxy[message.guildId]?.includes(message.channel.id) || userData.autoproxy[message.guildId]?.includes('everywhere');
		if (autoproxyIsToggled && !allproxyIsDisabled && !autoproxyIsDisabled) {

			replaceMessage = true;
		}

		if (serverData.currentlyVisiting !== null && message.channel.id === serverData.visitChannelId) {

			const otherServerData = /** @type {import('../typedef').ServerSchema | null} */ (await serverModel.findOne({ serverId: serverData.currentlyVisiting }));

			if (otherServerData) {

				await sendVisitMessage(client, message, userData, serverData, otherServerData);
				replaceMessage = true;
			}
		}

		if (replaceMessage) {

			// send message to /say command
		}
	},
};