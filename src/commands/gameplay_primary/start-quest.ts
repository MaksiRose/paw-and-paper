import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionResponse, Message, SlashCommandBuilder } from 'discord.js';
import { speciesInfo } from '../../cluster';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { SpeciesHabitatType } from '../../typings/main';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getDisplayname, pronoun, pronounAndPlural, getDisplayspecies } from '../../utils/getQuidInfo';
import { capitalize, respond, setCooldown } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (!quidToServer.hasQuest) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [
					...restEmbed,
					new EmbedBuilder()
						.setColor(error_color)
						.setTitle('You have no open quests at the moment :(')
						.setFooter({ text: `Go ${quidToServer.rank === RankType.Youngling ? 'playing' : 'exploring'} for a chance to get a quest!` }),
				],
			});
			return;
		}

		await sendQuestMessage(interaction, 'reply', user, quid, userToServer, quidToServer, messageContent, restEmbed);
	},
	sendMessageComponentResponse: async (interaction, { user, quid, userToServer, quidToServer }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!interaction.isButton()) { return; }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		let restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }
		restEmbed = restEmbed.length <= 0 && interaction.message.embeds[0]?.description?.includes('blinking at the bright sun') ? [EmbedBuilder.from(interaction.message.embeds[0]!)] : [];
		const afterEmbedArray = interaction.message.embeds.slice(interaction.message.embeds[0]?.description?.includes('blinking at the bright sun') ? 2 : 1).map(e => EmbedBuilder.from(e));

		const messageContent = remindOfAttack(interaction.guildId);

		if (!quidToServer.hasQuest) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [
					...restEmbed,
					new EmbedBuilder()
						.setColor(error_color)
						.setTitle('You have no open quests at the moment :(')
						.setFooter({ text: `Go ${quidToServer.rank === RankType.Youngling ? 'playing' : 'exploring'} for a chance to get a quest!` }),
				],
			});
			return;
		}

		await startQuest(interaction, user, quid, userToServer, quidToServer, messageContent, restEmbed, afterEmbedArray);
	},
};

export async function sendQuestMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	respondType: 'update' | 'reply',
	user: User,
	quid: Quid<true>,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[] = [],
	footerText = '',
	alternativeEditId?: string,
): Promise<InteractionResponse | Message> {

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

	if (quidToServer.rank === RankType.Youngling) {

		embed.setDescription(`*${quid.name} lifts ${pronoun(quid, 2)} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${pronounAndPlural(quid, 0, 'dash')} from where ${pronounAndPlural(quid, 0, 'is standing and bolts', 'are standing and bolt')} for the sound. Soon ${quid.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${pronoun(quid, 2)} brain. ${capitalize(pronoun(quid, 0))} must help them...*`);
	}
	else if (quidToServer.rank === RankType.Apprentice) {

		if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*The ${getDisplayspecies(quid)} wanders through the peaceful shrubbery, carefully surveying the undergrowth around ${pronoun(quid, 1)}. To ${pronoun(quid, 2)} left are thick bushes at the base of a lone tree. Suddenly, ${quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quid, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quid, 0)} must show all ${pronoun(quid, 2)} strength and pull out ${pronoun(quid, 2)} friend.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*The ${getDisplayspecies(quid)} wanders through the peaceful forest, carefully surveying the undergrowth around ${pronoun(quid, 1)}. To ${pronoun(quid, 2)} left is a long, thick tree trunk overgrown with sodden moss. Suddenly, ${quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quid, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quid, 0)} must show all ${pronoun(quid, 2)} strength and pull out ${pronoun(quid, 2)} friend.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*The ${getDisplayspecies(quid)} swims through the peaceful river, carefully surveying the algae around ${pronoun(quid, 1)}. In front of ${pronoun(quid, 2)} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly, ${quid.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(quid, 0, 'swim')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(quid, 0)} must show all ${pronoun(quid, 2)} strength and pull out ${pronoun(quid, 2)} friend.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (quidToServer.rank === RankType.Healer || quidToServer.rank === RankType.Hunter) {

		if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${quid.name} meanders over the sand, looking for food for ${pronoun(quid, 2)} pack. But suddenly the ${getDisplayspecies(quid)} hears a motor. Frightened, ${pronounAndPlural(quid, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(quid, 1)}, and the humans inside have another ${quidToServer.rank} of ${pronoun(quid, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quid, 0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${quid.name} meanders between the trees, looking for food for ${pronoun(quid, 2)} pack. But suddenly the ${getDisplayspecies(quid)} hears a motor. Frightened, ${pronounAndPlural(quid, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(quid, 1)}, and the humans inside have another ${quidToServer.rank} of ${pronoun(quid, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quid, 0, 'get')} to the rescue, the better.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${quid.name} floats through the water, looking for food for ${pronoun(quid, 2)} pack. But suddenly the ${getDisplayspecies(quid)} hears a motor. Frightened, ${pronounAndPlural(quid, 0, 'look')} to the surface: indeed, a motorboat is in front of ${pronoun(quid, 1)}, and the humans inside have another ${quidToServer.rank} of ${pronoun(quid, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(quid, 0, 'get')} to the rescue, the better.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else if (quidToServer.rank === RankType.Elderly) {

		if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*Something is off, the ${getDisplayspecies(quid)} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quid, 0)} were all alone. ${quid.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quid, 1)}. A glance over ${pronoun(quid, 2)} shoulder confirms ${pronoun(quid, 2)} fear, a big sandstorm is approaching. ${quid.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quid, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quid, 2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*Something is off, the ${getDisplayspecies(quid)} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quid, 0)} were all alone. ${quid.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quid, 1)}. A glance over ${pronoun(quid, 2)} shoulder confirms ${pronoun(quid, 2)} fear, a big snowstorm is approaching. ${quid.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quid, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quid, 2)} friends may never find their way back.*`);
		}
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*Something is off, the ${getDisplayspecies(quid)} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${pronoun(quid, 0)} were all alone. ${quid.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(quid, 1)}. A glance over ${pronoun(quid, 2)} shoulder confirms ${pronoun(quid, 2)} fear, a big landslide is approaching. ${quid.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(quid, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(quid, 2)} friends may never find their way back.*`);
		}
		else { throw new Error('No habitat was found for this species'); }
	}
	else { throw new Error('No rank was found for this profile'); }

	embed.setFooter({ text: `${footerText}\n\nClick the button or type "/start-quest" to continue.\n\nTip: Read the bottom text during the game carefully to find out which button to click. The button you chose will get a "radio button"-emoji, and the correct button will get a checkmark emoji. If you do not choose something fast enough, you will lose the round and no emoji is displayed.` });

	const components = [new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`start-quest_start_@${quid.id}`)
			.setLabel('Start quest')
			.setEmoji('⭐')
			.setStyle(ButtonStyle.Success))];

	// This can be a reply, an update or an editReply depending on where this function was called from.
	return await respond(interaction, {
		content: `<@${interaction.user.id}>\n${messageContent}`,
		embeds: [...restEmbed, embed, ...afterEmbedArray],
		components: components,
	}, respondType, respondType === 'reply' ? undefined : interaction.isMessageComponent() ? interaction.message.id : alternativeEditId);
}

async function startQuest(
	interaction: ButtonInteraction<'cached'>,
	user: User,
	quid: Quid<true>,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	messageContent: string,
	embedArray: EmbedBuilder[],
	afterEmbedArray: EmbedBuilder[],
): Promise<Message | InteractionResponse> {
	// this would be called from /quest, /explore and /play
	// Quest would send in the main interaction so that it would edit it, while for explore and play it would send in the button interaction so it would respond to the button click, which also has the side effect that the stats you lost etc would already be displayed under the original "you found a quest" message.

	await quidToServer.update({ hasQuest: false });

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

	let hitEmoji = '';
	let missEmoji = '';
	let hitValue = 1;
	let missValue = 1;

	if (quidToServer.rank === RankType.Youngling) {

		hitEmoji = '🪨';
		missEmoji = '⚡';
	}
	else if (quidToServer.rank === RankType.Apprentice) {

		hitEmoji = '🪵';
		missEmoji = '⚡';
	}
	else if (quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer) {

		hitEmoji = '💨';
		missEmoji = '💂';
	}
	else if (quidToServer.rank === RankType.Elderly) {

		hitEmoji = '💨';

		if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) { missEmoji = '🏜️'; }
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) { missEmoji = '🌨️'; }
		else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) { missEmoji = '⛰️'; }
		else { throw new Error('No species habitat type found'); }
	}
	else { throw new Error('No rank type found'); }

	return await interactionCollector(interaction, user, quid, userToServer, quidToServer, 0);

	async function interactionCollector(
		interaction: ButtonInteraction<'cached'>,
		user: User,
		quid: Quid<true>,
		userToServer: UserToServer,
		quidToServer: QuidToServer,
		cycleIndex: number,
		previousQuestComponents?: ActionRowBuilder<ButtonBuilder>,
		newInteraction?: ButtonInteraction<'cached'>,
	): Promise<InteractionResponse | Message> {

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

		// This is always an update or an editReply
		const botReply = await respond(newInteraction ?? interaction, {
			content: messageContent,
			embeds: [...embedArray, embed, ...afterEmbedArray],
			components: [...previousQuestComponents ? [previousQuestComponents] : [], questComponents],
			fetchReply: true,
		}, 'update', newInteraction?.message.id ?? interaction.message.id);

		newInteraction = await (botReply as Message<true> | InteractionResponse<true>)
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

				if (data.style !== ButtonStyle.Link && data.style !== ButtonStyle.Premium && data.custom_id === newInteraction!.customId) { component.setEmoji('🔘'); }
				return component;
			}));

			/* The correct button will get the "checkbox"-emoji. */
			questComponents.setComponents(questComponents.components.map(component => {

				const data = component.toJSON();

				if (data.style !== ButtonStyle.Link && data.style !== ButtonStyle.Premium && data.custom_id.includes(`${buttonColorKind}${buttonTextOrColor}`)) { component.setEmoji('☑️'); }
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

		if (hitValue >= 10) {

			embed.setFooter({ text: 'Type "/rank-up" to rank up.' });
			await setCooldown(userToServer, false);

			if (quidToServer.unlockedRanks < 3) {

				await quidToServer.update({ unlockedRanks: quidToServer.unlockedRanks + 1 });
			}

			if (quidToServer.rank === RankType.Youngling) {

				embed.setDescription(`*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${quid.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${getDisplayspecies(quid)} runs out of the cave, jumping around ${quid.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`);
			}
			else if (quidToServer.rank === RankType.Apprentice) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem, ${quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*After fighting with the root for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*After fighting with the trunk for a while, the Apprentice now slips out. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${quid.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${getDisplayspecies(quid)} runs to the pack, the other ${quidToServer.rank} in ${pronoun(quid, 2)} mouth. An Elderly is already coming towards ${pronoun(quid, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${quid.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${getDisplayspecies(quid)} swims to the pack, the other ${quidToServer.rank} in ${pronoun(quid, 2)} mouth. An Elderly is already swimming towards ${pronoun(quid, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${quid.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (quidToServer.rank === RankType.Elderly) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${getDisplayspecies(quid)} runs for a while before the situation seems to clear up. ${quid.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(quid, 0, 'goes', 'go')} back to the pack, another pack member in ${pronoun(quid, 2)} mouth. ${capitalize(pronounAndPlural(quid, 0, 'feel'))} strangely stronger than before.*`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${getDisplayspecies(quid)} runs for a while before the situation seems to clear up. ${quid.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(quid, 0, 'swim')} back to the pack, another pack member in ${pronoun(quid, 2)} mouth. ${capitalize(pronounAndPlural(quid, 0, 'feel'))} strangely stronger than before.*`);
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

				await quidToServer.update({
					maxHealth: quidToServer.maxHealth + maxHealthPoints,
					maxEnergy: quidToServer.maxEnergy + maxEnergyPoints,
					maxHunger: quidToServer.maxHunger + maxHungerPoints,
					maxThirst: quidToServer.maxThirst + maxThirstPoints,
				});
			}
			else { throw new Error('No rank type found'); }

			// This is always an update or an editReply
			const response = await respond(newInteraction ?? interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			}, 'update', newInteraction?.message.id ?? interaction.message.id);

			if (quidToServer.rank === RankType.Youngling) { await apprenticeAdvice(newInteraction ?? interaction); }
			else if (quidToServer.rank === RankType.Apprentice) { await hunterhealerAdvice(newInteraction ?? interaction); }
			else if (quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer) { await elderlyAdvice(newInteraction ?? interaction); }
			return response;
		}
		else if (missValue >= 10) {

			await setCooldown(userToServer, false);

			if (quidToServer.rank === RankType.Youngling) {

				embed.setDescription(`"I can't... I can't do it," *${quid.name} heaves, ${pronoun(quid, 2)} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${getDisplayspecies(quid)}.*`);
			}
			else if (quidToServer.rank === RankType.Apprentice) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm) {

					embed.setDescription(`*No matter how long the ${getDisplayspecies(quid)} pulls and tugs, ${pronoun(quid, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and bite away the root.*\n"Thanks for trying, ${quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*No matter how long the ${getDisplayspecies(quid)} pulls and tugs, ${pronoun(quid, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and pull them out from under the log with their mouths.*\n"Thanks for trying, ${quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*No matter how long the ${getDisplayspecies(quid)} pulls and tugs, ${pronoun(quid, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and push them away from the log with their heads.*\n"Thanks for trying, ${quid.name}. But thank goodness we found you!" *the Elderly says.*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${quidToServer.rank} when suddenly two larger ${getDisplayspecies(quid)}s come running from the side. They pick both of them up and run sideways as fast as lightning. Before ${pronounAndPlural(quid, 0, 'know')} what has happened to ${pronoun(quid, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*It almost looks like the humans are catching up to the other ${quidToServer.rank} when suddenly two larger ${getDisplayspecies(quid)}s come swimming from the side. They push them both away with their head and swim sideways as fast as lightning. Before ${pronounAndPlural(quid, 0, 'know')} what has happened to ${pronoun(quid, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else if (quidToServer.rank === RankType.Elderly) {

				if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Warm || speciesInfo[quid.species].habitat === SpeciesHabitatType.Cold) {

					embed.setDescription(`*The ${getDisplayspecies(quid)} gasps as ${pronounAndPlural(quid, 0, 'drop')} down to the ground, defeated. ${capitalize(pronounAndPlural(quid, 0, '\'s', '\'re'))} just not fast enough... Suddenly a bunch of Elderlies come running and lift the pack members by their necks. Another ${getDisplayspecies(quid)} has ${quid.name} in their mouth and runs as fast as they can. Everyone is saved!*`);
				}
				else if (speciesInfo[quid.species].habitat === SpeciesHabitatType.Water) {

					embed.setDescription(`*The ${getDisplayspecies(quid)} gasps as ${pronounAndPlural(quid, 0, 'stop')} swimming, defeated. ${capitalize(pronounAndPlural(quid, 0, '\'s', '\'re'))} just not fast enough... Suddenly a bunch of Elderlies come running and thrust the pack members from the side. Another ${getDisplayspecies(quid)} pushes into ${quid.name} with their head and swims as fast as they can. Everyone is saved!*`);
				}
				else { throw new Error('No species habitat type found'); }
			}
			else { throw new Error('No rank type found'); }

			// This is always an update or an editReply
			return await respond(newInteraction ?? interaction, {
				content: messageContent,
				embeds: [...embedArray, embed, ...afterEmbedArray],
				components: [questComponents],
			}, 'update', newInteraction?.message.id ?? interaction.message.id);
		}
		else {

			return await interactionCollector(interaction, user, quid, userToServer, quidToServer, cycleIndex += 1, questComponents, newInteraction);
		}
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

	// This is always a followUp
	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nAs apprentice, you unlock new commands: \`explore\`, \`/scavenge\`, \`heal\`, \`practice\`, and \`repair\`.\nCheck \`/help\` to see what they do!\nGo exploring via \`/explore\` to find more quests and rank up higher!`,
	});
}

/**
 * Sends advice of what changes as Hunter/Healer.
 */
async function hunterhealerAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	// This is always a followUp
	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nHunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly and find more plants when \`exploring\`, but they are not so good at \`repairing\`.\nHunters can \`repair\` perfectly and find more enemies when \`exploring\`, but they are not so good at \`healing\`.\nHunters and Healers don't get advantages from the \`play\` command.`,
	});
}

/**
 * Sends advice of what changes as Elderly.
 */
async function elderlyAdvice(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
) {

	// This is always a followUp
	await respond(interaction, {
		content: `${interaction.user.toString()} ❓ **Tip:**\nElderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
	});
}