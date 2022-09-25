import { Collection, GatewayIntentBits, LimitedCollection } from 'discord.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { BanList, CustomClient, DeleteList, DiscordEvent, GivenIdList, UserSchema, VoteList, WebhookMessages } from './typedef';
import path from 'path';

/* Note: Once slash commands replace message commands, DIRECT_MESSAGES intent and CHANNEL partial can be removed */
export const client = new CustomClient({
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
			return new LimitedCollection({ maxSize: 0, keepOverLimit: (member) => {
				const allDocumentNames = readdirSync('./database/profiles').filter(f => f.endsWith('.json'));
				return allDocumentNames
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
			|| manager.name === 'MessageManager'
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

export async function start(
	botToken: string,
	bfdToken: string,
	bfdAuthorization: string,
	topToken: string,
	topAuthorization: string,
	dblToken: string,
	dblAuthorization: string,
): Promise<void> {

	process.on('uncaughtException', (error) => console.log(error));

	client.votes.bfd = { token: bfdToken, authorization: bfdAuthorization, client: null };
	client.votes.top = { token: topToken, authorization: topAuthorization, client: null };
	client.votes.dbl = { token: dblToken, authorization: dblAuthorization, client: null };

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

	for (const file of readdirSync(path.join(__dirname, './events'))) {

		console.log(file);
		const { event } = require(`./events/${file}`) as { event: DiscordEvent; };

		if (event.once) {

			client.once(event.name, (...args) => {
				try { event.execute(client, ...args); }
				catch (error) { console.error(error); }
			});
		}
		else {

			client.on(event.name, (...args) => {
				try { event.execute(client, ...args); }
				catch (error) { console.error(error); }
			});
		}
	}

	await client.login(botToken);
}