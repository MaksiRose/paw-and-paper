import { Client, GatewayIntentBits, Options, Snowflake } from 'discord.js';
import { readdirSync, readFileSync } from 'fs';
import { UserSchema } from './typings/data/user';

function sweepFilter(something: {id: Snowflake, client: Client<true>}) {
	const allDocumentNames = readdirSync('./database/profiles').filter(f => f.endsWith('.json'));
	return (something.id !== something.client.user.id) && (allDocumentNames
		.map(documentName => {
			return JSON.parse(readFileSync(`./database/profiles/${documentName}`, 'utf-8')) as UserSchema;
		})
		.filter(v => v.userId.includes(something.id))
		.length <= 0);
}

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
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		ApplicationCommandManager: 0,
		BaseGuildEmojiManager: 0,
		GuildBanManager: 0,
		GuildEmojiManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
		GuildStickerManager: 0,
		PresenceManager: 0,
		ReactionManager: 0,
		ReactionUserManager: 0,
		StageInstanceManager: 0,
		VoiceStateManager: 0,
	}),
	sweepers: {
		...Options.DefaultSweeperSettings,
		guildMembers: {
			interval: 3600, // Every hour
			filter: () => sweepFilter,
		},
		threadMembers: {
			interval: 3600, // Every hour
			filter: () => sweepFilter,
		},
		users: {
			interval: 3600, // Every hour
			filter: () => sweepFilter,
		},
		messages: {
			interval: 3600, // Every hour
			filter: () => ((message) => { return message.author.id !== message.client.user.id; }),
		},
	},

});