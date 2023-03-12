import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, SlashCommandBuilder } from 'discord.js';
import { handle } from '../..';
import Quid from '../../models/quid';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { now, respond } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		let restEmbed: EmbedBuilder[] = [];
		if (interaction.inGuild()) {

			if (!userToServer) { throw new TypeError('userToServer is undefined'); }
			if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }
			const restEmbedOrFalse = await isInvalid(interaction, user, userToServer, quid, quidToServer);
			if (restEmbedOrFalse === false) { return; }
			else { restEmbed = restEmbedOrFalse; }
		}

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: [...restEmbed, new EmbedBuilder()
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
				new ActionRowBuilder<StringSelectMenuBuilder>()
					.setComponents(new StringSelectMenuBuilder()
						.setCustomId(`vote_options_@${user.id}`)
						.setPlaceholder('Select the site on which you voted')
						.setOptions([
							{ label: 'top.gg', value: 'top.gg' },
							{ label: 'discords.com', value: 'discords.com' },
							{ label: 'discordbotlist.com', value: 'discordbotlist.com' },
						])
						.setDisabled(!interaction.inGuild()),
					),
			],
			fetchReply: interaction.inGuild() ? true : false,
		});

		if (interaction.inGuild()) { saveCommandDisablingInfo(userToServer!, interaction, interaction.channelId, botReply.id); }
	},
	async sendMessageComponentResponse(interaction, { user, quid, quidToServer }) {

		if (!interaction.isStringSelectMenu()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		const twelveHoursInS = 43_200;

		const successfulTopVote = interaction.values[0] === 'top.gg'
		&& (
			(user.lastRecordedTopVote ?? 0) > now() - twelveHoursInS
			|| await handle.votes.top?.client?.hasVoted(interaction.user.id)
		);
		const redeemedTopVote = successfulTopVote
		&& now() <= (user.nextRedeemableTopVote ?? 0);

		const discordsVote: { voted: boolean, votes: Array<{ expires: number; }>; } | undefined = await handle.votes.bfd?.client?.checkVote(interaction.user.id);
		const successfulDiscordsVote = interaction.values[0] === 'discords.com'
		&& (
			(user.lastRecordedDiscordsVote ?? 0) > now() - twelveHoursInS
			|| discordsVote?.voted
		);
		const redeemedDiscordsVote = successfulDiscordsVote
		&& now() <= (user.nextRedeemableDiscordsVote ?? 0);

		const successfulDblVote = interaction.values[0] === 'discordbotlist.com'
		&& (user.lastRecordedDblVote ?? 0) > now() - twelveHoursInS;
		const redeemedDblVote = successfulDblVote
		&& now() <= (user.nextRedeemableDblVote ?? 0);

		if (successfulTopVote || successfulDiscordsVote || successfulDblVote) {

			if (redeemedTopVote || redeemedDiscordsVote || redeemedDblVote) {

				// This is always a reply
				await respond(interaction, {
					content: 'You already collected your reward for this vote!',
					ephemeral: true,
				});
				return;
			}

			if (successfulTopVote) { await user.update({ nextRedeemableTopVote: (user.lastRecordedTopVote || now()) + twelveHoursInS }); }
			if (successfulDiscordsVote) { await user.update({ nextRedeemableDiscordsVote: (user.lastRecordedDiscordsVote || now()) + twelveHoursInS }); }
			if (successfulDblVote) { await user.update({ nextRedeemableDblVote: (user.lastRecordedDblVote || now()) + twelveHoursInS }); }

			const energyPoints = Math.min(quidToServer.maxEnergy - quidToServer.energy, 30);

			await quidToServer.update({ energy: quidToServer.energy + energyPoints });

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(default_color)
					.setTitle('Thank you for voting ☺️')
					.setFooter({ text: `+${energyPoints} energy (${quidToServer.energy}/${quidToServer.maxEnergy})` })],
			});
			return;
		}

		// This is always a reply
		await respond(interaction, {
			content: 'You haven\'t voted on this website in the last 12 hours! (If this is not right, please open a ticket with /ticket)',
			ephemeral: true,
		});
		return;
	},
};