import { Client, Collection, GatewayIntentBits, LimitedCollection } from 'discord.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { BanList, ContextMenuCommand, DeleteList, DiscordEvent, GivenIdList, SlashCommand, UserSchema, VoteList, Votes, WebhookMessages } from './typedef';
import path from 'path';
import { Api } from '@top-gg/sdk';
const { token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization } = require('../config.json');
const bfd = require('bfd-api-redux/src/main');

process.on('unhandledRejection', async (err) => {
	console.error('Unhandled Promise Rejection:\n', err);
});
process.on('uncaughtException', async (err) => {
	console.error('Uncaught Promise Exception:\n', err);
});
process.on('uncaughtExceptionMonitor', async (err) => {
	console.error('Uncaught Promise Exception (Monitor):\n', err);
});

/* Note: Once slash commands replace message commands, DIRECT_MESSAGES intent and CHANNEL partial can be removed */
export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
	makeCache: manager => {
		if (manager.name === 'GuildMemberManager') {
			return new LimitedCollection({ keepOverLimit: (member) => {
				const allDocumentNames = readdirSync('./database/profiles').filter(f => f.endsWith('.json'));
				return member.id === member.client.user.id || allDocumentNames
					.map(documentName => {
						return JSON.parse(readFileSync(`./database/profiles/${documentName}`, 'utf-8')) as UserSchema;
					})
					.filter(v => v.userId.includes(member.id))
					.length > 0;
			} });
		}
		if (
			manager.name === 'ApplicationCommandManager'
			|| manager.name === 'BaseGuildEmojiManager'
			|| manager.name === 'GuildBanManager'
			|| manager.name === 'GuildEmojiManager'
			|| manager.name === 'GuildInviteManager'
			|| manager.name === 'GuildScheduledEventManager'
			|| manager.name === 'GuildStickerManager'
			|| manager.name === 'MessageManager' // This needs to be changed to allow keepOverLimit for messages by the bot
			|| manager.name === 'PresenceManager'
			|| manager.name === 'ReactionManager'
			|| manager.name === 'ReactionUserManager'
			|| manager.name === 'StageInstanceManager'
			|| manager.name === 'ThreadManager'
			|| manager.name === 'ThreadMemberManager'
			|| manager.name === 'UserManager'
			|| manager.name === 'VoiceStateManager'
		) { return new LimitedCollection({ maxSize: 0 }); }
		return new Collection();
	},
});

export const handle: {
	slashCommands: Collection<string, SlashCommand>;
	contextMenuCommands: Collection<string, ContextMenuCommand>;
	votes: {
		bfd: Votes & { client: typeof bfd; },
		top: Votes & { client: Api | null; },
		dbl: Votes & { client: null; };
	};
} = {
	slashCommands: new Collection<string, SlashCommand>(),
	contextMenuCommands: new Collection<string, ContextMenuCommand>(),
	votes: {
		bfd: { token: bfd_token, authorization: bfd_authorization, client: null },
		top: { token: top_token, authorization: top_authorization, client: null },
		dbl: { token: dbl_token, authorization: dbl_authorization, client: null },
	},
};

start();

async function start(
): Promise<void> {

	if (existsSync('./database/bannedList.json') == false) {

		writeFileSync('./database/bannedList.json', JSON.stringify(({ users: [], servers: [] }) as BanList, null, '\t'));
	}

	if (existsSync('./database/errorStacks.json') == false) {

		writeFileSync('./database/errorStacks.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
	}

	if (existsSync('./database/givenIds.json') == false) {

		writeFileSync('./database/givenIds.json', JSON.stringify(([]) as GivenIdList, null, '\t'));
	}

	if (existsSync('./database/toDeleteList.json') == false) {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(({}) as DeleteList, null, '\t'));
	}

	if (existsSync('./database/voteCache.json') == false) {

		writeFileSync('./database/voteCache.json', JSON.stringify(({}) as VoteList, null, '\t'));
	}

	if (existsSync('./database/webhookCache.json') == false) {

		writeFileSync('./database/webhookCache.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
	}

	const allProfileNames = readdirSync('./database/profiles').filter(f => f.endsWith('.json'));
	for (const documentName of allProfileNames) {
		const doc = JSON.parse(readFileSync(`./database/profiles/${documentName}`, 'utf-8'));
		if (Object.hasOwn(doc, 'uuid')) {
			doc._id = doc.uuid;
			delete doc.uuid;
			writeFileSync(`./database/profiles/${documentName}`, JSON.stringify(doc, null, '\t'));
		}
	}

	const allServerNames = readdirSync('./database/servers').filter(f => f.endsWith('.json'));
	for (const documentName of allServerNames) {
		const doc = JSON.parse(readFileSync(`./database/servers/${documentName}`, 'utf-8'));
		if (Object.hasOwn(doc, 'uuid')) {
			doc._id = doc.uuid;
			delete doc.uuid;
			writeFileSync(`./database/servers/${documentName}`, JSON.stringify(doc, null, '\t'));
		}
	}

	for (const file of readdirSync(path.join(__dirname, './events'))) {

		const { event } = require(`./events/${file}`) as { event: DiscordEvent; };

		if (event.once) {

			client.once(event.name, async (...args) => {
				try { await event.execute(...args); }
				catch (error) { console.error(error); }
			});
		}
		else {

			client.on(event.name, async (...args) => {
				try { await event.execute(...args); }
				catch (error) { console.error(error); }
			});
		}
	}

	await client.login(token);
}