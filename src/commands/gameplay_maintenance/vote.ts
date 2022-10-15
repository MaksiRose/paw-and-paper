import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import userModel from '../../models/userModel';
import { CustomClient, SlashCommand, UserSchema, VoteList } from '../../typedef';
import { hasName, hasSpecies } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData, getSmallerNumber, respond } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
const { default_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Vote for this bot on one of three websites and get +30 energy each time.')
		.setDMPermission(true)
		.toJSON(),
	category: 'page3',
	position: 6,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));
		const profileData = getMapData(quidData.profiles, interaction.guildId || 'DM');
		if (!hasSpecies(interaction, quidData)) { return; }

		if (interaction.inGuild() && await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const botReply = await respond(interaction, {
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(default_color)
				.setDescription('Click a button to be sent to that websites bot page. After voting for this bot, select the website you voted on from the drop-down menu to get +30 energy.')],
			components: [
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents([
						new ButtonBuilder()
							.setLabel('top.gg')
							.setURL('https://top.gg/bot/862718885564252212')
							.setStyle(ButtonStyle.Link),
						new ButtonBuilder()
							.setLabel('discords.com')
							.setURL('https://discords.com/bots/bot/862718885564252212')
							.setStyle(ButtonStyle.Link),
						new ButtonBuilder()
							.setLabel('discordbotlist.com')
							.setURL('https://discordbotlist.com/bots/paw-and-paper')
							.setStyle(ButtonStyle.Link),
					]),
				new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents(new SelectMenuBuilder()
						.setCustomId(`vote_options_@${userData._id}`)
						.setPlaceholder('Select the site on which you voted')
						.setOptions([
							{ label: 'top.gg', value: 'top.gg' },
							{ label: 'discords.com', value: 'discords.com' },
							{ label: 'discordbotlist.com', value: 'discordbotlist.com' },
						])
						.setDisabled(!interaction.inGuild()),
					),
			],
		}, true);

		if (interaction.inGuild()) { createCommandComponentDisabler(userData._id, interaction.guildId, botReply); }
	},
};

export async function voteInteractionCollector(
	client: CustomClient,
	interaction: SelectMenuInteraction,
	userData: UserSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (userData === null) { throw new Error('userData is null'); }

	const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8')) as VoteList;
	const twelveHoursInMs = 43_200_000;

	const successfulTopVote = interaction.values[0] === 'top.gg'
		&& (
			(voteCache['id_' + interaction.user.id]?.lastRecordedTopVote ?? 0) > Date.now() - twelveHoursInMs
			|| await client.votes.top?.client?.hasVoted(interaction.user.id)
		);
	const redeemedTopVote = successfulTopVote
		&& Date.now() <= (voteCache['id_' + interaction.user.id]?.nextRedeemableTopVote || Date.now());

	const discordsVote: { voted: boolean, votes: Array<{ expires: number; }>; } | undefined = await client.votes.bfd?.client?.checkVote(interaction.user.id);
	const successfulDiscordsVote = interaction.values[0] === 'discords.com'
		&& (
			(voteCache['id_' + interaction.user.id]?.lastRecordedDiscordsVote ?? 0) > Date.now() - twelveHoursInMs
			|| discordsVote?.voted
		);
	const redeemedDiscordsVote = successfulDiscordsVote
		&& Date.now() <= (voteCache['id_' + interaction.user.id]?.nextRedeemableDiscordsVote ?? Date.now());

	const successfulDblVote = interaction.values[0] === 'discordbotlist.com'
		&& (voteCache['id_' + interaction.user.id]?.lastRecordedDblVote ?? 0) > Date.now() - twelveHoursInMs;
	const redeemedDblVote = successfulDblVote
		&& Date.now() <= (voteCache['id_' + interaction.user.id]?.nextRedeemableDblVote ?? Date.now());

	if (successfulTopVote || successfulDiscordsVote || successfulDblVote) {

		if (redeemedTopVote || redeemedDiscordsVote || redeemedDblVote) {

			await respond(interaction, {
				content: 'You already collected your reward for this vote!',
				ephemeral: true,
			}, false);
			return;
		}

		const newUserVoteCache = voteCache['id_' + interaction.user.id] ?? {};

		if (successfulTopVote) { newUserVoteCache.nextRedeemableTopVote = (voteCache['id_' + interaction.user.id]?.lastRecordedTopVote ?? Date.now()) + twelveHoursInMs; }
		if (successfulDiscordsVote === true) { newUserVoteCache.nextRedeemableDiscordsVote = (voteCache['id_' + interaction.user.id]?.lastRecordedDiscordsVote ?? Date.now()) + twelveHoursInMs; }
		if (successfulDblVote === true) { newUserVoteCache.nextRedeemableDblVote = (voteCache['id_' + interaction.user.id]?.lastRecordedDblVote ?? Date.now()) + twelveHoursInMs; }

		voteCache['id_' + interaction.user.id] = newUserVoteCache;
		writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));

		/* Gets the current active quid and the server profile from the account */
		let quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));
		let profileData = getMapData(quidData.profiles, interaction.guildId || 'DM');

		const energyPoints = getSmallerNumber(profileData.maxEnergy - profileData.energy, 30);

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData!._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
				p.energy += energyPoints;
			},
		);
		quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));
		profileData = getMapData(quidData.profiles, interaction.guildId || 'DM');

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Thank you for voting ☺️')
				.setFooter({ text: `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})` })],
		}, false);
		return;
	}

	await respond(interaction, {
		content: 'You haven\'t voted on this website in the last 12 hours! (If this is not right, please open a ticket with /ticket)',
		ephemeral: true,
	}, false);
	return;
}