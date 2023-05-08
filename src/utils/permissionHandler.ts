import { GuildChannelResolvable, GuildMember, PermissionResolvable, RepliableInteraction, Snowflake, PermissionFlagsBits, GuildTextBasedChannel, RoleResolvable } from 'discord.js';
import { client } from '../index';
import { addCommasAndAnd, respond } from './helperFunctions';

export const permissionDisplay: Record<keyof typeof PermissionFlagsBits, string> = {
	AddReactions: 'add reactions',
	Administrator: 'administrate',
	AttachFiles: 'attach files',
	BanMembers: 'ban members',
	ChangeNickname: 'change nickname',
	Connect: 'connect to voice channels',
	CreateInstantInvite: 'create instant invites',
	CreatePrivateThreads: 'create public threads',
	CreatePublicThreads: 'create public threads',
	DeafenMembers: 'deafen members in voice channels',
	EmbedLinks: 'embed links',
	KickMembers: 'kick members',
	ManageChannels: 'manage channels',
	ManageEmojisAndStickers: 'manage emojis and stickers',
	ManageEvents: 'manage events',
	ManageGuild: 'manage the server',
	ManageMessages: 'manage messages',
	ManageNicknames: 'manage nicknames',
	ManageRoles: 'manage roles',
	ManageThreads: 'manage threads',
	ManageWebhooks: 'manage webhooks',
	MentionEveryone: 'mention everyone',
	ModerateMembers: 'moderate members',
	MoveMembers: 'move members between voice channels',
	MuteMembers: 'mute members in voice channels',
	PrioritySpeaker: 'use priority speaker in voice channels',
	ReadMessageHistory: 'read message history',
	RequestToSpeak: 'request to speak in stage channels',
	SendMessages: 'send messages',
	SendMessagesInThreads: 'send messages in threads',
	SendTTSMessages: 'send TTS messages',
	Speak: 'speak in voice channels',
	Stream: 'stream in voice channels',
	UseApplicationCommands: 'use application commands',
	UseEmbeddedActivities: 'use embedded activities',
	UseExternalEmojis: 'use external emojis',
	UseExternalStickers: 'use external stickers',
	UseVAD: 'use voice activity detection in voice channels',
	ViewAuditLog: 'view the audit log',
	ViewChannel: 'view this channel',
	ViewGuildInsights: 'view the guild insights',
	ManageGuildExpressions: 'manage the guild expressions',
	ViewCreatorMonetizationAnalytics: 'view the creator monetization analytics',
	UseSoundboard: 'use the soundboard',
	UseExternalSounds: 'use external sounds',
	SendVoiceMessages: 'send voice messages',
};

export async function hasPermission(
	memberResolvable: GuildMember | Snowflake,
	channelResolvable: GuildChannelResolvable,
	permission: PermissionResolvable,
): Promise<boolean> {

	if (memberResolvable instanceof GuildMember) {

		return memberResolvable.permissionsIn(channelResolvable).has(permission);
	}
	else {

		const channel = typeof channelResolvable === 'string' ? await client.channels.fetch(channelResolvable, { force: false }) : channelResolvable;
		if (!channel || !channel.isTextBased()) { return false; }
		if (channel.isDMBased()) {

			const permissions: PermissionResolvable[] = ['SendMessages', 'ViewChannel', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'UseExternalEmojis', 'UseExternalStickers', 'ReadMessageHistory'];
			return permissions.includes(permission);
		}
		return channel.permissionsFor(memberResolvable)?.has(permission) === true;
	}
}

export function getMissingPermissionContent(
	permissionKind: string,
) { return { content: `I need permission to ${permissionKind} for this 😣`, failIfNotExists: false }; }

export async function missingPermissions(
	interaction: RepliableInteraction,
	permissions: (keyof typeof PermissionFlagsBits)[],
): Promise<boolean> {

	const member = interaction.guild?.members.me || await interaction.guild?.members.fetchMe({ force: false });
	const displayed: string[] = [];

	for (const permission of permissions) {

		if (await hasPermission(member || interaction.client.user.id, interaction.channelId || '', permission) === false) { displayed.push(permissionDisplay[permission]); }
	}

	if (displayed.length <= 0) { return false; }

	// This is always a reply
	await respond(interaction, getMissingPermissionContent(addCommasAndAnd(displayed)));
	return true;
}

export async function canManageWebhooks(
	channel: GuildTextBasedChannel,
): Promise<boolean> {

	const member = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

	if (await hasPermission(member || channel.client.user.id, channel.id, 'ManageWebhooks') === false) {

		if (await hasPermission(channel.guild.members.me || channel.client.user.id, channel, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) { await channel.send(getMissingPermissionContent(permissionDisplay.ManageWebhooks)); }
		return false;
	}
	return true;
}

export function getHigherRoleContent(
) { return { content: 'I can\'t add or remove roles that are above my highest role 😣', failIfNotExists: false }; }

export async function roleTooHigh(
	interaction: RepliableInteraction<'cached' >,
	role: RoleResolvable,
): Promise<boolean> {

	const member = interaction.guild.members.me || await interaction.guild.members.fetchMe({ force: false });
	const highestRole = member.roles.highest;

	if (highestRole.comparePositionTo(role) >= 1) { return false; }

	// This is always a reply
	await respond(interaction, getHigherRoleContent());
	return true;
}