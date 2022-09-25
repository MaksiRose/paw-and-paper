import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import { RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { createFightGame } from '../../utils/gameBuilder';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from './attack';

const newCycleArray = ['attack', 'dodge', 'defend'] as const;

const name: SlashCommand['name'] = 'practice';
const description: SlashCommand['description'] = 'Practice fighting wild animals. You cannot get hurt here.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		let profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*The Elderly shakes their head as they see ${quidData.name} approaching.*\n"At your age, you shouldn't prepare for fights. Go play with your friends instead!"`)],
			}, true);
			return;
		}

		let botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*A very experienced Elderly approaches ${quidData.name}.* "I've seen that you have not performed well in fights lately. Do you want to practice with me for a bit to strengthen your skills?"`)
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

		createCommandComponentDisabler(userData._id, interaction.guildId, botReply);

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
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*After a bit of thinking, ${quidData.name} decides that now is not a good time to practice ${pronoun(quidData, 2)} fighting skills. Politely, ${pronounAndPlural(quidData, 0, 'decline')} the Elderlies offer.*`)],
				components: disableAllComponents(botReply.components),
			}, true);
			return;
		}

		cooldownMap.set(userData._id + interaction.guildId, true);
		delete disableCommandComponent[userData._id + interaction.guildId];

		const experiencePoints = getRandomNumber(5, 1);
		const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
		profileData = changedCondition.profileData;

		const embed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL });

		let totalCycles: 0 | 1 | 2 = 0;
		let winLoseRatio = 0;

		await interactionCollector(interaction, userData, serverData, int);

		async function interactionCollector(
			interaction: ChatInputCommandInteraction<'cached'>,
			userData: UserSchema,
			serverData: ServerSchema,
			newInteraction: ButtonInteraction | SelectMenuInteraction,
			previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
			lastRoundCycleIndex?: number,
		): Promise<void> {

			const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

			if (fightGame.cycleKind === 'attack') {

				embed.setDescription(`⏫ *The Elderly gets ready to attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like the Elderly is preparing a maneuver for ${quidData.name}'s next move. The ${quidData.displayedSpecies || quidData.species} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *The Elderly gets into position to oppose an attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new Error('cycleKind is not attack, dodge or defend'); }

			botReply = await update(newInteraction, {
				embeds: [...embedArray, embed],
				components: [...previousFightComponents ? [previousFightComponents] : [], fightGame.fightComponent],
			});

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			fightGame.fightComponent = fightGame.correctButtonOverwrite();

			newInteraction = await botReply
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					time: profileData.rank === RankType.Elderly ? 6_000 : profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer ? 8_000 : 10_000,
				})
				.then(async i => {

					/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
					fightGame.fightComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

					if ((i.customId.includes('attack') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'attack')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'defend')) {

						winLoseRatio -= 1;
					}
					else if ((i.customId.includes('attack') && fightGame.cycleKind === 'defend')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'attack')) {

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

				await interactionCollector(interaction, userData, serverData, newInteraction, fightGame.fightComponent, newCycleArray.findIndex(el => el === fightGame.cycleKind));
				return;
			}

			cooldownMap.set(userData!._id + interaction.guildId, false);

			if (winLoseRatio > 0) {

				embed.setDescription(`*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${quidData.name}. There's nothing I can teach you at this point!"`);
			}
			else if (winLoseRatio < 0) {

				embed.setDescription(`*With a worried look, the Elderly gives ${quidData.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`);
			}
			else if (winLoseRatio === 0) {

				embed.setDescription(`*The two packmates fight for a while, before ${quidData.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`);
			}
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

			const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

			botReply = await update(newInteraction, {
				embeds: [
					...embedArray,
					embed,
					...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
					...(levelUpEmbed ? [levelUpEmbed] : []),
				],
				components: [fightGame.fightComponent],
			});

			await isPassedOut(interaction, userData, quidData, profileData, true);

			await coloredButtonsAdvice(interaction, userData);
			await restAdvice(interaction, userData, profileData);
			await drinkAdvice(interaction, userData, profileData);
			await eatAdvice(interaction, userData, profileData);

			return;
		}
	},
};