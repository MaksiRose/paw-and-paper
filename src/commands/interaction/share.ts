import { EmbedBuilder, SlashCommandBuilder, SnowflakeUtil } from 'discord.js';
import { client } from '../..';
import { userModel, getUserData } from '../../models/userModel';
import { CurrentRegionType, QuidSchema, UserSchema } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { capitalizeString, getMapData, respond, userDataServersObject } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData1, serverData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData1, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData1);
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user has shared within the last two hours. */
		const sharingCooldown = sharingCooldownAccountsMap.get(userData1.quid._id + interaction.guildId);
		if (sharingCooldown && Date.now() - sharingCooldown < twoHoursInMs) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setTitle('You can only share every 2 hours!')
					.setDescription(`You can share again <t:${Math.floor((sharingCooldown + twoHoursInMs) / 1_000)}:R>.`),
				],
			});
			return;
		}

		/* Checks whether the user is an elderly. */
		if (userData1.quid.profile.rank !== 'Elderly') {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setDescription(`*${userData1.quid.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${userData1.quid.getDisplayspecies()}, you need to have a lot more adventures before you can start advising others!"`),
				],
			});
			return;
		}

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');

		/* Checks whether the mentioned user is associated with the account. */
		if (mentionedUser && Object.keys(userData1.userIds).includes(mentionedUser.id)) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setDescription(`*${userData1.quid.name} is very wise from all the adventures ${userData1.quid.pronoun(0)} had, but also a little... quaint. Sometimes ${userData1.quid.pronounAndPlural(0, 'sit')} down at the fireplace, mumbling to ${userData1.quid.pronoun(4)} a story from back in the day. Busy packmates look at ${userData1.quid.pronoun(1)} in confusion as they pass by.*`),
				],
			});
			return;
		}


		let _userData2 = mentionedUser ? (() => {
			try { return userModel.findOne(u => Object.keys(u.userIds).includes(mentionedUser.id)); }
			catch { return null; }
		})() : null;

		if (!mentionedUser) {

			const usersEligibleForSharing = (await userModel
				.find(
					u => Object.values(u.quids).filter(q => isEligableForSharing(u, q, interaction.guildId)).length > 0,
				))
				.filter(u => u._id !== userData1._id);

			if (usersEligibleForSharing.length <= 0) {

				// This is always a reply
				await respond(interaction, {
					content: messageContent,
					embeds: [...restEmbed, new EmbedBuilder()
						.setColor(userData1.quid.color)
						.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
						.setDescription(`*${userData1.quid.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${userData1.quid.pronoun(2)} disappointment, no one seems to be around.*`),
					],
				});
				return;
			}

			_userData2 = usersEligibleForSharing[getRandomNumber(usersEligibleForSharing.length)] || null;
			if (_userData2) {

				const newCurrentQuid = Object.values(_userData2.quids).find(q => isEligableForSharing(_userData2!, q, interaction.guildId));
				if (newCurrentQuid) {

					userDataServersObject;
					_userData2.servers[interaction.guildId] = {
						...userDataServersObject(_userData2, interaction.guildId),
						currentQuid: newCurrentQuid._id,
					};
				}
			}
		}

		/* Check if the user is interactable, and if they are, define quid data and profile data. */
		const userData2 = _userData2 ? getUserData(_userData2, interaction.guildId, _userData2.quids[_userData2.servers[interaction.guildId]?.currentQuid ?? '']) : null;
		if (!isInteractable(interaction, userData2, messageContent, restEmbed)) { return; }

		/* Add the sharing cooldown to user */
		sharingCooldownAccountsMap.set(userData1.quid._id + interaction.guildId, Date.now());

		/* Change the condition for user 1 */
		const decreasedStatsData = await changeCondition(userData1, 0, CurrentRegionType.Ruins);

		/* Give user 2 experience */
		const experienceIncrease = getRandomNumber(Math.round((userData2.quid.profile.levels * 50) * 0.15), Math.round((userData2.quid.profile.levels * 50) * 0.05));
		await userData2.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData2.quid._id).profiles, interaction.guildId);
				p.experience += experienceIncrease;
			},
		);

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		const infectedEmbed = await infectWithChance(userData1, userData2);

		const levelUpEmbed = await checkLevelUp(interaction, userData2, serverData);

		// This is always a reply
		const botReply = await respond(interaction, {
			content: `<@${Object.keys(userData2.userIds)[0]}>\n${messageContent}`,
			embeds: [
				new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setDescription(`*${userData2.quid.name} comes running to the old wooden trunk at the ruins where ${userData1.quid.name} sits, ready to tell an exciting story from long ago. ${capitalizeString(userData2.quid.pronoun(2))} eyes are sparkling as the ${userData1.quid.getDisplayspecies()} recounts great adventures and the lessons to be learned from them.*`)
					.setFooter({ text: `${decreasedStatsData.statsUpdateText}\n\n+${experienceIncrease} XP (${userData2.quid.profile.experience}/${userData2.quid.profile.levels * 50}) for ${userData2.quid.name}` }),
				...decreasedStatsData.injuryUpdateEmbed,
				...infectedEmbed,
				...levelUpEmbed,
			],
		});

		const channel = interaction.channel ?? await client.channels.fetch(interaction.channelId);
		if (channel === null || !channel.isTextBased()) { throw new TypeError('interaction.channel is null or not text based'); }
		await addFriendshipPoints({ createdTimestamp: SnowflakeUtil.timestampFrom(botReply.id), channel: channel }, userData1, userData2); // I have to call SnowflakeUtil since InteractionResponse wrongly misses the createdTimestamp which is hopefully added in the future

		await isPassedOut(interaction, userData1, true);

		await restAdvice(interaction, userData1);
		await drinkAdvice(interaction, userData1);
		await eatAdvice(interaction, userData1);
		return;
	},
};

function isEligableForSharing(
	userData: UserSchema,
	quid: QuidSchema<''>,
	guildId: string,
): quid is QuidSchema<never> {

	const user = getUserData(userData, guildId, quid);
	return hasNameAndSpecies(user) && user.quid.profile !== undefined && user.quid.profile.currentRegion === CurrentRegionType.Ruins && user.quid.profile.energy > 0 && user.quid.profile.health > 0 && user.quid.profile.hunger > 0 && user.quid.profile.thirst > 0 && user.quid.profile.injuries.cold === false && user.serverInfo?.hasCooldown !== true && isResting(user) === false;
}