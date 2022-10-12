import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { Quid, RankType, ServerSchema, SlashCommand, speciesInfo, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural, upperCasePronoun, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond, sendErrorMessage, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { pickMaterial, pickMeat } from '../../utils/simulateItemUse';
import { remindOfAttack } from './attack';

const name: SlashCommand['name'] = 'scavenge';
const description: SlashCommand['description'] = 'Scavenge for carcass and materials. Costs energy, but gives XP.';
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

		await executeScavenging(interaction, userData, serverData, embedArray);
	},
};

export async function executeScavenging(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	/* This ensures that the user is in a guild and has a completed account. */
	if (!isInGuild(interaction)) { return; }
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!hasName(interaction, userData)) { return; }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	let profileData = getMapData(quidData.profiles, interaction.guildId);
	if (!hasSpecies(interaction, quidData)) { return; }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (profileData.rank === RankType.Youngling) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*A hunter cuts ${quidData.name} as they see ${pronoun(quidData, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`)],
		}, true);
		return;
	}

	if (await hasFullInventory(interaction, userData, quidData, profileData, embedArray, messageContent)) { return; }

	cooldownMap.set(userData._id + interaction.guildId, true);

	const experiencePoints = getRandomNumber(11, 5);
	const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
	profileData = changedCondition.profileData;

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL });

	/* Defining emojis and grids for the scavenge and the humantrap game. */
	const unclickedField = '❔';
	const humanTrapCorrectEmoji = '🕸️';
	const filledFieldArray = ['⬜', '🟩', '🟨', '🟧', '🟥'] as const;
	const correctCoordinates = [getRandomNumber(5), getRandomNumber(5)] as const;
	const gamePositionsArray: string[][] = [];
	let componentArray: ActionRowBuilder<ButtonBuilder>[] = [];

	/* Creating a 5x5 grid of buttons, with a random button being the correct one. */
	for (let i = 0; i < 5; i++) {

		componentArray.push(new ActionRowBuilder<ButtonBuilder>());
		gamePositionsArray.push([]);

		for (let j = 0; j < 5; j++) {

			componentArray[i]?.addComponents(new ButtonBuilder()
				.setCustomId(`scavenge_board_${i}_${j}`)
				.setEmoji(unclickedField)
				.setDisabled(false)
				.setStyle(ButtonStyle.Secondary));

			if (i === correctCoordinates[0] && j === correctCoordinates[1]) { gamePositionsArray[i]?.push(filledFieldArray[0]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 1 && Math.abs(j - correctCoordinates[1]) <= 1) { gamePositionsArray[i]?.push(filledFieldArray[1]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 2 && Math.abs(j - correctCoordinates[1]) <= 2) { gamePositionsArray[i]?.push(filledFieldArray[2]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 3 && Math.abs(j - correctCoordinates[1]) <= 3) { gamePositionsArray[i]?.push(filledFieldArray[3]); }
			else { gamePositionsArray[i]?.push(filledFieldArray[4]); }
		}
	}

	let botReply = await respond(interaction, {
		content: messageContent,
		embeds: [...embedArray, new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
			.setDescription(`*${quidData.name} carefully examines the terrain around the pack, hoping to find useful materials or carcasses. The ${quidData.displayedSpecies || quidData.species} must now prove prudence and a keen eye...*`)
			.setFooter({ text: 'Click the fields to reveal what\'s underneath. Based on how close you are to the correct field, a color on a scale from green (closest) to red (farthest) is going to appear. You can click 4 times and have 2 minutes to win.' })],
		components: componentArray,
	}, true);

	await interactionCollector(interaction, userData, serverData, false);

	async function interactionCollector(
		interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
		userData: UserSchema,
		serverData: ServerSchema,
		isHumanTrap: boolean,
	): Promise<void> {

		let correctButtonPresses = 0;

		/* Creating a collector that will collect the interactions of the user with the message. */
		const collector = (botReply as Message<true>).createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			componentType: ComponentType.Button,
			time: isHumanTrap ? 12_000 : 120_000,
		});

		collector.on('collect', async int => {
			try {

				/* It's checking if the customId of the button includes the word `board-`, which means that it is part of the scavenge game, or if the customId of the button includes the  word `humantrap-`, which means that it is part of the humantrap game. */
				if (int.customId.includes('board_')) {

					correctButtonPresses += 1;
					/* Getting the position of the button that the user clicked. */
					const verticalBoardPosition = Number(int.customId.split('_')[2]);
					const horizontalBoardPosition = Number(int.customId.split('_')[3]);
					const buttonInBoardPosition = componentArray[verticalBoardPosition]?.components[horizontalBoardPosition];

					/* Set the emoji of the button to the emoji in the gamePositionsArray. It will then disable the button. */
					const emoji = gamePositionsArray[verticalBoardPosition]?.[horizontalBoardPosition];
					if (!emoji) {
						await sendErrorMessage(int, new Error('emoji is undefined'))
							.catch((error) => { console.error(error); });
						return;
					}
					buttonInBoardPosition?.setEmoji(emoji);
					buttonInBoardPosition?.setDisabled(true);

					/* Checking if the user has clicked on the correct field. If they have, it will stop the collector and if they haven't, it will edit the message with the new components. */
					if (emoji === filledFieldArray[0]) {

						const playingField = componentArray.map(c => c.components.map(b => b.data.emoji?.name ?? unclickedField).join('')).join('\n');
						componentArray = [];

						/* Counting the number of profiles that have a rank higher than Youngling, the amount of meat and the amount of materials in the server's inventory. */
						const highRankProfilesCount = (await userModel
							.find(
								(u) => Object.values(u.quids).filter(q => {
									const p = q.profiles[interaction.guildId];
									return p && p.rank !== RankType.Youngling;
								}).length > 0))
							.map(u => Object.values(u.quids).filter(q => {
								const p = q.profiles[interaction.guildId];
								return p && p.rank !== RankType.Youngling;
							}).length)
							.reduce((a, b) => a + b, 0);
						const serverMeatCount = Object.values(serverData.inventory.meat).flat().reduce((a, b) => a + b, 0);
						const serverMaterialsCount = Object.values(serverData.inventory.materials).flat().reduce((a, b) => a + b, 0);

						/* Checking if the server has enough meat, if it doesn't, give the user meat. If it does, check if the server has enough materials, if it doesn't, give the user material. If it does, do nothing. */
						const meatIsGettable = serverMeatCount < highRankProfilesCount * 2;
						const materialIsGettable = serverMaterialsCount < 36;
						if (meatIsGettable && pullFromWeightedTable({ 0: 1, 1: materialIsGettable ? 1 : 0 }) === 0) {

							const carcassArray = [...speciesInfo[(quidData as Quid<true>).species].biome1OpponentArray];
							const foundCarcass = pickMeat(carcassArray, serverData.inventory);
							if (!foundCarcass) {
								await sendErrorMessage(interaction, new Error('foundCarcass is undefined'))
									.catch((error) => { console.error(error); });
								return;
							}

							embed.setDescription(`*After a while, ${quidData.name} can indeed find something useful: On the floor is a ${foundCarcass} that seems to have recently lost a fight fatally. Although the animal has a few injuries, it can still serve as great nourishment. What a success!*\n${playingField}`);
							embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundCarcass}` });

							userData = await userModel.findOneAndUpdate(
								u => u._id === userData?._id,
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
									p.inventory.meat[foundCarcass] += 1;
								},
							);
						}
						else if (materialIsGettable) {

							const foundMaterial = pickMaterial(serverData.inventory);
							if (!foundMaterial) {
								await sendErrorMessage(interaction, new Error('foundMaterial is undefined'))
									.catch((error) => { console.error(error); });
								return;
							}

							embed.setDescription(`*${quidData.name} searches in vain for edible remains of deceased animals. But the expedition is not without success: the ${quidData.displayedSpecies || quidData.species} sees a ${foundMaterial}, which can serve as a great material for repairs and work in the pack. ${upperCasePronoun(quidData, 0)} happily takes it home with ${pronoun(quidData, 1)}.*\n${playingField}`);
							embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundMaterial}` });

							userData = await userModel.findOneAndUpdate(
								u => u._id === userData?._id,
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
									p.inventory.materials[foundMaterial] += 1;
								},
							);
						}
						else {

							embed.setDescription(`*Although ${quidData.name} searches everything very thoroughly, there doesn't seem to be anything in the area that can be used at the moment. Probably everything has already been found. The ${quidData.displayedSpecies || quidData.species} decides to look again later.*\n${playingField}`);
							if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
						}

						await sendFinalMessage(int, userData, serverData);
						collector.stop('win');
					}
					else {

						botReply = await update(int, { components: componentArray });
						if (correctButtonPresses >= 4) { collector.stop(); }
					}
				}
				else if (int.customId.includes('humantrap_')) {

					/* It's checking if the customId of the button includes the correct emoji. If it does, it will add 1 to the `correctButtonPresses` variable. It will then call the `changeComponents` function. */
					if (int.customId.includes(humanTrapCorrectEmoji)) { correctButtonPresses += 1; }
					if (correctButtonPresses >= 10) { collector.stop(); }
					else { await changeComponents(int); }
				}
			}
			catch (error) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
		});

		collector.on('end', async (interactions, reason) => {
			try {

				/* The below code is checking if the user has finished the game or not. If the user has finished the game, it will check if the server has enough meat and materials. If it doesn't, it will give the user meat or  materials. If it does, it will do nothing. If the user has lost the game, it will check if the user has lost the human trap game as well. If they did, it will add an injury to the user. If the game is not finished, start the human trap game. */
				if (isHumanTrap) {

					/* Creating a weighted table with the probability of the player not being hurt being equal to the number of correct button presses. */
					const isHurt = pullFromWeightedTable({ 0: correctButtonPresses, 1: 10 - correctButtonPresses });

					/* Checking if the user is hurt or not. If the user is hurt, it will subtract health points from the user and give them an injury. */
					if (isHurt == 0) {

						embed.setDescription(`*After ${quidData.name} gets over the initial shock, the ${quidData.displayedSpecies || quidData.species} quickly manages to free ${pronoun(quidData, 4)} from the net. That was close!*`);
						if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
					}
					else {

						const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(getRandomNumber(5, 3));

						switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

							case 0:

								profileData.injuries.infections += 1;

								embed.setDescription(`*${quidData.name} is still shocked for a while, but finally manages to free ${pronoun(quidData, 4)}. Not long after, however, ${pronounAndPlural(quidData, 0, 'feel')} a shock wave run through ${pronoun(quidData, 2)} body. Something sharp must have pressed into the ${quidData.displayedSpecies || quidData.species}. It looks infected.*`);
								embed.setFooter({ text: `-${healthPoints} HP (from infection)\n${changedCondition.statsUpdateText}` });

								break;

							default:

								profileData.injuries.sprains += 1;

								embed.setDescription(`*${quidData.name} is still shocked for a while, but finally manages to free ${pronoun(quidData, 4)}. But the escape was not perfect: while the ${quidData.displayedSpecies || quidData.species} was untangling ${pronoun(quidData, 4)} from the net, ${pronoun(quidData, 0)} got entangled and stuck. It looks sprained.*`);
								embed.setFooter({ text: `-${healthPoints} HP (from sprain)\n${changedCondition.statsUpdateText}` });
						}

						userData = await userModel.findOneAndUpdate(
							u => u._id === userData?._id,
							(u) => {
								const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
								p.health -= healthPoints;
								p.injuries = profileData.injuries;
							},
						);
					}

					await sendFinalMessage(interactions.last() || interaction, userData, serverData);
				}
				else if (reason !== 'win') {

					setTimeout(async () => {
						try {

							await changeComponents(interactions.last() || interaction);
							await interactionCollector(interaction, userData, serverData, true);
						}
						catch (error) {

							await sendErrorMessage(interaction, error)
								.catch(e => { console.error(e); });
						}
					}, 1_000);
				}
			}
			catch (error) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
		});
	}

	/**
	 * This function sends the final message
	 */
	async function sendFinalMessage(
		int: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
		userData: UserSchema,
		serverData: ServerSchema,
	) {

		cooldownMap.set(userData._id + interaction.guildId, false);

		const levelUpEmbed = (await checkLevelUp(int, userData, quidData, profileData, serverData)).levelUpEmbed;
		const newComponents = disableAllComponents(componentArray);
		newComponents.push(new ActionRowBuilder<ButtonBuilder>()
			.setComponents(new ButtonBuilder()
				.setCustomId('scavenge_new')
				.setLabel('Scavenge again')
				.setStyle(ButtonStyle.Primary)));

		botReply = await (async (int, messageOptions) => int.isButton() ? await update(int, messageOptions) : await respond(int, messageOptions, true))(int, {
			embeds: [
				...embedArray,
				embed,
				...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
				...(levelUpEmbed ? [levelUpEmbed] : []),
			],
			components: newComponents,
		});

		await isPassedOut(int, userData, quidData, profileData, true);

		await restAdvice(int, userData, profileData);
		await drinkAdvice(int, userData, profileData);
		await eatAdvice(int, userData, profileData);
	}

	/**
	 * This function updates the components for the human trap game
	 */
	async function changeComponents(
		int: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
	) {

		const trapActionRow = new ActionRowBuilder<ButtonBuilder>();
		const correctButton = getRandomNumber(5);
		const humanTrapIncorrectEmojis = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

		for (let i = 0; i < 5; i++) {

			const chosenEmoji = i === correctButton ? humanTrapCorrectEmoji : humanTrapIncorrectEmojis.splice(getRandomNumber(humanTrapIncorrectEmojis.length), 1)[0];
			if (!chosenEmoji) {
				await sendErrorMessage(interaction, new Error('emoji is undefined'))
					.catch((error) => { console.error(error); });
				return;
			}
			trapActionRow.addComponents(new ButtonBuilder()
				.setCustomId(`scavenge_humantrap_${chosenEmoji}`)
				.setEmoji(chosenEmoji)
				.setDisabled(false)
				.setStyle(ButtonStyle.Secondary));
		}

		componentArray = [trapActionRow];
		botReply = await (async (messageOptions) => int.isButton() ? await update(int, messageOptions) : await respond(int, messageOptions, true))({
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData!, quidData, int.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} has been searching for quite some time now, when a mishap happens to ${pronoun(quidData, 1)}. ${upperCasePronounAndPlural(quidData, 0, '\'s', '\'re')} not paying attention for only a moment, and suddenly everything happens very quickly. The ${quidData.displayedSpecies || quidData.species} has fallen into a trap that a human must have set here! Now ${pronoun(quidData, 0)} must quickly catch ${pronoun(quidData, 4)} again and try to free ${pronoun(quidData, 4)} before it comes to an accident.*`)
				.setFooter({ text: `Click the "${humanTrapCorrectEmoji}" as many times as you can!` })],
			components: componentArray,
		});
	}
}