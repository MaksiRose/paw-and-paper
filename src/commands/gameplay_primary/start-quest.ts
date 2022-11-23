import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { speciesInfo } from '../..';
import { ServerSchema } from '../../typings/data/server';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { SpeciesHabitatType } from '../../typings/main';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { capitalizeString, getMapData, respond, setCooldown, update } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from './attack';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('start-quest')
		.setDescription('Get quests by playing (as Youngling) or exploring. Start them with this command.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 7,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (!userData.quid.profile.hasQuest) {

			await respond(interaction, {
				content: messageContent,
				embeds: [
					...restEmbed,
					new EmbedBuilder()
						.setColor(error_color)
						.setTitle('You have no open quests at the moment :(')
						.setFooter({ text: `Go ${userData.quid.profile.rank === RankType.Youngling ? 'playing' : 'exploring'} for a chance to get a quest!` }),
				],
			}, true);
			return;
		}

		await sendQuestMessage(interaction, userData, serverData, messageContent, restEmbed);
	},
};

export async function sendQuestMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[] = [],
	footerText = '',
): Promise<Message> {

	const embed = new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL });

	if (userData.quid.profile.rank === RankType.Youngling) {

		embed.setDescription(`*${userData.quid.name} lifts ${userData.quid.pronoun(2)} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${userData.quid.pronounAndPlural(0, 'dash')} from where ${userData.quid.pronounAndPlural(0, 'is standing and bolts', 'are standing and bolt')} for the sound. Soon ${userData.quid.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${userData.quid.pronoun(2)} brain. ${capitalizeString(userData.quid.pronoun(0))} must help them...*`);
	}
	else if (userData.quid.profile.rank === RankType.Apprentice) {

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*The ${userData.quid.getDisplayspecies()} wanders through the peaceful shrubbery, carefully surveying the undergrowth around ${userData.quid.pronoun(1)}. To ${userData.quid.pronoun(2)} left are thick bushes at the base of a lone tree. Suddenly, ${userData.quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${userData.quid.pronounAndPlural(0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${userData.quid.pronoun(0)} must show all ${userData.quid.pronoun(2)} strength and pull out ${userData.quid.pronoun(2)} friend.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*The ${userData.quid.getDisplayspecies()} wanders through the peaceful forest, carefully surveying the undergrowth around ${userData.quid.pronoun(1)}. To ${userData.quid.pronoun(2)} left is a long, thick tree trunk overgrown with sodden moss. Suddenly, ${userData.quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${userData.quid.pronounAndPlural(0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${userData.quid.pronoun(0)} must show all ${userData.quid.pronoun(2)} strength and pull out ${userData.quid.pronoun(2)} friend.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*The ${userData.quid.getDisplayspecies()} swims through the peaceful river, carefully surveying the algae around ${userData.quid.pronoun(1)}. In front of ${userData.quid.pronoun(2)} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly, ${userData.quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${userData.quid.pronounAndPlural(0, 'swim')} over, and sure enough, another apprentice seems to be trapped. Now ${userData.quid.pronoun(0)} must show all ${userData.quid.pronoun(2)} strength and pull out ${userData.quid.pronoun(2)} friend.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (userData.quid.profile.rank === RankType.Healer || userData.quid.profile.rank === RankType.Hunter) {

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${userData.quid.name} meanders over the sand, looking for food for ${userData.quid.pronoun(2)} pack. But suddenly the ${userData.quid.getDisplayspecies()} hears a motor. Frightened, ${userData.quid.pronounAndPlural(0, 'look')} into the distance: indeed, a jeep is in front of ${userData.quid.pronoun(1)}, and the humans inside have another ${userData.quid.profile.rank} of ${userData.quid.pronoun(2)} pack in their crosshairs! The sooner ${userData.quid.pronounAndPlural(0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${userData.quid.name} meanders between the trees, looking for food for ${userData.quid.pronoun(2)} pack. But suddenly the ${userData.quid.getDisplayspecies()} hears a motor. Frightened, ${userData.quid.pronounAndPlural(0, 'look')} into the distance: indeed, a jeep is in front of ${userData.quid.pronoun(1)}, and the humans inside have another ${userData.quid.profile.rank} of ${userData.quid.pronoun(2)} pack in their crosshairs! The sooner ${userData.quid.pronounAndPlural(0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${userData.quid.name} floats through the water, looking for food for ${userData.quid.pronoun(2)} pack. But suddenly the ${userData.quid.getDisplayspecies()} hears a motor. Frightened, ${userData.quid.pronounAndPlural(0, 'look')} to the surface: indeed, a motorboat is in front of ${userData.quid.pronoun(1)}, and the humans inside have another ${userData.quid.profile.rank} of ${userData.quid.pronoun(2)} pack in their crosshairs! The sooner ${userData.quid.pronounAndPlural(0, 'get')} to the rescue, the better.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (userData.quid.profile.rank === RankType.Elderly) {

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*Something is off, the ${userData.quid.getDisplayspecies()} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${userData.quid.pronoun(0)} were all alone. ${userData.quid.name} looks around and can't see a soul far and wide. Then it dawns on ${userData.quid.pronoun(1)}. A glance over ${userData.quid.pronoun(2)} shoulder confirms ${userData.quid.pronoun(2)} fear, a big sandstorm is approaching. ${userData.quid.name} is out of range, but other pack members might be in danger. If ${userData.quid.pronounAndPlural(0, 'doesn\'t', 'don\'t')} hurry now, ${userData.quid.pronoun(2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*Something is off, the ${userData.quid.getDisplayspecies()} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${userData.quid.pronoun(0)} were all alone. ${userData.quid.name} looks around and can't see a soul far and wide. Then it dawns on ${userData.quid.pronoun(1)}. A glance over ${userData.quid.pronoun(2)} shoulder confirms ${userData.quid.pronoun(2)} fear, a big snowstorm is approaching. ${userData.quid.name} is out of range, but other pack members might be in danger. If ${userData.quid.pronounAndPlural(0, 'doesn\'t', 'don\'t')} hurry now, ${userData.quid.pronoun(2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*Something is off, the ${userData.quid.getDisplayspecies()} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${userData.quid.pronoun(0)} were all alone. ${userData.quid.name} looks around and can't see a soul far and wide. Then it dawns on ${userData.quid.pronoun(1)}. A glance over ${userData.quid.pronoun(2)} shoulder confirms ${userData.quid.pronoun(2)} fear, a big landslide is approaching. ${userData.quid.name} is out of range, but other pack members might be in danger. If ${userData.quid.pronounAndPlural(0, 'doesn\'t', 'don\'t')} hurry now, ${userData.quid.pronoun(2)} friends may never find their way back.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else { throw new Error('No rank was found for this profile'); }

	embed.setFooter({ text: `${footerText}\n\nClick the button or type "/start-quest" to continue.\n\nTip: Read the bottom text during the game carefully to find out which button to click. The button you chose will get a "radio button"-emoji, and the correct button will get a checkmark emoji. If you do not choose something fast enough, you will lose the round and no emoji is displayed.` });

	const botReply = await respond(interaction, {
		content: `<@${interaction.user.id}>\n${messageContent}`,
		embeds: [...restEmbed, embed, ...afterEmbedArray],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents(new ButtonBuilder()
				.setCustomId('quest_start')
				.setLabel('Start quest')
				.setEmoji('⭐')
				.setStyle(ButtonStyle.Success))],
	}, true);

	/* The View Channels permissions that are needed for this function to work properly should be checked in all places that reference sendQuestMessage. It can't be checked for in here directly because a botReply must be returned. */
	saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id, interaction);

	return await (botReply as Message<true>)
		.awaitMessageComponent({
			filter: (i) => i.user.id === interaction.user.id,
			componentType: ComponentType.Button,
			time: 300_000 })
		.then(async (int) => {

			await setCooldown(userData, interaction.guildId, true);
			deleteCommandDisablingInfo(userData, interaction.guildId);
			return await startQuest(int, userData, serverData, messageContent, restEmbed, afterEmbedArray, botReply);
		})
		.catch(async () => {

			return await respond(interaction, { components: disableAllComponents(botReply.components) }, true);
		});
}

async function startQuest(
	interaction: ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	messageContent: string,
	embedArray: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[],
	botReply: Message,
): Promise<Message> {
	// this would be called from /quest, /explore and /play
	// Quest would send in the main interaction so that it would edit it, while for explore and play it would send in the button interaction so it would respond to the button click, which also has the side effect that the stats you lost etc would already be displayed under the original "you found a quest" message.

	await userData.update(
		(u) => {
			const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
			p.hasQuest = false;
		},
	);

	const embed = new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL });

	let hitEmoji = '';
	let missEmoji = '';
	let hitValue = 1;
	let missValue = 1;

	if (userData.quid.profile.rank === RankType.Youngling) {

		hitEmoji = '🪨';
		missEmoji = '⚡';
	}
	else if (userData.quid.profile.rank === RankType.Apprentice) {

		hitEmoji = '🪵';
		missEmoji = '⚡';
	}
	else if (userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer) {

		hitEmoji = '💨';
		missEmoji = '💂';
	}
	else if (userData.quid.profile.rank === RankType.Elderly) {

		hitEmoji = '💨';

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) { missEmoji = '🏜️'; }
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) { missEmoji = '🌨️'; }
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) { missEmoji = '⛰️'; }
		else { throw new Error('No species habitat type found'); }
	}
	else { throw new Error('No rank type found'); }

	return await interactionCollector(interaction, userData, serverData, 0);

	async function interactionCollector(
		interaction: ButtonInteraction<'cached'>,
		userData: UserData<never, never>,
		serverData: ServerSchema,
		cycleIndex: number,
		previousQuestComponents?: ActionRowBuilder<ButtonBuilder>,
		newInteraction?: ButtonInteraction<'cached'>,
	): Promise<Message> {

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

		botReply = await update(newInteraction ?? interaction, {
			content: messageContent,
			embeds: [...embedArray, embed, ...afterEmbedArray],
			components: [...previousQuestComponents ? [previousQuestComponents] : [], questComponents],
		});

		newInteraction = await (botReply as Message<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 5_000,
			})
			.catch(() => { return undefined; });

		if (newInteraction !== undefined) {

			/* The button the user chose will get the "radio button"-emoji. */
			questComponents.setComponents(questComponents.components.map(component => {

				const data = component.toJSON();

				if (data.style !== ButtonStyle.Link && data.custom_id === newInteraction!.customId) { component.setEmoji('🔘'); }
				return component;
			}));

			/* The correct button will get the "checkbox"-emoji. */
			questComponents.setComponents(questComponents.components.map(component => {

				const data = component.toJSON();

				if (data.style !== ButtonStyle.Link && data.custom_id.includes(`${buttonColorKind}${buttonTextOrColor}`)) { component.setEmoji('☑️'); }
				return component;
			}));
		}

		if (newInteraction === undefined || !newInteraction.customId.includes(`${buttonColorKind}${buttonTextOrColor}`)) { missValue += 1; }
		else { hitValue += 1; }

		questComponents = questComponents.setComponents(questComponents.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link) { component.setDisabled(true); }
			return component;
		}));

		embed.setFooter({ text: 'Type "/rank-up" to rank up.' });
		if (hitValue >= 10) {

			await setCooldown(userData, interaction.guildId, false);

			if (userData.quid.profile.unlockedRanks < 3) {

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
						p.unlockedRanks += 1;
					},
				);
			}

			if (userData.quid.profile.rank === RankType.Youngling) {

				embed.setDescription(`*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${userData.quid.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${userData.quid.getDisplayspecies()} runs out of the cave, jumping around ${userData.quid.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`);
			}
			else if (userData.quid.profile.rank === RankType.Apprentice) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem, ${userData.quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*After fighting with the root for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${userData.quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${userData.quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${userData.quid.getDisplayspecies()} runs to the pack, the other ${userData.quid.profile.rank} in ${userData.quid.pronoun(2)} mouth. An Elderly is already coming towards ${userData.quid.pronoun(1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${userData.quid.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${userData.quid.getDisplayspecies()} swims to the pack, the other ${userData.quid.profile.rank} in ${userData.quid.pronoun(2)} mouth. An Elderly is already swimming towards ${userData.quid.pronoun(1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${userData.quid.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (userData.quid.profile.rank === RankType.Elderly) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${userData.quid.getDisplayspecies()} runs for a while before the situation seems to clear up. ${userData.quid.name} gasps in exhaustion. That was close. Full of adrenaline, ${userData.quid.pronounAndPlural(0, 'goes', 'go')} back to the pack, another pack member in ${userData.quid.pronoun(2)} mouth. ${capitalizeString(userData.quid.pronounAndPlural(0, 'feel'))} strangely stronger than before.*`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${userData.quid.getDisplayspecies()} runs for a while before the situation seems to clear up. ${userData.quid.name} gasps in exhaustion. That was close. Full of adrenaline, ${userData.quid.pronounAndPlural(0, 'swim')} back to the pack, another pack member in ${userData.quid.pronoun(2)} mouth. ${capitalizeString(userData.quid.pronounAndPlural(0, 'feel'))} strangely stronger than before.*`);
				}
				else { throw new Error('No species habitat type found'); }

				let maxHealthPoints = 0;
				let maxEnergyPoints = 0;
				let maxHungerPoints = 0;
				let maxThirstPoints = 0;

				switch (Math.floor(Math.random() * 4)) {
					case 0:

						maxHealthPoints = 10;
						embed.setFooter({ text: '+10 maximum health' });
						break;

					case 1:

						maxEnergyPoints = 10;
						embed.setFooter({ text: '+10 maximum energy' });
						break;

					case 2:
						maxHungerPoints = 10;
						embed.setFooter({ text: '+10 maximum hunger' });
						break;

					default:

						maxThirstPoints = 10;
						embed.setFooter({ text: '+10 maximum thirst' });
						break;
				}

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
						p.maxHealth += maxHealthPoints;
						p.maxEnergy += maxEnergyPoints;
						p.maxHunger += maxHungerPoints;
						p.maxThirst += maxThirstPoints;
					},
				);
			}
			else { throw new Error('No rank type found'); }

			botReply = await update(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			});

			if (userData.quid.profile.rank === RankType.Youngling) { await apprenticeAdvice(interaction); }
			else if (userData.quid.profile.rank === RankType.Apprentice) { await hunterhealerAdvice(interaction); }
			else if (userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer) { await elderlyAdvice(interaction); }
		}
		else if (missValue >= 10) {

			await setCooldown(userData, interaction.guildId, false);

			if (userData.quid.profile.rank === RankType.Youngling) {

				embed.setDescription(`"I can't... I can't do it," *${userData.quid.name} heaves, ${userData.quid.pronoun(2)} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${userData.quid.getDisplayspecies()}.*`);
			}
			else if (userData.quid.profile.rank === RankType.Apprentice) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*No matter how long the ${userData.quid.getDisplayspecies()} pulls and tugs, ${userData.quid.pronoun(0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and bite away the root.*\n"Thanks for trying, ${userData.quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*No matter how long the ${userData.quid.getDisplayspecies()} pulls and tugs, ${userData.quid.pronoun(0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and pull them out from under the log with their mouths.*\n"Thanks for trying, ${userData.quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*No matter how long the ${userData.quid.getDisplayspecies()} pulls and tugs, ${userData.quid.pronoun(0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and push them away from the log with their heads.*\n"Thanks for trying, ${userData.quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${userData.quid.profile.rank} when suddenly two larger ${userData.quid.getDisplayspecies()}s come running from the side. They pick both of them up and run sideways as fast as lightning. Before ${userData.quid.pronounAndPlural(0, 'know')} what has happened to ${userData.quid.pronoun(1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${userData.quid.profile.rank} when suddenly two larger ${userData.quid.getDisplayspecies()}s come swimming from the side. They push them both away with their head and swim sideways as fast as lightning. Before ${userData.quid.pronounAndPlural(0, 'know')} what has happened to ${userData.quid.pronoun(1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (userData.quid.profile.rank === RankType.Elderly) {

				if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${userData.quid.getDisplayspecies()} gasps as ${userData.quid.pronounAndPlural(0, 'drop')} down to the ground, defeated. ${capitalizeString(userData.quid.pronounAndPlural(0, '\'s', '\'re'))} just not fast enough... Suddenly a bunch of Elderlies come running and lift the pack members by their necks. Another ${userData.quid.getDisplayspecies()} has ${userData.quid.name} in their mouth and runs as fast as they can. Everyone is saved!*`);
				}
				else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${userData.quid.getDisplayspecies()} gasps as ${userData.quid.pronounAndPlural(0, 'stop')} swimming, defeated. ${capitalizeString(userData.quid.pronounAndPlural(0, '\'s', '\'re'))} just not fast enough... Suddenly a bunch of Elderlies come running and thrust the pack members from the side. Another ${userData.quid.getDisplayspecies()} pushes into ${userData.quid.name} with their head and swims as fast as they can. Everyone is saved!*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else { throw new Error('No rank type found'); }

			botReply = await update(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			});

			return botReply;
		}
		else {

			botReply = await interactionCollector(interaction, userData, serverData, cycleIndex += 1, questComponents, newInteraction);
		}
		return botReply;
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
		content: `${interaction.user.toString()} ❓ **Tip:**\nAs apprentice, you unlock new commands: \`explore\`, \`/scavenge\`, \`heal\`, \`practice\`, and \`repair\`.\nCheck \`/help\` to see what they do!\nGo exploring via \`/explore\` to find more quests and rank up higher!`,
	}, false);
}

/**
 * Sends advice of what changes as Hunter/Healer.
 */
async function hunterhealerAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nHunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly and find more plants when \`exploring\`, but they are not so good at \`repairing\`.\nHunters can \`repair\` perfectly and find more enemies when \`exploring\`, but they are not so good at \`healing\`.\nHunters and Healers don't get advantages from the \`play\` command.`,
	}, false);
}

/**
 * Sends advice of what changes as Elderly.
 */
async function elderlyAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nElderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
	}, false);
}