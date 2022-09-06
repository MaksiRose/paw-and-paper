import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import { RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { generateRandomNumber, generateRandomNumberWithException } from '../../utils/randomizers';
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
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (!serverData) { throw new Error('serverData is null'); }
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
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*The Elderly shakes their head as they see ${quidData.name} approaching.*\n"At your age, you shouldn't prepare for fights. Go play with your friends instead!"`)],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		let botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
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
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);

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
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*After a bit of thinking, ${quidData.name} decides that now is not a good time to practice ${pronoun(quidData, 2)} fighting skills. Politely, ${pronounAndPlural(quidData, 0, 'decline')} the Elderlies offer.*`)],
				components: disableAllComponents(botReply.components.map(component => component.toJSON())),
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
			return;
		}

		cooldownMap.set(userData.uuid + interaction.guildId, true);
		delete disableCommandComponent[userData.uuid + interaction.guildId];

		const experiencePoints = generateRandomNumber(5, 1);
		const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
		profileData = changedCondition.profileData;

		const embed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

		let totalCycles: 0 | 1 | 2 = 0;
		let winLoseRatio = 0;

		await interactionCollector(interaction, userData, serverData, int);

		async function interactionCollector(
			interaction: ChatInputCommandInteraction<'cached'>,
			userData: UserSchema,
			serverData: ServerSchema,
			newInteraction: ButtonInteraction | SelectMenuInteraction,
			previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
			previousCycleIndex?: number,
		): Promise<void> {

			const cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, previousCycleIndex)];

			if (cycleKind === 'attack') {

				embed.setDescription(`⏫ *The Elderly gets ready to attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Tip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like the Elderly is preparing a maneuver for ${quidData.name}'s next move. The ${quidData.displayedSpecies || quidData.species} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Tip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (cycleKind === 'defend') {

				embed.setDescription(`⏺️ *The Elderly gets into position to oppose an attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Tip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new Error('cycleKind is not attack, dodge or defend'); }

			const fightComponents = getFightComponents(totalCycles);

			botReply = await update(newInteraction, {
				embeds: [...embedArray, embed],
				components: [...previousFightComponents ? [previousFightComponents] : [], fightComponents],
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			fightComponents.setComponents(fightComponents.components.map(component => {

				const data = component.toJSON();

				if (data.style !== ButtonStyle.Link && data.custom_id.includes(cycleKind)) { component.setStyle(ButtonStyle.Primary); }
				return component;
			}));

			newInteraction = await botReply
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					time: profileData.rank === RankType.Elderly ? 6_000 : profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer ? 8_000 : 10_000,
				})
				.then(async i => {

					/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
					fightComponents.setComponents(fightComponents.components.map(component => {

						const data = component.toJSON();

						if (data.style !== ButtonStyle.Link && data.custom_id) { component.setStyle(ButtonStyle.Danger); }
						return component;
					}));

					if ((i.customId.includes('attack') && cycleKind === 'dodge')
						|| (i.customId.includes('defend') && cycleKind === 'attack')
						|| (i.customId.includes('dodge') && cycleKind === 'defend')) {

						winLoseRatio -= 1;
					}
					else if ((i.customId.includes('attack') && cycleKind === 'defend')
						|| (i.customId.includes('defend') && cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && cycleKind === 'attack')) {

						/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
						fightComponents.setComponents(fightComponents.components.map(component => {

							const data = component.toJSON();

							if (data.style !== ButtonStyle.Link && data.custom_id) { component.setStyle(ButtonStyle.Success); }
							return component;
						}));

						winLoseRatio += 1;
					}
					return i;
				})
				.catch(() => {

					winLoseRatio -= 1;
					return newInteraction;
				});

			fightComponents.setComponents(fightComponents.components.map(component => component.setDisabled(true)));

			totalCycles += 1;

			if (totalCycles < 3) {

				await interactionCollector(interaction, userData, serverData, newInteraction, fightComponents, newCycleArray.findIndex(el => el === cycleKind));
				return;
			}

			cooldownMap.set(userData!.uuid + interaction.guildId, false);

			if (winLoseRatio > 0) {

				embed.setDescription(`*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${quidData.name}. There's nothing I can teach you at this point!"`);
			}
			else if (winLoseRatio < 0) {

				embed.setDescription(`*With a worried look, the Elderly gives ${quidData.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`);
			}
			else if (winLoseRatio === 0) {

				embed.setDescription(`*The two packmates fight for a while, before ${quidData.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`);
			}
			embed.setFooter({ text: changedCondition.statsUpdateText });

			const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

			botReply = await update(newInteraction, {
				embeds: [
					...embedArray,
					embed,
					...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
					...(levelUpEmbed ? [levelUpEmbed] : []),
				],
				components: [fightComponents],
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			await isPassedOut(interaction, userData, quidData, profileData, true);

			await restAdvice(interaction, userData, profileData);
			await drinkAdvice(interaction, userData, profileData);
			await eatAdvice(interaction, userData, profileData);

			return;
		}
	},
};

function getFightComponents(
	roundNumber: 0 | 1 | 2,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([
			new ButtonBuilder()
				.setCustomId(`practice_attack_${roundNumber}`)
				.setLabel('Attack')
				.setEmoji('⏫')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`practice_defend_${roundNumber}`)
				.setLabel('Defend')
				.setEmoji('⏺️')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`practice_dodge_${roundNumber}`)
				.setLabel('Dodge')
				.setEmoji('↪️')
				.setStyle(ButtonStyle.Secondary),
		].sort(() => Math.random() - 0.5));
}