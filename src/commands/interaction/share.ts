import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import { client } from '../../cluster';
import DiscordUser from '../../models/discordUser';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, getArrayElement, respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber } from '../../utils/randomizers';
import { isResting } from '../gameplay_maintenance/rest';
import { remindOfAttack } from '../gameplay_primary/attack';

const sharingCooldownAccountsMap: Map<string, number> = new Map();
const twoHoursInMs = 7_200_000;

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('share')
		.setDescription('Share an anecdote with someone and give them experience. Only available to Elderlies.')
		.setDMPermission(false)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user that you want to share a story with.')
				.setRequired(true))
		.toJSON(),
	category: 'page4',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server, discordUser }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('server is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!discordUser) { throw new TypeError('discordUser is undefined'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user has shared within the last two hours. */
		const sharingCooldown = sharingCooldownAccountsMap.get(quid.id + interaction.guildId);
		if (sharingCooldown && Date.now() - sharingCooldown < twoHoursInMs) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle('You can only share every 2 hours!')
					.setDescription(`You can share again <t:${Math.floor((sharingCooldown + twoHoursInMs) / 1_000)}:R>.`),
				],
			});
			return;
		}

		/* Checks whether the user is an elderly. */
		if (quidToServer.rank !== 'Elderly') {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${getDisplayspecies(quid)}, you need to have a lot more adventures before you can start advising others!"`),
				],
			});
			return;
		}

		/* Gets the mentioned user. */
		let mentionedUser = interaction.options.getUser('user');

		/* Checks whether the mentioned user is associated with the account. */
		const discordUser2 = mentionedUser ? await DiscordUser.findByPk(mentionedUser.id) : null;
		if (mentionedUser && (discordUser.id === mentionedUser.id || discordUser2?.userId === user.id)) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} is very wise from all the adventures ${pronoun(quid, 0)} had, but also a little... quaint. Sometimes ${pronounAndPlural(quid, 0, 'sit')} down at the fireplace, mumbling to ${pronoun(quid, 4)} a story from back in the day. Busy packmates look at ${pronoun(quid, 1)} in confusion as they pass by.*`),
				],
			});
			return;
		}


		let user2 = discordUser2 ? await User.findByPk(discordUser2.userId, { rejectOnEmpty: true }) : undefined;
		let userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id }, rejectOnEmpty: true }) : undefined;
		let quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId, { rejectOnEmpty: true }) : undefined;
		let quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id }, rejectOnEmpty: true }) : undefined;
		if (!mentionedUser) {

			const quidsToServers = await findSharableQuidsToServers(user.id, interaction.guildId);

			if (quidsToServers.length <= 0) {

				// This is always a reply
				await respond(interaction, {
					content: messageContent,
					embeds: [...restEmbed, new EmbedBuilder()
						.setColor(quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setDescription(`*${quid.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${pronoun(quid, 2)} disappointment, no one seems to be around.*`),
					],
				});
				return;
			}

			quidToServer2 = getArrayElement(quidsToServers, getRandomNumber(quidsToServers.length));
			quid2 = quidToServer2.quid;
			user2 = await User.findByPk(quid2.userId, { rejectOnEmpty: true });
			userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;

			const member2 = (await updateAndGetMembers(user2.id, interaction.guild))[0];
			if (!member2) { throw new TypeError('member2 is undefined'); }
			mentionedUser = member2.user;
		}

		/* Check if the user is interactable, and if they are, define quid data and profile data. */
		if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, messageContent, restEmbed) || !user2 || !userToServer2 || !quidToServer2) { return; }
		if (quidToServer2.rank === RankType.Youngling) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} wants to share a story with ${quid2.name}, but the ${getDisplayspecies(quid2)} is too young to sit down and listen and runs away to play.*`),
				],
			});
			return;
		}

		/* Add the sharing cooldown to user */
		sharingCooldownAccountsMap.set(quid.id + interaction.guildId, Date.now());

		/* Change the condition for user 1 */
		const decreasedStatsData = await changeCondition(quidToServer, quid, 0, CurrentRegionType.Ruins);

		/* Give user 2 experience */
		const experienceIncrease = getRandomNumber(Math.round(quidToServer2.levels * 7.5), Math.round(quidToServer2.levels * 2.5));
		await quidToServer2.update({ experience: quidToServer2.experience + experienceIncrease });

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		const infectedEmbed = await infectWithChance(quidToServer, quid, quidToServer2, quid2);

		const members = await updateAndGetMembers(user.id, interaction.guild);
		const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

		// This is always a reply
		const botReply = await respond(interaction, {
			content: `<@${mentionedUser.id}>\n${messageContent}`,
			embeds: [
				new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid2.name} comes running to the old wooden trunk at the ruins where ${quid.name} sits, ready to tell an exciting story from long ago. ${capitalize(pronoun(quid2, 2))} eyes are sparkling as the ${getDisplayspecies(quid)} recounts great adventures and the lessons to be learned from them.*`)
					.setFooter({ text: `${decreasedStatsData.statsUpdateText}\n\n+${experienceIncrease} XP (${quidToServer2.experience}/${quidToServer2.levels * 50}) for ${quid2.name}` }),
				...decreasedStatsData.injuryUpdateEmbed,
				...infectedEmbed,
				...levelUpEmbed,
			],
		});

		const channel = interaction.channel ?? await client.channels.fetch(interaction.channelId);
		if (channel === null || !channel.isSendable()) { throw new TypeError('interaction.channel is null or not text based'); }
		await addFriendshipPoints({ createdTimestamp: botReply.createdTimestamp, channel: channel }, quid, quid2, { serverId: interaction.guildId, userToServer, quidToServer, user });

		await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

		await restAdvice(interaction, user, quidToServer);
		await drinkAdvice(interaction, user, quidToServer);
		await eatAdvice(interaction, user, quidToServer);
		return;
	},
};

async function findSharableQuidsToServers(
	userId: string,
	guildId: string,
) {

	const rows = await QuidToServer.findAll({
		include: [{
			model: Quid<true>,
			where: {
				userId: { [Op.not]: userId },
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}],
		where: {
			serverId: guildId,
			rank: { [Op.not]: RankType.Youngling },
			currentRegion: CurrentRegionType.Ruins,
			health: { [Op.gt]: 0 },
			energy: { [Op.gt]: 0 },
			hunger: { [Op.gt]: 0 },
			thirst: { [Op.gt]: 0 },
			injuries_cold: false,
		},
	});

	return await Promise.all(rows.filter(async (row) => {

		const userToServer = await UserToServer.findOne({ where: { userId: row.quid.userId, serverId: guildId } });

		return row.quid.name !== '' &&
			row.quid.species !== null &&
			userToServer?.hasCooldown !== true &&
			(userToServer == null ? false : isResting(userToServer)) !== true;
	}));
}