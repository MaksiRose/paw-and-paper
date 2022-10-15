import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Quid, SlashCommand } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { pronoun, pronounAndPlural, upperCasePronoun } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData1, serverData, embedArray) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new TypeError('serverData is null'); }
		if (!hasName(interaction, userData1)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
		let profileData1 = getMapData(quidData1.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData1)) { return; }

		/* Checks if the profile is on a cooldown, passed out, or resting. */
		if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray)) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user has shared within the last two hours. */
		const sharingCooldown = sharingCooldownAccountsMap.get(quidData1._id + interaction.guildId);
		if (sharingCooldown && Date.now() - sharingCooldown < twoHoursInMs) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
					.setTitle('You can only share every 2 hours!')
					.setDescription(`You can share again <t:${Math.floor((sharingCooldown + twoHoursInMs) / 1_000)}:R>.`),
				],
			}, false);
			return;
		}

		/* Checks whether the user is an elderly. */
		if (profileData1.rank !== 'Elderly') {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
					.setDescription(`*${quidData1.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${quidData1.displayedSpecies || quidData1.species}, you need to have a lot more adventures before you can start advising others!"`),
				],
			}, false);
			return;
		}

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');

		/* Checks whether the mentioned user is associated with the account. */
		if (mentionedUser && userData1.userId.includes(mentionedUser.id)) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
					.setDescription(`*${quidData1.name} is very wise from all the adventures ${pronoun(quidData1, 0)} had, but also a little... quaint. Sometimes ${pronounAndPlural(quidData1, 0, 'sit')} down at the fireplace, mumbling to ${pronoun(quidData1, 4)} a story from back in the day. Busy packmates look at ${pronoun(quidData1, 1)} in confusion as they pass by.*`),
				],
			}, false);
			return;
		}


		let userData2 = mentionedUser ? await userModel.findOne(u => u.userId.includes(mentionedUser.id)).catch(() => { return null; }) : null;

		if (!mentionedUser) {

			const usersEligibleForSharing = (await userModel
				.find(
					u => Object.values(u.quids).filter(q => isEligableForSharing(u._id, q, interaction.guildId)).length > 0,
				))
				.filter(u => u._id !== userData1._id);

			if (usersEligibleForSharing.length <= 0) {

				await respond(interaction, {
					content: messageContent,
					embeds: [...embedArray, new EmbedBuilder()
						.setColor(quidData1.color)
						.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
						.setDescription(`*${quidData1.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${pronoun(quidData1, 2)} disappointment, no one seems to be around.*`),
					],
				}, false);
				return;
			}

			userData2 = usersEligibleForSharing[getRandomNumber(usersEligibleForSharing.length)] || null;
			if (userData2) {

				const newCurrentQuid = Object.values(userData2.quids).find(q => isEligableForSharing(userData2!._id, q, interaction.guildId));
				if (newCurrentQuid) { userData2.currentQuid[interaction.guildId] = newCurrentQuid._id; }
			}
		}

		/* Check if the user is interactable, and if they are, define quid data and profile data. */
		if (!isInteractable(interaction, userData2, messageContent, embedArray)) { return; }

		let quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
		let profileData2 = getMapData(quidData2.profiles, interaction.guildId);

		/* Add the sharing cooldown to user */
		sharingCooldownAccountsMap.set(quidData1._id + interaction.guildId, Date.now());

		/* Change the condition for user 1 */
		const decreasedStatsData = await changeCondition(userData1, quidData1, profileData1, 0, CurrentRegionType.Ruins);
		profileData1 = decreasedStatsData.profileData;

		/* Give user 2 experience */
		const experienceIncrease = getRandomNumber(Math.round((profileData2.levels * 50) * 0.15), Math.round((profileData2.levels * 50) * 0.05));
		userData2 = await userModel.findOneAndUpdate(
			u => u._id === userData2!._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidData2._id).profiles, interaction.guildId);
				p.experience += experienceIncrease;
			},
		);
		quidData2 = getMapData(userData2.quids, quidData2._id);
		profileData2 = getMapData(quidData2.profiles, interaction.guildId);

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		const infectedCheck = await infectWithChance(userData1, quidData1, profileData1, quidData2, profileData2);
		profileData1 = infectedCheck.profileData;

		const levelUpCheck = await checkLevelUp(interaction, userData2, quidData2, profileData2, serverData);
		profileData2 = levelUpCheck.profileData;

		const botReply = await respond(interaction, {
			content: `<@${userData2.userId[0]}>\n${messageContent}`,
			embeds: [
				new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
					.setDescription(`*${quidData2.name} comes running to the old wooden trunk at the ruins where ${quidData1.name} sits, ready to tell an exciting story from long ago. ${upperCasePronoun(quidData2, 2)} eyes are sparkling as the ${quidData1.displayedSpecies || quidData1.species} recounts great adventures and the lessons to be learned from them.*`)
					.setFooter({ text: `${decreasedStatsData.statsUpdateText}\n\n+${experienceIncrease} XP (${profileData2.experience}/${profileData2.levels * 50}) for ${quidData2.name}` }),
				...(decreasedStatsData.injuryUpdateEmbed ? [decreasedStatsData.injuryUpdateEmbed] : []),
				...(infectedCheck.infectedEmbed ? [infectedCheck.infectedEmbed] : []),
				...(levelUpCheck.levelUpEmbed ? [levelUpCheck.levelUpEmbed] : []),
			],
		}, true);

		await addFriendshipPoints(botReply, userData1, quidData1._id, userData2, quidData2._id);

		await isPassedOut(interaction, userData1, quidData1, profileData1, true);

		await restAdvice(interaction, userData1, profileData1);
		await drinkAdvice(interaction, userData1, profileData1);
		await eatAdvice(interaction, userData1, profileData1);
		return;
	},
};

function isEligableForSharing(
	_id: string,
	quid: Quid,
	guildId: string,
): quid is Quid<true> {

	const p = quid.profiles[guildId];
	return quid.name !== '' && quid.species !== '' && p !== undefined && p.currentRegion === CurrentRegionType.Ruins && p.energy > 0 && p.health > 0 && p.hunger > 0 && p.thirst > 0 && p.injuries.cold === false && cooldownMap.get(_id + guildId) !== true && p.isResting === false && isResting(_id, p.serverId) === false;
}