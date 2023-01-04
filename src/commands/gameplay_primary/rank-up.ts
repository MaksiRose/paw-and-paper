import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { checkRankRequirements } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getArrayElement, getMapData, respond } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData, serverData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (userData.quid.profile.unlockedRanks === 1 && userData.quid.profile.rank === RankType.Youngling) {

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.rank = RankType.Apprentice;
				},
			);

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*An elderly smiles down at the young ${userData.quid.profile.rank}.*\n"${userData.quid.name}, you have proven strength for the first time. I believe you are ready to explore the wild, and learn your strengths and weaknesses. Good luck in your rank as Apprentice" *they say. ${userData.quid.name}'s chest swells with pride.*`)],
			});

			await checkRankRequirements(serverData, interaction, interaction.member, RankType.Apprentice, true);

			return;
		}
		else if (userData.quid.profile.unlockedRanks === 2 && userData.quid.profile.rank === RankType.Apprentice) {

			// This is always a reply
			const { id } = await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setTitle(`What rank should ${userData.quid.name} have?`)
					.setFooter({ text: 'Available options: \n\nHealer (recommended for herbivores)\nHunter (recommended for carnivores)' })],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([
						new ButtonBuilder()
							.setCustomId(`rank-up_Healer_@${userData._id}`)
							.setLabel('Healer')
							.setEmoji('🛡️')
							.setStyle(ButtonStyle.Success),
						new ButtonBuilder()
							.setCustomId(`rank-up_Hunter_@${userData._id}`)
							.setLabel('Hunter')
							.setEmoji('⚔️')
							.setStyle(ButtonStyle.Success),
					]),
				],
			});

			saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, id, interaction);

			return;
		}
		else if (userData.quid.profile.unlockedRanks === 3 && (userData.quid.profile.rank === RankType.Healer || userData.quid.profile.rank === RankType.Hunter)) {

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.rank = RankType.Elderly;
				},
			);

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`"We are here to celebrate the nomination of ${userData.quid.name} to the highest rank, Elderly. The ${userData.quid.getDisplayspecies()} has shown incredible skills and persistence, and we congratulate ${userData.quid.pronoun(1)} to ${userData.quid.pronoun(2)} new title." *A mixture of howls, crows, meows, roars and squeaks are heard all around the hill, on which the Alpha stoof to announce this special event. It is not every day that a packmate gets the title of Elderly.*`)],
			});

			await checkRankRequirements(serverData, interaction, interaction.member, RankType.Elderly, true);

			return;
		}
		else if (userData.quid.profile.rank === RankType.Elderly) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} is very wise from all the adventures ${userData.quid.pronoun(0)} had, but also a little... quaint. The ${userData.quid.getDisplayspecies()} seems to have forgotten that as Elderly, ${userData.quid.pronounAndPlural(0, 'has', 'have')} already achieved the highest possible rank.*`)],
			});
			return;
		}

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} looks at the Elderly with puppy eyes, trying to convince them.*\n"I'm sorry, little ${userData.quid.getDisplayspecies()}, you haven't proven yourself worthy of moving up a rank yet. Try again once you were able to put your strength, agility and decision-making to the test!" *the Elderly says.*`)
				.setFooter({ text: `Go ${userData.quid.profile.rank === 'Youngling' ? 'playing' : 'exploring'} until you find a quest! Once you have completed the quest, you can move up a rank.` })],
		});
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!interaction.isButton()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		const rank = getArrayElement(interaction.customId.split('_'), 1);
		if (rank !== RankType.Hunter && rank !== RankType.Healer) { throw new Error('rank is not of RankType Hunter or Healer'); }

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
				p.rank = rank;
			},
		);

		// This is always an update to the message with the button
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${userData.quid.name}, you are now a fully-fledged ${rank}. I am certain you will contribute greatly to the pack in this role."\n*The ${userData.quid.getDisplayspecies()} grins from ear to ear.*`)],
			components: [],
		}, 'update', '@original');

		await checkRankRequirements(serverData, interaction, interaction.member, rank, true);
		return;

	},
};