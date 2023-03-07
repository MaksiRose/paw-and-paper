import { AsyncQueue } from '@sapphire/async-queue';
import { ActionRowBuilder, APIActionRowComponent, APIButtonComponent, APISelectMenuComponent, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, InteractionResponse, Message, SlashCommandBuilder } from 'discord.js';
import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, uncommonPlantsInfo } from '../..';
import { Inventory } from '../../typings/data/general';
import { ServerSchema } from '../../typings/data/server';
import { UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, DecreasedStatsData } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { getArrayElement, getMapData, getMessageId, respond, sendErrorMessage, setCooldown, unsafeKeys, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from './attack';

const recoverCooldownProfilesMap: Map<string, number> = new Map();
const twelveHoursInMs = 43_200_000;

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('recover')
		.setDescription('If the pack has no herbs to heal an injury, you can recover your injury using this command.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 6,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user has shared within the last two hours. */
		const recoverCooldown = recoverCooldownProfilesMap.get(quid.id + interaction.guildId);
		if (recoverCooldown && Date.now() - recoverCooldown < twelveHoursInMs) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} walks towards the entrance of the grotto, when an elderly is stopping ${pronoun(quid, 1)}.*\n"Didn't I see you in here in the past 12 hours? You shouldn't use the grotto this often, it's a very precious place that needs to be preserved as much as possible!"\n\nYou can recover again <t:${Math.floor((recoverCooldown + twelveHoursInMs) / 1_000)}:R>.`),
				],
			});
			return;
		}

		let components = [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('recover_wounds')
				.setLabel('Wound')
				.setDisabled(quidToServer.injuries.wounds <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsWounds'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_infections')
				.setLabel('Infection')
				.setDisabled(quidToServer.injuries.infections <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsInfections'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_cold')
				.setLabel('Cold')
				.setDisabled(quidToServer.injuries.cold === false || inventoryHasHealingItem(serverData.inventory, 'healsColds'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_sprains')
				.setLabel('Sprain')
				.setDisabled(quidToServer.injuries.sprains <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsSprains'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_poison')
				.setLabel('Poison')
				.setDisabled(quidToServer.injuries.poison === false || inventoryHasHealingItem(serverData.inventory, 'healsPoison'))
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
				.setDescription(`*${quid.name} walks towards the entrance of the grotto, where an elderly is already waiting for ${pronoun(quid, 1)}.*\n"Do you already know about this place? It has everything needed to heal any injury or illness. This makes it very precious, and so it should only be used in emergencies. So only go here if you can't find anything in the medicine den that can cure you!"\n*The ${getDisplayspecies(quid)} must decide which of their injuries ${pronounAndPlural(quid, 0, 'want')} to heal here.*`)
				.setFooter({ text: 'You can only select an injury when the pack has no herbs that can heal that injury.' })],
			components: components,
			fetchReply: true,
		});

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id, interaction);

		const buttonInteraction = await (botReply as Message<true> | InteractionResponse<true>)
			.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id,
				time: 120_000,
			})
			.catch(() => { return undefined; });

		if (buttonInteraction === undefined) {

			// This is always an editReply
			botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*After careful consideration, ${quid.name} decides that none of ${pronoun(quid, 2)} injuries are urgent enough to use the grotto to regenerate. The ${getDisplayspecies(quid)} might inspect the medicine den for useful plants instead.*`)],
				components: disableAllComponents(components),
			}, 'reply', getMessageId(botReply));
			return;
		}

		await setCooldown(userToServer, true);
		deleteCommandDisablingInfo(userData, interaction.guildId);

		const healKind = buttonInteraction.customId.replace('recover_', '');
		const recoverFieldOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

		const componentArray: ActionRowBuilder<ButtonBuilder>[] = [];
		const possibleEmojis: string[] = [];

		for (let i = 0; i < 3; i++) {

			componentArray.push(new ActionRowBuilder());
			for (let j = 0; j < 3; j++) {

				const chosenEmoji = getArrayElement(recoverFieldOptions.splice(getRandomNumber(recoverFieldOptions.length), 1), 0);

				componentArray[i]?.addComponents(new ButtonBuilder()
					.setCustomId(`recover_${chosenEmoji}`)
					.setEmoji(chosenEmoji)
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary));
				possibleEmojis.push(chosenEmoji);
			}
		}

		// This is always an update to the message with the button
		components = disableAllComponents(componentArray);
		botReply = await respond(buttonInteraction, {
			content: messageContent,
			components: components,
		}, 'update', buttonInteraction.message.id);

		startNewRound(buttonInteraction, userData, serverData, []);


		/**
		 * It displays a sequence of emojis, and the user has to click them in the same order
		 * @param emojisToClick - An array of emojis that the user has to click in order.
		 */
		async function startNewRound(
			interaction: ButtonInteraction<'cached'>,
			userData: UserData<never, never>,
			serverData: ServerSchema,
			emojisToClick: string[],
		): Promise<void> {

			for (let index = 0; index < 3; index++) {

				const randomEmoji = getArrayElement(possibleEmojis, getRandomNumber(possibleEmojis.length));
				emojisToClick.push(randomEmoji);
			}
			let displayingEmoji = 0;
			let choosingEmoji = 0;

			(function(
				interaction: ButtonInteraction<'cached'>,
				userData: UserData<never, never>,
				serverData: ServerSchema,
				callback: (
					interaction: ButtonInteraction<'cached'>,
					userData: UserData<never, never>,
					serverData: ServerSchema
				) => Promise<void>,
			) {

				const viewingInterval = setInterval(async function() {

					try {
						// This is always editReply;
						botReply = await respond(interaction, {
							content: messageContent,
							embeds: [new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(drawEmojibar(displayingEmoji, emojisToClick))
								.setFooter({ text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' })],
							components: displayingEmoji === emojisToClick.length ? enableAllComponents(componentArray.map(c => c.toJSON())) : components,
						}, 'reply', getMessageId(botReply));

						if (displayingEmoji === emojisToClick.length) {

							clearInterval(viewingInterval);
							callback(interaction, userData, serverData);
							return;
						}

						displayingEmoji += 1;
					}
					catch (error) {

						await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
						clearInterval(viewingInterval);
					}
				}, 2_000);
			})(interaction, userData, serverData, async function(
				interaction: ButtonInteraction<'cached'>,
				userData: UserData<never, never>,
				serverData: ServerSchema,
			) {

				const collector = (botReply as Message<true> | InteractionResponse<true>).createMessageComponentCollector({
					componentType: ComponentType.Button,
					filter: i => i.user.id === interaction.user.id,
					idle: 10_000,
				});
				const queue = new AsyncQueue();
				let thisRoundEmojisClicked = 0;

				collector.on('collect', async (int) => {
					await queue.wait();
					try {

						if (collector.ended) { return; }

						thisRoundEmojisClicked += 1;
						choosingEmoji += 1;

						if (int.customId.replace('recover_', '') === emojisToClick[choosingEmoji - 1]) {

							botReply = await respond(int, {
								content: messageContent,
								embeds: [new EmbedBuilder()
									.setColor(quid.color)
									.setAuthor({
										name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
										iconURL: quid.avatarURL,
									})
									.setDescription('✅'.repeat(choosingEmoji - 1) + '✅')
									.setFooter({ text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' })],
								components: choosingEmoji === emojisToClick.length ? disableAllComponents(componentArray) : undefined,
							}, 'update', int.message.id);
							if (emojisToClick.length >= thisRoundEmojisClicked) { collector.stop('max'); }
						}
						else {

							collector.stop('failed');
							return;
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

						const lastInteraction = interactions.last() ?? interaction;
						let changedCondition: DecreasedStatsData;

						let embed: EmbedBuilder;
						if (reason === 'failed' || reason === 'idle') {

							changedCondition = await changeCondition(quidToServer, quid, 0);

							embed = new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription('✅'.repeat((choosingEmoji || 1) - 1) + '❌\n\n' + `*${quid.name} makes every effort to take full advantage of the grotto to heal ${pronoun(quid, 2)} own injuries. But ${pronounAndPlural(quid, 0, 'just doesn\'t', 'just don\'t')} seem to get better. The ${getDisplayspecies(quid)} may have to try again...*`);
							if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
						}
						else if (emojisToClick.length < 12) {

							await startNewRound(lastInteraction, userData, serverData, emojisToClick);
							return;
						}
						else {

							recoverCooldownProfilesMap.set(quid.id + interaction.guildId, Date.now());

							let injuryText = '';

							if (healKind === 'wounds') {

								injuryText += `\n-1 wound for ${quid.name}`;
								quidToServer.injuries.wounds -= 1;
							}

							if (healKind === 'infections') {

								injuryText += `\n-1 infection for ${quid.name}`;
								quidToServer.injuries.infections -= 1;
							}

							if (healKind === 'cold') {

								injuryText += `\ncold healed for ${quid.name}`;
								quidToServer.injuries.cold = false;
							}

							if (healKind === 'sprains') {

								injuryText += `\n-1 sprain for ${quid.name}`;
								quidToServer.injuries.sprains -= 1;
							}

							if (healKind === 'poison') {

								injuryText += `\npoison healed for ${quid.name}`;
								quidToServer.injuries.poison = false;
							}

							await userData.update(
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
									p.injuries = quidToServer.injuries;
								},
							);

							changedCondition = await changeCondition(quidToServer, quid, 0);

							embed = new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*The cave is a pleasant place, with a small pond of crystal clear water, stalagmites, stalactites and stalagnates, and cool, damp air. Some stones glisten slightly, giving the room a magical atmosphere. ${quid.name} does not have to stay here for long before ${pronounAndPlural(quid, 0, 'feel')} much better.*`)
								.setFooter({ text: `${changedCondition.statsUpdateText}\n${injuryText}` });
						}

						const levelUpEmbed = await checkLevelUp(lastInteraction, userData, serverData);

						botReply = await respond(lastInteraction, {
							content: messageContent,
							embeds: [
								embed,
								...changedCondition.injuryUpdateEmbed,
								...levelUpEmbed,
							],
							components: disableAllComponents(componentArray),
						}, 'update', lastInteraction.message.id);

						await isPassedOut(lastInteraction, userData, true);

						await restAdvice(lastInteraction, userData);
						await drinkAdvice(lastInteraction, userData);
						await eatAdvice(lastInteraction, userData);

						await setCooldown(userToServer, false);
					}
					catch (error) {

						await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					}
				});
			});
		}

	},
};

function inventoryHasHealingItem(
	{ commonPlants, uncommonPlants, rarePlants, specialPlants }: Inventory,
	healingKind: 'healsWounds' | 'healsInfections' | 'healsColds' | 'healsSprains' | 'healsPoison',
): boolean {

	const allPlantsInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };
	const _inventory: Omit<Inventory, 'meat' | 'materials'> = { commonPlants, uncommonPlants, rarePlants, specialPlants };

	const inventory_ = widenValues(_inventory);
	for (const itemType of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itemType])) {

			if (inventory_[itemType][item] > 0 && allPlantsInfo[item][healingKind]) { return true; }
		}
	}

	return false;
}

/**
 * Draws a string of emojis with X emojis based on a default emoji and a replacement emoji that is drawn in between based on its index.
 * @param index - The position where the array item shouldn't be replaced
 * @param array - The array that should be replaced
 * @returns The string of emojis.
 */
function drawEmojibar(
	index: number,
	array: string[],
): string {

	const newArray = [];

	for (let position = 0; position < index + 1; position++) {

		newArray[position] = (position !== index) ? '⬛' : array[index];
	}

	return newArray.join('');
}

/**
 * Goes through all components in a message and enables them.
 */
function enableAllComponents(
	messageComponents: Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>>,
): Array<APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>> {

	for (const actionRow in messageComponents) {

		const messageComponent = messageComponents[actionRow];
		if (!messageComponent) { return messageComponents; }
		for (const component in messageComponent.components) {

			const actionRowComponent = messageComponent.components[component];
			if (!actionRowComponent || (actionRowComponent.type === ComponentType.Button && actionRowComponent.style === ButtonStyle.Link)) { continue; }
			actionRowComponent.disabled = false;
		}
	}

	return messageComponents;
}