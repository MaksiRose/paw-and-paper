import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { checkRankRequirements } from '../../utils/checkRoleRequirements';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { pronoun } from '../../utils/getPronouns';
import { getArrayElement, getMapData, getQuidDisplayname, respond, update } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { remindOfAttack } from './attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('rank-up')
		.setDescription('Once you successfully finished a quest, you can move up a rank using this command.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 8,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		let quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		let profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.unlockedRanks === 1 && profileData.rank === RankType.Youngling) {

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData!._id,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.rank = RankType.Apprentice;
				},
			);
			quidData = getMapData(userData.quids, quidData._id);
			profileData = getMapData(quidData.profiles, profileData.serverId);

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*An elderly smiles down at the young ${profileData.rank}.*\n"${quidData.name}, you have proven strength for the first time. I believe you are ready to explore the wild, and learn your strengths and weaknesses. Good luck in your rank as Apprentice" *they say. ${quidData.name}'s chest swells with pride.*`)],
			}, true);

			await checkRankRequirements(serverData, interaction, interaction.member, RankType.Apprentice, true);

			return;
		}
		else if (profileData.unlockedRanks === 2 && profileData.rank === RankType.Apprentice) {

			const botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setTitle(`What rank should ${quidData.name} have?`)
					.setFooter({ text: 'Available options: \n\nHealer (recommended for herbivores)\nHunter (recommended for carnivores)' })],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([
						new ButtonBuilder()
							.setCustomId(`rank_Healer_@${userData._id}`)
							.setLabel('Healer')
							.setEmoji('🛡️')
							.setStyle(ButtonStyle.Success),
						new ButtonBuilder()
							.setCustomId(`rank_Hunter_@${userData._id}`)
							.setLabel('Hunter')
							.setEmoji('⚔️')
							.setStyle(ButtonStyle.Success),
					]),
				],
			}, true);

			createCommandComponentDisabler(userData._id, interaction.guildId, botReply);

			return;
		}
		else if (profileData.unlockedRanks === 3 && (profileData.rank === RankType.Healer || profileData.rank === RankType.Hunter)) {

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData!._id,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.rank = RankType.Elderly;
				},
			);
			quidData = getMapData(userData.quids, quidData._id);
			profileData = getMapData(quidData.profiles, profileData.serverId);

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`"We are here to celebrate the nomination of ${quidData.name} to the highest rank, Elderly. The ${quidData.displayedSpecies || quidData.species} has shown incredible skills and persistence, and we congratulate ${pronoun(quidData, 1)} to ${pronoun(quidData, 2)} new title." *A mixture of howls, crows, meows, roars and squeaks are heard all around the hill, on which the Alpha stoof to announce this special event. It is not every day that a packmate gets the title of Elderly.*`)],
			}, true);

			await checkRankRequirements(serverData, interaction, interaction.member, RankType.Elderly, true);

			return;
		}

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} looks at the Elderly with puppy eyes, trying to convince them.*\n"I'm sorry, little ${quidData.displayedSpecies || quidData.species}, you haven't proven yourself worthy of moving up a rank yet. Try again once you were able to put your strength, agility and decision-making to the test!" *the Elderly says.*`)
				.setFooter({ text: `Go ${profileData.rank === 'Youngling' ? 'playing' : 'exploring'} until you find a quest! Once you have completed the quest, you can move up a rank.` })],
		}, true);
	},
};

export async function rankupInteractionCollector(
	interaction: ButtonInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (serverData === null) { throw new TypeError('serverData is null'); }
	if (userData === null) { throw new TypeError('userData is null'); }

	const rank = getArrayElement(interaction.customId.split('_'), 1);
	if (rank !== RankType.Hunter && rank !== RankType.Healer) { throw new Error('rank is not of RankType Hunter or Healer'); }

	userData = await userModel.findOneAndUpdate(
		u => u._id === userData!._id,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.rank = rank;
		},
	);
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));

	await update(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
			.setDescription(`*${quidData.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${quidData.name}, you are now a fully-fledged ${rank}. I am certain you will contribute greatly to the pack in this role."\n*The ${quidData.displayedSpecies || quidData.species} grins from ear to ear.*`)],
	});

	await checkRankRequirements(serverData, interaction, interaction.member, rank, true);

	return;
}