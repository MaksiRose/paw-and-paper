import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { ServerSchema } from '../../typings/data/server';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { createFightGame } from '../../utils/gameBuilder';
import { respond, setCooldown, update } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData, serverData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (userData.quid.profile.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*The Elderly shakes their head as they see ${userData.quid.name} approaching.*\n"At your age, you shouldn't prepare for fights. Go play with your friends instead!"`)],
			}, true);
			return;
		}

		let botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*A very experienced Elderly approaches ${userData.quid.name}.* "I've seen that you have not performed well in fights lately. Do you want to practice with me for a bit to strengthen your skills?"`)
				.setFooter({ text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response. The footer will provide hints as to which button you should click. This is a memory game, so try to remember which button to click in which situation.' })],
			components: [new ActionRowBuilder<ButtonBuilder>()
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
			],
		}, true);

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);

		const int = await botReply
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				time: 300_000,
			})
			.then(async i => {

				await i.deferUpdate();
				if (i.customId === 'practice-decline') { return undefined; }
				return i;
			})
			.catch(() => { return undefined; });

		if (int === undefined) {

			botReply = await respond(interaction, {
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*After a bit of thinking, ${userData.quid.name} decides that now is not a good time to practice ${userData.quid.pronoun(2)} fighting skills. Politely, ${userData.quid.pronounAndPlural(0, 'decline')} the Elderlies offer.*`)],
				components: disableAllComponents(botReply.components),
			}, true);
			return;
		}

		setCooldown(userData, interaction.guildId, true);
		deleteCommandDisablingInfo(userData, interaction.guildId);

		const experiencePoints = getRandomNumber(5, 1);
		const changedCondition = await changeCondition(userData, experiencePoints);

		const embed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL });

		let totalCycles: 0 | 1 | 2 = 0;
		let winLoseRatio = 0;

		await interactionCollector(interaction, userData, serverData, int, restEmbed);

		async function interactionCollector(
			interaction: ChatInputCommandInteraction<'cached'>,
			userData: UserData<never, never>,
			serverData: ServerSchema,
			newInteraction: ButtonInteraction | SelectMenuInteraction,
			restEmbed: EmbedBuilder[],
			previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
			lastRoundCycleIndex?: number,
		): Promise<void> {

			const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

			if (fightGame.cycleKind === '_attack') {

				embed.setDescription(`⏫ *The Elderly gets ready to attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like the Elderly is preparing a maneuver for ${userData.quid.name}'s next move. The ${userData.quid.getDisplayspecies()} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *The Elderly gets into position to oppose an attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new Error('cycleKind is not attack, dodge or defend'); }

			botReply = await update(newInteraction, {
				embeds: [...restEmbed, embed],
				components: [...previousFightComponents ? [previousFightComponents] : [], fightGame.fightComponent],
			});

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			fightGame.fightComponent = fightGame.correctButtonOverwrite();

			newInteraction = await botReply
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					time: userData.quid.profile.rank === RankType.Elderly ? 6_000 : userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer ? 8_000 : 10_000,
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

				await interactionCollector(interaction, userData, serverData, newInteraction, restEmbed, fightGame.fightComponent, fightGame.thisRoundCycleIndex);
				return;
			}

			setCooldown(userData, interaction.guildId, false);

			if (winLoseRatio > 0) {

				embed.setDescription(`*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${userData.quid.name}. There's nothing I can teach you at this point!"`);
			}
			else if (winLoseRatio < 0) {

				embed.setDescription(`*With a worried look, the Elderly gives ${userData.quid.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`);
			}
			else if (winLoseRatio === 0) {

				embed.setDescription(`*The two packmates fight for a while, before ${userData.quid.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`);
			}
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

			const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

			botReply = await update(newInteraction, {
				embeds: [
					...restEmbed,
					embed,
					...changedCondition.injuryUpdateEmbed,
					...levelUpEmbed,
				],
				components: [fightGame.fightComponent],
			});

			await isPassedOut(interaction, userData, true);

			await coloredButtonsAdvice(interaction, userData);
			await restAdvice(interaction, userData);
			await drinkAdvice(interaction, userData);
			await eatAdvice(interaction, userData);

			return;
		}
	},
};