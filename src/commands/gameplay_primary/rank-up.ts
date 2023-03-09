import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { checkRankRequirements } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { getArrayElement, respond } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (quidToServer.unlockedRanks === 1 && quidToServer.rank === RankType.Youngling) {

			await quidToServer.update({ rank: RankType.Apprentice });

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*An elderly smiles down at the young ${quidToServer.rank}.*\n"${quid.name}, you have proven strength for the first time. I believe you are ready to explore the wild, and learn your strengths and weaknesses. Good luck in your rank as Apprentice" *they say. ${quid.name}'s chest swells with pride.*`)],
			});

			const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
			const discordUserToServer = await DiscordUserToServer.findAll({
				where: {
					serverId: interaction.guildId,
					isMember: true,
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
				},
			});

			const members = (await Promise.all(discordUserToServer
				.map(async (duts) => (await interaction.guild.members.fetch(duts.discordUserId).catch(() => {
					duts.update({ isMember: false });
					return null;
				}))))).filter(function(v): v is GuildMember { return v !== null; });

			await checkRankRequirements(interaction, members, quidToServer, true);

			return;
		}
		else if (quidToServer.unlockedRanks === 2 && quidToServer.rank === RankType.Apprentice) {

			// This is always a reply
			const { id } = await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`What rank should ${quid.name} have?`)
					.setFooter({ text: 'Available options: \n\nHealer (recommended for herbivores)\nHunter (recommended for carnivores)' })],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([
						new ButtonBuilder()
							.setCustomId(`rank-up_Healer_@${user.id}`)
							.setLabel('Healer')
							.setEmoji('🛡️')
							.setStyle(ButtonStyle.Success),
						new ButtonBuilder()
							.setCustomId(`rank-up_Hunter_@${user.id}`)
							.setLabel('Hunter')
							.setEmoji('⚔️')
							.setStyle(ButtonStyle.Success),
					]),
				],
			});

			saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, id);

			return;
		}
		else if (quidToServer.unlockedRanks === 3 && (quidToServer.rank === RankType.Healer || quidToServer.rank === RankType.Hunter)) {

			await quidToServer.update({ rank: RankType.Elderly });

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`"We are here to celebrate the nomination of ${quid.name} to the highest rank, Elderly. The ${getDisplayspecies(quid)} has shown incredible skills and persistence, and we congratulate ${pronoun(quid, 1)} to ${pronoun(quid, 2)} new title." *A mixture of howls, crows, meows, roars and squeaks are heard all around the hill, on which the Alpha stoof to announce this special event. It is not every day that a packmate gets the title of Elderly.*`)],
			});

			const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
			const discordUserToServer = await DiscordUserToServer.findAll({
				where: {
					serverId: interaction.guildId,
					isMember: true,
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
				},
			});

			const members = (await Promise.all(discordUserToServer
				.map(async (duts) => (await interaction.guild.members.fetch(duts.discordUserId).catch(() => {
					duts.update({ isMember: false });
					return null;
				}))))).filter(function(v): v is GuildMember { return v !== null; });

			await checkRankRequirements(interaction, members, quidToServer, true);

			return;
		}
		else if (quidToServer.rank === RankType.Elderly) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} is very wise from all the adventures ${pronoun(quid, 0)} had, but also a little... quaint. The ${getDisplayspecies(quid)} seems to have forgotten that as Elderly, ${pronounAndPlural(quid, 0, 'has', 'have')} already achieved the highest possible rank.*`)],
			});
			return;
		}

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} looks at the Elderly with puppy eyes, trying to convince them.*\n"I'm sorry, little ${getDisplayspecies(quid)}, you haven't proven yourself worthy of moving up a rank yet. Try again once you were able to put your strength, agility and decision-making to the test!" *the Elderly says.*`)
				.setFooter({ text: `Go ${quidToServer.rank === 'Youngling' ? 'playing' : 'exploring'} until you find a quest! Once you have completed the quest, you can move up a rank.` })],
		});
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		if (!interaction.isButton()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		const rank = getArrayElement(interaction.customId.split('_'), 1);
		if (rank !== RankType.Hunter && rank !== RankType.Healer) { throw new Error('rank is not of RankType Hunter or Healer'); }

		await quidToServer.update({ rank: rank });

		// This is always an update to the message with the button
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${quid.name}, you are now a fully-fledged ${rank}. I am certain you will contribute greatly to the pack in this role."\n*The ${getDisplayspecies(quid)} grins from ear to ear.*`)],
			components: [],
		}, 'update', interaction.message.id);

		const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
		const discordUserToServer = await DiscordUserToServer.findAll({
			where: {
				serverId: interaction.guildId,
				isMember: true,
				discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
			},
		});

		const members = (await Promise.all(discordUserToServer
			.map(async (duts) => (await interaction.guild.members.fetch(duts.discordUserId).catch(() => {
				duts.update({ isMember: false });
				return null;
			}))))).filter(function(v): v is GuildMember { return v !== null; });

		await checkRankRequirements(interaction, members, quidToServer, true);
		return;
	},
};