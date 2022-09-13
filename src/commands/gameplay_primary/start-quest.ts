import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { Profile, Quid, RankType, ServerSchema, SlashCommand, SpeciesHabitatType, speciesInfo, SpeciesNames, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural, upperCasePronoun, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, respond, update } from '../../utils/helperFunctions';
import { getRandomNumber, generateWinChance } from '../../utils/randomizers';
import { remindOfAttack } from './attack';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'start-quest';
const description: SlashCommand['description'] = 'Get quests by playing (as Youngling) or exploring. Start them with this command.';
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
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (!profileData.hasQuest) {

			await respond(interaction, {
				content: messageContent,
				embeds: [
					...embedArray,
					new EmbedBuilder()
						.setColor(error_color)
						.setTitle('You have no open quests at the moment :(')
						.setFooter({ text: `Go ${profileData.rank === RankType.Youngling ? 'playing' : 'exploring'} to get a quest!` }),
				],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		await sendQuestMessage(interaction, userData, quidData, profileData, serverData, messageContent, embedArray);
	},
};

export async function sendQuestMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[] = [],
	footerText = '',
) {

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

	if (profileData.rank === RankType.Youngling) {

		embed.setDescription(`*${quidData.name} lifts ${pronoun(quidData, 2)} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${pronounAndPlural(quidData, 0, 'dash')} from where ${pronounAndPlural(quidData, 0, 'is standing and bolts', 'are standing and bolt')} for the sound. Soon ${quidData.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${pronoun(quidData, 2)} brain. ${upperCasePronoun(quidData, 0)} must help them...*`);
	}
	else if (profileData.rank === RankType.Apprentice) {

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} wanders through the peaceful shrubbery, carefully surveying the undergrowth around ${pronoun(quidData, 1)}. To ${pronoun(quidData, 2)} left are thick bushes at the base of a lone tree. Suddenly, ${quidData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quidData, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quidData, 0)} must show all ${pronoun(quidData, 2)} strength and pull out ${pronoun(quidData, 2)} friend.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} wanders through the peaceful forest, carefully surveying the undergrowth around ${pronoun(quidData, 1)}. To ${pronoun(quidData, 2)} left is a long, thick tree trunk overgrown with sodden moss. Suddenly, ${quidData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quidData, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quidData, 0)} must show all ${pronoun(quidData, 2)} strength and pull out ${pronoun(quidData, 2)} friend.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} swims through the peaceful river, carefully surveying the algae around ${pronoun(quidData, 1)}. In front of ${pronoun(quidData, 2)} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly, ${quidData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quidData, 0, 'swim')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quidData, 0)} must show all ${pronoun(quidData, 2)} strength and pull out ${pronoun(quidData, 2)} friend.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (profileData.rank === RankType.Healer || profileData.rank === RankType.Hunter) {

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${quidData.name} meanders over the sand, looking for food for ${pronoun(quidData, 2)} pack. But suddenly the ${quidData.displayedSpecies || quidData.species} hears a motor. Frightened, ${pronounAndPlural(quidData, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(quidData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(quidData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quidData, 0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${quidData.name} meanders between the trees, looking for food for ${pronoun(quidData, 2)} pack. But suddenly the ${quidData.displayedSpecies || quidData.species} hears a motor. Frightened, ${pronounAndPlural(quidData, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(quidData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(quidData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quidData, 0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${quidData.name} floats through the water, looking for food for ${pronoun(quidData, 2)} pack. But suddenly the ${quidData.displayedSpecies || quidData.species} hears a motor. Frightened, ${pronounAndPlural(quidData, 0, 'look')} to the surface: indeed, a motorboat is in front of ${pronoun(quidData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(quidData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quidData, 0, 'get')} to the rescue, the better.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (profileData.rank === RankType.Elderly) {

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*Something is off, the ${quidData.displayedSpecies || quidData.species} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quidData, 0)} were all alone. ${quidData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quidData, 1)}. A glance over ${pronoun(quidData, 2)} shoulder confirms ${pronoun(quidData, 2)} fear, a big sandstorm is approaching. ${quidData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quidData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quidData, 2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*Something is off, the ${quidData.displayedSpecies || quidData.species} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quidData, 0)} were all alone. ${quidData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quidData, 1)}. A glance over ${pronoun(quidData, 2)} shoulder confirms ${pronoun(quidData, 2)} fear, a big snowstorm is approaching. ${quidData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quidData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quidData, 2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*Something is off, the ${quidData.displayedSpecies || quidData.species} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quidData, 0)} were all alone. ${quidData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quidData, 1)}. A glance over ${pronoun(quidData, 2)} shoulder confirms ${pronoun(quidData, 2)} fear, a big landslide is approaching. ${quidData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quidData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quidData, 2)} friends may never find their way back.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else { throw new Error('No rank was found for this profile'); }

	embed.setFooter({ text: `${footerText}\n\nClick the button or type "/quest" to continue. *Level ${profileData.rank == 'Elderly' ? '35' : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? '20' : profileData.rank == 'Apprentice' ? '10' : '2'} is recommended for this!*\n\nTip: Read the bottom text during the game carefully to find out which button to click. The button you chose will get a "radio button"-emoji, and the correct button will get a checkmark emoji. Sometimes you will lose a round even if you chose right, depending on how many levels you have, then there will be no checkmark emoji.` });

	const botReply = await respond(interaction, {
		content: `<@${interaction.user.id}>` + (messageContent ?? ''),
		embeds: [...embedArray, embed, ...afterEmbedArray],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents(new ButtonBuilder()
				.setCustomId('quest_start')
				.setLabel('Start quest')
				.setEmoji('⭐')
				.setStyle(ButtonStyle.Success))],
	}, true)
		.catch((error) => { throw new Error(error); });

	createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);

	await (botReply as Message<true>)
		.awaitMessageComponent({
			filter: (i) => i.user.id === interaction.user.id,
			componentType: ComponentType.Button,
			time: 300_000 })
		.then(async (int) => {

			cooldownMap.set(userData.uuid + interaction.guildId, true);
			delete disableCommandComponent[userData.uuid + interaction.guildId];
			await startQuest(int, userData, quidData, profileData, serverData, messageContent, embedArray, afterEmbedArray, botReply);
		})
		.catch(async () => {

			await respond(interaction, { components: disableAllComponents(botReply.components) }, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
			return;
		});
	return;
}

async function startQuest(
	interaction: ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[],
	botReply: Message,
) {
	// this would be called from /quest, /explore and /play
	// Quest would send in the main interaction so that it would edit it, while for explore and play it would send in the button interaction so it would respond to the button click, which also has the side effect that the stats you lost etc would already be displayed under the original "you found a quest" message.

	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData.uuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.hasQuest = false;
		},
	);

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

	let hitEmoji = '';
	let missEmoji = '';
	let hitValue = 1;
	let missValue = 1;

	if (profileData.rank === RankType.Youngling) {

		hitEmoji = '🪨';
		missEmoji = '⚡';
	}
	else if (profileData.rank === RankType.Apprentice) {

		hitEmoji = '🪵';
		missEmoji = '⚡';
	}
	else if (profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer) {

		hitEmoji = '💨';
		missEmoji = '💂';
	}
	else if (profileData.rank === RankType.Elderly) {

		hitEmoji = '💨';

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) { missEmoji = '🏜️'; }
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) { missEmoji = '🌨️'; }
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) { missEmoji = '⛰️'; }
		else { throw new Error('No species habitat type found'); }
	}
	else { throw new Error('No rank type found'); }

	await interactionCollector(interaction, userData, serverData, 0);

	async function interactionCollector(
		interaction: ButtonInteraction<'cached'>,
		userData: UserSchema,
		serverData: ServerSchema,
		cycleIndex: number,
		previousQuestComponents?: ActionRowBuilder<ButtonBuilder>,
	): Promise<void> {

		const buttonTextOrColor = getRandomNumber(2) === 0 ? 'color' : 'text';
		const buttonColorKind = getRandomNumber(3) === 0 ? 'green' : getRandomNumber(2) === 0 ? 'blue' : 'red';

		let questComponents = new ActionRowBuilder<ButtonBuilder>()
			.setComponents([
				[new ButtonBuilder()
					.setLabel('Blue')
					.setCustomId(`quest_bluetext_redcolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setLabel('Red')
					.setCustomId(`quest_redtext_bluecolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setLabel('Green')
					.setCustomId(`quest_greentext_greencolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Success)],
				[new ButtonBuilder()
					.setLabel('Green')
					.setCustomId(`quest_greentext_redcolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setLabel('Blue')
					.setCustomId(`quest_bluetext_bluecolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setLabel('Red')
					.setCustomId(`quest_redtext_greencolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Success)],
				[new ButtonBuilder()
					.setLabel('Red')
					.setCustomId(`quest_redtext_redcolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setLabel('Green')
					.setCustomId(`quest_greentext_bluecolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setLabel('Blue')
					.setCustomId(`quest_bluetext_greencolor_${cycleIndex}`)
					.setStyle(ButtonStyle.Success)],
			][getRandomNumber(3)]!.sort(() => Math.random() - 0.5));

		embed.setDescription(`${drawProgressbar(hitValue, hitEmoji)}\n${drawProgressbar(missValue, missEmoji)}`);
		embed.setFooter({ text: `Click the ${(buttonTextOrColor === 'color' ? `${buttonColorKind} button` : `button labeled as ${buttonColorKind}`)}.` });

		botReply = await update(interaction, {
			content: messageContent,
			embeds: [...embedArray, embed, ...afterEmbedArray],
			components: [...previousQuestComponents ? [previousQuestComponents] : [], questComponents],
		})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});

		const { customId } = await botReply
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				time: 5_000,
			})
			.catch(() => { return { customId: '' }; });

		const winChance = generateWinChance(profileData.levels, profileData.rank === RankType.Elderly ? 35 : (profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer) ? 20 : profileData.rank === RankType.Apprentice ? 10 : 2);
		const randomNumber = getRandomNumber(100);

		if (customId !== '') {

			/* The button the user chose will get the "radio button"-emoji. */
			questComponents.setComponents(questComponents.components.map(component => {

				const data = component.toJSON();

				if (data.style !== ButtonStyle.Link && data.custom_id === customId) { component.setEmoji('🔘'); }
				return component;
			}));

			if (randomNumber <= winChance) {

				/* The correct button will get the "checkbox"-emoji. */
				questComponents.setComponents(questComponents.components.map(component => {

					const data = component.toJSON();

					if (data.style !== ButtonStyle.Link && data.custom_id.includes(`${buttonColorKind}${buttonTextOrColor}`)) { component.setEmoji('☑️'); }
					return component;
				}));
			}
		}

		if (customId === '' || !customId.includes(`${buttonColorKind}${buttonTextOrColor}`) || randomNumber > winChance) { missValue += 1; }
		else { hitValue += 1; }

		questComponents = questComponents.setComponents(questComponents.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link) { component.setDisabled(true); }
			return component;
		}));

		embed.setFooter(null);
		if (hitValue >= 10) {

			cooldownMap.set(userData!.uuid + interaction.guildId, false);

			if (profileData.unlockedRanks < 3) {

				userData = await userModel.findOneAndUpdate(
					u => u.uuid === userData.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.unlockedRanks += 1;
					},
				);
			}

			if (profileData.rank === RankType.Youngling) {

				embed.setDescription(`*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${quidData.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${quidData.displayedSpecies || quidData.species} runs out of the cave, jumping around ${quidData.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`);
			}
			else if (profileData.rank === RankType.Apprentice) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem, ${quidData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*After fighting with the root for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${quidData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${quidData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm || speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${quidData.displayedSpecies || quidData.species} runs to the pack, the other ${profileData.rank} in ${pronoun(quidData, 2)} mouth. An Elderly is already coming towards ${pronoun(quidData, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${quidData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${quidData.displayedSpecies || quidData.species} swims to the pack, the other ${profileData.rank} in ${pronoun(quidData, 2)} mouth. An Elderly is already swimming towards ${pronoun(quidData, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${quidData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (profileData.rank === RankType.Elderly) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm || speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} runs for a while before the situation seems to clear up. ${quidData.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(quidData, 0, 'goes', 'go')} back to the pack, another pack member in ${pronoun(quidData, 2)} mouth. ${upperCasePronounAndPlural(quidData, 0, 'feel')} strangely stronger than before.*`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} runs for a while before the situation seems to clear up. ${quidData.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(quidData, 0, 'swim')} back to the pack, another pack member in ${pronoun(quidData, 2)} mouth. ${upperCasePronounAndPlural(quidData, 0, 'feel')} strangely stronger than before.*`);
				}
				else { throw new Error('No species habitat type found'); }

				let maxHealthPoints = 0;
				let maxEnergyPoints = 0;
				let maxHungerPoints = 0;
				let maxThirstPoints = 0;

				switch (Math.floor(Math.random() * 4)) {
					case 0:

						maxHealthPoints = 10;
						embed.setFooter({ text: '+10 maximum health\n\n' });
						break;

					case 1:

						maxEnergyPoints = 10;
						embed.setFooter({ text: '+10 maximum energy\n\n' });
						break;

					case 2:
						maxHungerPoints = 10;
						embed.setFooter({ text: '+10 maximum hunger\n\n' });
						break;

					default:

						maxThirstPoints = 10;
						embed.setFooter({ text: '+10 maximum thirst\n\n' });
						break;
				}

				userData = await userModel.findOneAndUpdate(
					u => u.uuid === userData.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.maxHealth += maxHealthPoints;
						p.maxEnergy += maxEnergyPoints;
						p.maxHunger += maxHungerPoints;
						p.maxThirst += maxThirstPoints;
					},
				);
			}
			else { throw new Error('No rank type found'); }

			embed.setFooter({ text: (embed.data.footer?.text ?? '') + 'Type "/rank" to rank up.' });

			botReply = await update(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			if (profileData.rank === RankType.Youngling) { await apprenticeAdvice(interaction); }
			else if (profileData.rank === RankType.Apprentice) { await hunterhealerAdvice(interaction); }
			else if (profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer) { await elderlyAdvice(interaction); }
		}
		else if (missValue >= 10) {

			cooldownMap.set(userData!.uuid + interaction.guildId, false);

			if (profileData.rank === RankType.Youngling) {

				embed.setDescription(`"I can't... I can't do it," *${quidData.name} heaves, ${pronoun(quidData, 2)} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${quidData.displayedSpecies || quidData.species}.*`);
			}
			else if (profileData.rank === RankType.Apprentice) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*No matter how long the ${quidData.displayedSpecies || quidData.species} pulls and tugs, ${pronoun(quidData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and bite away the root.*\n"Thanks for trying, ${quidData.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*No matter how long the ${quidData.displayedSpecies || quidData.species} pulls and tugs, ${pronoun(quidData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and pull them out from under the log with their mouths.*\n"Thanks for trying, ${quidData.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*No matter how long the ${quidData.displayedSpecies || quidData.species} pulls and tugs, ${pronoun(quidData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and push them away from the log with their heads.*\n"Thanks for trying, ${quidData.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm || speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${profileData.rank} when suddenly two larger ${quidData.displayedSpecies || quidData.species}s come running from the side. They pick both of them up and run sideways as fast as lightning. Before ${pronounAndPlural(quidData, 0, 'know')} what has happened to ${pronoun(quidData, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${profileData.rank} when suddenly two larger ${quidData.displayedSpecies || quidData.species}s come swimming from the side. They push them both away with their head and swim sideways as fast as lightning. Before ${pronounAndPlural(quidData, 0, 'know')} what has happened to ${pronoun(quidData, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (profileData.rank === RankType.Elderly) {

				if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm || speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} gasps as ${pronounAndPlural(quidData, 0, 'drop')} down to the ground, defeated. ${upperCasePronounAndPlural(quidData, 0, '\'s', '\'re')} just not fast enough... Suddenly a bunch of Elderlies come running and lift the pack members by their necks. Another ${quidData.displayedSpecies || quidData.species} has ${quidData.name} in their mouth and runs as fast as they can. Everyone is saved!*`);
				}
				else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} gasps as ${pronounAndPlural(quidData, 0, 'stop')} swimming, defeated. ${upperCasePronounAndPlural(quidData, 0, '\'s', '\'re')} just not fast enough... Suddenly a bunch of Elderlies come running and thrust the pack members from the side. Another ${quidData.displayedSpecies || quidData.species} pushes into ${quidData.name} with their head and swims as fast as they can. Everyone is saved!*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else { throw new Error('No rank type found'); }

			botReply = await update(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			return;
		}
		else {

			await interactionCollector(interaction, userData, serverData, cycleIndex += 1, questComponents);
		}
		return;
	}
}

/**
 * Draws a progress bar with 10 emojis based on a default emoji and a replacement emoji that is drawn in between based on its index.
 * @param index - The position where the replacement emoji should be drawn.
 * @param replacement - The replacement emoji.
 * @returns 10 emojis.
 */
function drawProgressbar(
	index: number,
	replacement: string,
): string {

	const barEmoji = '◻️';
	return barEmoji.repeat(index - 1) + replacement + barEmoji.repeat(10 - index);
}

/**
 * Sends advice of what changes as Apprentice.
 */
async function apprenticeAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nAs apprentice, you unlock new commands: \`explore\`, \`heal\`, \`practice\`, and \`repair\`.\nCheck \`rp help\` to see what they do!\nGo exploring via \`rp explore\` to find more quests and rank up higher!`,
	}, false)
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * Sends advice of what changes as Hunter/Healer.
 */
async function hunterhealerAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nHunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly and find more plants when \`exploring\`, but they are not so good at \`repairing\`.\nHunters can \`repair\` perfectly and find more enemies when \`exploring\`, but they are not so good at \`healing\`.\nHunters and Healers don't get advantages from the \`play\` command.`,
	}, false)
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * Sends advice of what changes as Elderly.
 */
async function elderlyAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nElderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
	}, false)
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}