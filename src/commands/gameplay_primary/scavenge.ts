import { AsyncQueue } from '@sapphire/async-queue';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionResponse, Message, SlashCommandBuilder } from 'discord.js';
import { speciesInfo } from '../..';
import { ServerSchema } from '../../typings/data/server';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { addExperience, changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';
import { capitalize, getArrayElement, getMapData, getMessageId, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { pickMaterial, pickMeat, simulateMaterialUse, simulateMeatUse } from '../../utils/simulateItemUse';
import { remindOfAttack } from './attack';

type CustomIdArgs = ['new']

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('scavenge')
		.setDescription('Roam around near the pack for a chance to find carcass and materials. Not available to Younglings.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 3,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		await executeScavenging(interaction, userData, serverData);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (interaction.isButton() && customId?.args[0] === 'new') {

			await executeScavenging(interaction, userData, serverData);
		}
	},
};

async function executeScavenging(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | null,
): Promise<void> {

	/* This ensures that the user is in a guild and has a completed account. */
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

	/* It's disabling all components if userData exists and the command is set to disable a previous command. */
	if (command.disablePreviousCommand) { await disableCommandComponent(userData); }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, userData);
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
				.setDescription(`*A hunter cuts ${quid.name} as they see ${pronoun(quid, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${quidToServer.rank}," *they say.*`)],
		});
		return;
	}

	if (await hasFullInventory(interaction, userData, restEmbed, messageContent)) { return; } // This is always a reply

	await setCooldown(userData, interaction.guildId, true);

	let experiencePoints = getRandomNumber(5, quidToServer.levels);
	const changedCondition = await changeCondition(userData, 0);

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

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
				.setCustomId(`board_${i}_${j}`)
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

	// This is always a reply
	let botReply = await respond(interaction, {
		content: messageContent,
		embeds: [...restEmbed, new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setDescription(`*${quid.name} carefully examines the terrain around the pack, hoping to find useful materials or carcasses. The ${getDisplayspecies(quid)} must now prove prudence and a keen eye...*`)
			.setFooter({ text: 'Click the fields to reveal what\'s underneath. Based on how close you are to the correct field, a color on a scale from green (closest) to red (farthest) is going to appear. You can click 4 times and have 2 minutes to win.' })],
		components: componentArray,
	});

	await interactionCollector(interaction, userData, serverData, false);

	async function interactionCollector(
		interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
		userData: UserData<never, never>,
		serverData: ServerSchema,
		isHumanTrap: boolean,
	): Promise<void> {

		let correctButtonPresses = 0;

		/* Creating a collector that will collect the interactions of the user with the message. */
		const collector = (botReply as Message<true> | InteractionResponse<true>).createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			componentType: ComponentType.Button,
			time: isHumanTrap ? 12_000 : 120_000,
		});
		const queue = new AsyncQueue();

		collector.on('collect', async int => {
			await queue.wait();
			try {

				if (collector.ended) { return; }

				/* It's checking if the customId of the button includes the word `board-`, which means that it is part of the scavenge game, or if the customId of the button includes the  word `humantrap-`, which means that it is part of the humantrap game. */
				if (int.customId.includes('board_')) {

					correctButtonPresses += 1;
					/* Getting the position of the button that the user clicked. */
					const verticalBoardPosition = Number(int.customId.split('_')[1]);
					const horizontalBoardPosition = Number(int.customId.split('_')[2]);
					const buttonInBoardPosition = getArrayElement(getArrayElement(componentArray, verticalBoardPosition).components, horizontalBoardPosition);

					/* Set the emoji of the button to the emoji in the gamePositionsArray. It will then disable the button. */
					const emoji = getArrayElement(getArrayElement(gamePositionsArray, verticalBoardPosition), horizontalBoardPosition);
					buttonInBoardPosition.setEmoji(emoji);
					buttonInBoardPosition.setDisabled(true);

					/* Checking if the user has clicked on the correct field. If they have, it will stop the collector and if they haven't, it will edit the message with the new components. */
					if (emoji === filledFieldArray[0]) {

						const playingField = componentArray.map(c => c.components.map(b => b.data.emoji?.name ?? unclickedField).join('')).join('\n');
						componentArray = [];

						const meatCount = Math.round((await simulateMeatUse(serverData, true) + await simulateMeatUse(serverData, true) + await simulateMeatUse(serverData, false)) / 3);
						const materialCount = Math.round((await simulateMaterialUse(serverData, true) + await simulateMaterialUse(serverData, true) + await simulateMaterialUse(serverData, false)) / 3);

						/* Checking if the server has enough meat, if it doesn't, give the user meat. If it does, check if the server has enough materials, if it doesn't, give the user material. If it does, do nothing. */
						if (meatCount < 0 && pullFromWeightedTable({ 0: -meatCount, 1: -materialCount }) === 0) {

							const carcassArray = [...speciesInfo[quid.species].biome1OpponentArray];
							const foundCarcass = pickMeat(carcassArray, serverData.inventory);
							if (!foundCarcass) {
								await sendErrorMessage(interaction, new Error('foundCarcass is undefined'))
									.catch((error) => { console.error(error); });
								return;
							}

							embed.setDescription(`*After a while, ${quid.name} can indeed find something useful: On the floor is a ${foundCarcass} that seems to have recently lost a fight fatally. Although the animal has a few injuries, it can still serve as great nourishment. What a success!*\n${playingField}`);
							embed.setFooter({ text: `${addExperience(userData, experiencePoints)}\n${changedCondition.statsUpdateText}\n\n+1 ${foundCarcass}` });

							await userData.update(
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									p.inventory.meat[foundCarcass] += 1;
								},
							);
						}
						else if (materialCount < 0) {

							const foundMaterial = pickMaterial(serverData.inventory);
							if (!foundMaterial) {
								await sendErrorMessage(interaction, new Error('foundMaterial is undefined'))
									.catch((error) => { console.error(error); });
								return;
							}

							embed.setDescription(`*${quid.name} searches in vain for edible remains of deceased animals. But the expedition is not without success: the ${getDisplayspecies(quid)} sees a ${foundMaterial}, which can serve as a great material for repairs and work in the pack. ${capitalize(pronoun(quid, 0))} happily takes it home with ${pronoun(quid, 1)}.*\n${playingField}`);
							embed.setFooter({ text: `${addExperience(userData, experiencePoints)}\n${changedCondition.statsUpdateText}\n\n+1 ${foundMaterial}` });

							await userData.update(
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									p.inventory.materials[foundMaterial] += 1;
								},
							);
						}
						else {

							embed.setDescription(`*Although ${quid.name} searches everything very thoroughly, there doesn't seem to be anything in the area that can be used at the moment. Probably everything has already been found. The ${getDisplayspecies(quid)} decides to look again later.*\n${playingField}`);
							if (changedCondition.statsUpdateText) { embed.setFooter({ text: `${addExperience(userData, experiencePoints)}\n${changedCondition.statsUpdateText}` }); }
						}

						await sendFinalMessage(int, userData, serverData);
						collector.stop('win');
					}
					else {

						// This is always an update
						botReply = await respond(int, { components: correctButtonPresses < 4 ? componentArray : disableAllComponents(componentArray) }, 'update', int.message.id);
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
			finally {
				queue.shift();
			}
		});

		collector.on('end', async (interactions, reason) => {
			queue.abortAll();
			try {

				/* The below code is checking if the user has finished the game or not. If the user has finished the game, it will check if the server has enough meat and materials. If it doesn't, it will give the user meat or  materials. If it does, it will do nothing. If the user has lost the game, it will check if the user has lost the human trap game as well. If they did, it will add an injury to the user. If the game is not finished, start the human trap game. */
				if (isHumanTrap) {

					/* Creating a weighted table with the probability of the player not being hurt being equal to the number of correct button presses. */
					const isHurt = pullFromWeightedTable({ 0: correctButtonPresses, 1: 10 - correctButtonPresses });

					/* Checking if the user is hurt or not. If the user is hurt, it will subtract health points from the user and give them an injury. */
					if (isHurt == 0) {

						experiencePoints = Math.round(experiencePoints / 2);
						embed.setDescription(`*After ${quid.name} gets over the initial shock, the ${getDisplayspecies(quid)} quickly manages to free ${pronoun(quid, 4)} from the net. That was close!*`);
						embed.setFooter({ text: `${addExperience(userData, experiencePoints)}\n${changedCondition.statsUpdateText}` });
					}
					else {

						const healthPoints = function(health) { return (quidToServer.health - health < 0) ? quidToServer.health : health; }(getRandomNumber(5, 3));

						switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

							case 0:

								quidToServer.injuries.infections += 1;

								embed.setDescription(`*${quid.name} is still shocked for a while, but finally manages to free ${pronoun(quid, 4)}. Not long after, however, ${pronounAndPlural(quid, 0, 'feel')} a shock wave run through ${pronoun(quid, 2)} body. Something sharp must have pressed into the ${getDisplayspecies(quid)}. It looks infected.*`);
								embed.setFooter({ text: `-${healthPoints} HP (from infection)\n${changedCondition.statsUpdateText}` });

								break;

							default:

								quidToServer.injuries.sprains += 1;

								embed.setDescription(`*${quid.name} is still shocked for a while, but finally manages to free ${pronoun(quid, 4)}. But the escape was not perfect: while the ${getDisplayspecies(quid)} was untangling ${pronoun(quid, 4)} from the net, ${pronoun(quid, 0)} got entangled and stuck. It looks sprained.*`);
								embed.setFooter({ text: `-${healthPoints} HP (from sprain)\n${changedCondition.statsUpdateText}` });
						}

						await userData.update(
							(u) => {
								const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
								p.health -= healthPoints;
								p.injuries = quidToServer.injuries;
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
		userData: UserData<never, never>,
		serverData: ServerSchema,
	) {

		await setCooldown(userData, int.guildId, false);

		const levelUpEmbed = await checkLevelUp(int, userData, serverData);

		const newComponents = disableAllComponents(componentArray);
		newComponents.push(new ActionRowBuilder<ButtonBuilder>()
			.setComponents(new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.id, ['new']))
				.setLabel('Scavenge again')
				.setStyle(ButtonStyle.Primary)));

		// This is only a reply if the user never pressed a button, else this is an update
		await respond(int, {
			embeds: [
				...(restEmbed as EmbedBuilder[]),
				embed,
				...changedCondition.injuryUpdateEmbed,
				...levelUpEmbed,
			],
			components: newComponents,
		}, 'update', int.isMessageComponent() ? int.message.id : getMessageId(botReply));

		await isPassedOut(int, userData, true);

		await restAdvice(int, userData);
		await drinkAdvice(int, userData);
		await eatAdvice(int, userData);
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
				.setCustomId(`humantrap_${chosenEmoji}`)
				.setEmoji(chosenEmoji)
				.setDisabled(false)
				.setStyle(ButtonStyle.Secondary));
		}

		componentArray = [trapActionRow];
		// This is only a reply if the user never pressed a button, else this is an update
		await respond(int, {
			embeds: [...(restEmbed as EmbedBuilder[]), new EmbedBuilder()
				.setColor(userData!.quid!.color)
				.setAuthor({ name: userData!.quid!.getDisplayname(), iconURL: userData!.quid!.avatarURL })
				.setDescription(`*${userData!.quid!.name} has been searching for quite some time now, when a mishap happens to ${userData!.quid!.pronoun(1)}. ${capitalize(userData!.quid!.pronounAndPlural(0, '\'s', '\'re'))} not paying attention for only a moment, and suddenly everything happens very quickly. The ${userData!.quid!.getDisplayspecies()} has fallen into a trap that a human must have set here! Now ${userData!.quid!.pronoun(0)} must catch ${userData!.quid!.pronoun(4)} again quickly and try to get free before there is an accident.*`)
				.setFooter({ text: `Click the "${humanTrapCorrectEmoji}" as many times as you can!` })],
			components: componentArray,
		}, 'update', int.isMessageComponent() ? int.message.id : getMessageId(botReply));
	}
}