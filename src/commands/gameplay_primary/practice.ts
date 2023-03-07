import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, AnySelectMenuInteraction, SlashCommandBuilder, Message, InteractionResponse, GuildMember } from 'discord.js';
import { Op } from 'sequelize';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { createFightGame } from '../../utils/gameBuilder';
import { getDisplayname, pronoun, pronounAndPlural, getDisplayspecies } from '../../utils/getQuidInfo';
import { respond, setCooldown } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from './attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('practice')
		.setDescription('Practice fighting in a safe environment. Not available to Younglings.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (quidToServer.rank === RankType.Youngling) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*The Elderly shakes their head as they see ${quid.name} approaching.*\n"At your age, you shouldn't prepare for fights. Go play with your friends instead!"`)],
			});
			return;
		}

		const components = [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([
				new ButtonBuilder()
					.setCustomId('practice_accept')
					.setLabel('Accept')
					.setEmoji('⚔️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('practice_decline')
					.setLabel('Decline')
					.setEmoji('💨')
					.setStyle(ButtonStyle.Secondary),
			]),
		];

		// This is always a reply
		let botReply: Message | InteractionResponse = await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*A very experienced Elderly approaches ${quid.name}.* "I've seen that you have not performed well in fights lately. Do you want to practice with me for a bit to strengthen your skills?"`)
				.setFooter({ text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response. The footer will provide hints as to which button you should click. This is a memory game, so try to remember which button to click in which situation.' })],
			components: components,
			fetchReply: true,
		});

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);

		const int = await botReply
			.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id,
				time: 300_000,
			})
			.then(async i => {

				return i;
			})
			.catch(() => { return undefined; });

		if (int === undefined || int.customId === 'practice-decline') {

			// This is an edit to the reply if there is no int, or an update
			botReply = await respond(int ?? interaction, {
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*After a bit of thinking, ${quid.name} decides that now is not a good time to practice ${pronoun(quid, 2)} fighting skills. Politely, ${pronounAndPlural(quid, 0, 'decline')} the Elderlies offer.*`)],
				components: disableAllComponents(components),
			}, int !== undefined ? 'update' : 'reply', int?.message.id);
			return;
		}

		await setCooldown(userToServer, true);
		deleteCommandDisablingInfo(userToServer);

		const experiencePoints = getRandomNumber(5, 1);
		const changedCondition = await changeCondition(quidToServer, quid, experiencePoints);

		const embed = new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			});

		let totalCycles: 0 | 1 | 2 = 0;
		let winLoseRatio = 0;

		await interactionCollector(interaction, user, userToServer, quid, quidToServer, int, restEmbed);

		async function interactionCollector(
			interaction: ChatInputCommandInteraction<'cached'>,
			user: User,
			userToServer: UserToServer,
			quid: Quid,
			quidToServer: QuidToServer,
			newInteraction: ButtonInteraction | AnySelectMenuInteraction,
			restEmbed: EmbedBuilder[],
			previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
			lastRoundCycleIndex?: number,
		): Promise<void> {

			const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

			if (fightGame.cycleKind === '_attack') {

				embed.setDescription(`⏫ *The Elderly gets ready to attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like the Elderly is preparing a maneuver for ${quid.name}'s next move. The ${getDisplayspecies(quid)} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *The Elderly gets into position to oppose an attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new Error('cycleKind is not attack, dodge or defend'); }

			// This is always an update to the interaction
			botReply = await respond(newInteraction, {
				embeds: [...restEmbed, embed],
				components: [...previousFightComponents ? [previousFightComponents] : [], fightGame.fightComponent],
			}, 'update', newInteraction.message.id);

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			fightGame.fightComponent = fightGame.correctButtonOverwrite();

			newInteraction = await botReply
				.awaitMessageComponent({
					componentType: ComponentType.Button,
					filter: i => i.user.id === interaction.user.id,
					time: quidToServer.rank === RankType.Elderly ? 6_000 : quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer ? 8_000 : 10_000,
				})
				.then(async i => {

					/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
					fightGame.fightComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

					if ((i.customId.includes('_attack') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('defend') && fightGame.cycleKind === '_attack')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'defend')) {

						winLoseRatio -= 1;
					}
					else if ((i.customId.includes('_attack') && fightGame.cycleKind === 'defend')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === '_attack')) {

						/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
						fightGame.fightComponent = fightGame.chosenRightButtonOverwrite(i.customId);

						winLoseRatio += 1;
					}
					return i;
				})
				.catch(() => {

					winLoseRatio -= 1;
					return newInteraction;
				});

			fightGame.fightComponent.setComponents(fightGame.fightComponent.components.map(c => c.setDisabled(true)));

			totalCycles += 1;

			if (totalCycles < 3) {

				await interactionCollector(interaction, user, userToServer, quid, quidToServer, newInteraction, restEmbed, fightGame.fightComponent, fightGame.thisRoundCycleIndex);
				return;
			}

			await setCooldown(userToServer, false);

			if (winLoseRatio > 0) {

				embed.setDescription(`*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${quid.name}. There's nothing I can teach you at this point!"`);
			}
			else if (winLoseRatio < 0) {

				embed.setDescription(`*With a worried look, the Elderly gives ${quid.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`);
			}
			else if (winLoseRatio === 0) {

				embed.setDescription(`*The two packmates fight for a while, before ${quid.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`);
			}
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

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

			const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

			// This is always an update
			await respond(newInteraction, {
				embeds: [
					...restEmbed,
					embed,
					...changedCondition.injuryUpdateEmbed,
					...levelUpEmbed,
				],
				components: [fightGame.fightComponent],
			}, 'update', newInteraction.message.id);

			await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

			await coloredButtonsAdvice(interaction, user);
			await restAdvice(interaction, user, quidToServer);
			await drinkAdvice(interaction, user, quidToServer);
			await eatAdvice(interaction, user, quidToServer);

			return;
		}
	},
};