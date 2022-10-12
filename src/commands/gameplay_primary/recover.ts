import { ActionRowBuilder, APIActionRowComponent, APIButtonComponent, APISelectMenuComponent, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { commonPlantsInfo, Inventory, rarePlantsInfo, ServerSchema, SlashCommand, specialPlantsInfo, uncommonPlantsInfo, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, DecreasedStatsData } from '../../utils/changeCondition';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getArrayElement, getMapData, getQuidDisplayname, respond, sendErrorMessage, unsafeKeys, update, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
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
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		let quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		let profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user has shared within the last two hours. */
		const recoverCooldown = recoverCooldownProfilesMap.get(quidData._id + interaction.guildId);
		if (recoverCooldown && Date.now() - recoverCooldown < twelveHoursInMs) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} walks towards the entrance of the grotto, when an elderly is stopping ${pronoun(quidData, 1)}.*\n"Didn't I see you in here in the past 12 hours? You shouldn't use the grotto this often, it's a very precious place that needs to be preserved as much as possible!"\n\nYou can recover again <t:${Math.floor((recoverCooldown + twelveHoursInMs) / 1_000)}:R>.`),
				],
			}, false);
			return;
		}

		let botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} walks towards the entrance of the grotto, where an elderly is already waiting for ${pronoun(quidData, 1)}.*\n"Do you already know about this place? It has everything needed to heal any injury or illness. This makes it very precious, and so it should only be used in emergencies. So only go here if you can't find anything in the medicine den that can cure you!"\n*The ${quidData.displayedSpecies || quidData.species} must decide which of their injuries ${pronounAndPlural(quidData, 0, 'want')} to heal here.*`)
				.setFooter({ text: 'You can only select an injury when the pack has no herbs that can heal that injury.' })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId('recover_wounds')
					.setLabel('Wound')
					.setDisabled(profileData.injuries.wounds <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsWounds'))
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('recover_infections')
					.setLabel('Infection')
					.setDisabled(profileData.injuries.infections <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsInfections'))
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('recover_cold')
					.setLabel('Cold')
					.setDisabled(profileData.injuries.cold === false || inventoryHasHealingItem(serverData.inventory, 'healsColds'))
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('recover_sprains')
					.setLabel('Sprain')
					.setDisabled(profileData.injuries.sprains <= 0 || inventoryHasHealingItem(serverData.inventory, 'healsSprains'))
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('recover_poison')
					.setLabel('Poison')
					.setDisabled(profileData.injuries.poison === false || inventoryHasHealingItem(serverData.inventory, 'healsPoison'))
					.setStyle(ButtonStyle.Secondary),
				]),
			],
		}, true);

		createCommandComponentDisabler(userData._id, interaction.guildId, botReply);

		const buttonInteraction = await botReply
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				time: 120_000,
			})
			.catch(() => { return undefined; });

		if (buttonInteraction === undefined) {

			botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*After careful consideration, ${quidData.name} decides that none of ${pronoun(quidData, 2)} injuries are urgent enough to use the grotto to regenerate. The ${quidData.displayedSpecies || quidData.species} might inspect the medicine den for useful plants instead.*`)],
				components: disableAllComponents(botReply.components),
			}, true);
			return;
		}

		cooldownMap.set(userData._id + interaction.guildId, true);
		delete disableCommandComponent[userData._id + interaction.guildId];

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

		botReply = await update(buttonInteraction, {
			content: messageContent,
			components: disableAllComponents(componentArray),
		});

		startNewRound(interaction, userData, serverData, []);


		/**
		 * It displays a sequence of emojis, and the user has to click them in the same order
		 * @param emojisToClick - An array of emojis that the user has to click in order.
		 */
		async function startNewRound(
			interaction: ChatInputCommandInteraction<'cached'>,
			userData: UserSchema,
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
				interaction: ChatInputCommandInteraction<'cached'>,
				userData: UserSchema,
				serverData: ServerSchema,
				callback: (
					interaction: ChatInputCommandInteraction<'cached'>,
					userData: UserSchema,
					serverData: ServerSchema
				) => Promise<void>,
			) {

				const viewingInterval = setInterval(async function() {

					botReply = await botReply
						.edit({
							content: messageContent,
							embeds: [new EmbedBuilder()
								.setColor(quidData.color)
								.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
								.setDescription(drawEmojibar(displayingEmoji, emojisToClick))
								.setFooter({ text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' })],
							components: displayingEmoji === emojisToClick.length ? enableAllComponents(componentArray.map(c => c.toJSON())) : botReply.components,
						});

					if (displayingEmoji === emojisToClick.length) {

						clearInterval(viewingInterval);
						callback(interaction, userData, serverData);
						return;
					}

					displayingEmoji += 1;
				}, 2_000);
			})(interaction, userData, serverData, async function(
				interaction: ChatInputCommandInteraction<'cached'>,
				userData: UserSchema,
				serverData: ServerSchema,
			) {

				const collector = (botReply as Message<true>).createMessageComponentCollector({
					filter: i => i.user.id === interaction.user.id,
					idle: 10_000,
					max: emojisToClick.length,
				});

				collector.on('collect', async (int) => {
					try {

						choosingEmoji += 1;

						if (int.customId.replace('recover_', '') === emojisToClick[choosingEmoji - 1]) {

							botReply = await update(int, {
								content: messageContent,
								embeds: [new EmbedBuilder()
									.setColor(quidData.color)
									.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
									.setDescription('✅'.repeat(choosingEmoji - 1) + '✅')
									.setFooter({ text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' })],
								components: choosingEmoji === emojisToClick.length ? disableAllComponents(componentArray) : undefined,
							});
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
				});

				collector.on('end', async (interactions, reason) => {
					try {

						let changedCondition: DecreasedStatsData;

						let embed: EmbedBuilder;
						if (reason === 'failed' || reason === 'idle') {

							changedCondition = await changeCondition(userData, quidData, profileData, 0);
							profileData = changedCondition.profileData;

							embed = new EmbedBuilder()
								.setColor(quidData.color)
								.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
								.setDescription('✅'.repeat((choosingEmoji || 1) - 1) + '❌\n\n' + `*${quidData.name} makes every effort to take full advantage of the grotto to heal ${pronoun(quidData, 2)} own injuries. But ${pronounAndPlural(quidData, 0, 'just doesn\'t', 'just don\'t')} seem to get better. The ${quidData.displayedSpecies || quidData.species} may have to try again...*`);
							if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
						}
						else if (emojisToClick.length < 12) {

							await startNewRound(interaction, userData, serverData, emojisToClick);
							return;
						}
						else {

							recoverCooldownProfilesMap.set(quidData._id + interaction.guildId, Date.now());

							let injuryText = '';

							if (healKind === 'wounds') {

								injuryText += `\n-1 wound for ${quidData.name}`;
								profileData.injuries.wounds -= 1;
							}

							if (healKind === 'infections') {

								injuryText += `\n-1 infection for ${quidData.name}`;
								profileData.injuries.infections -= 1;
							}

							if (healKind === 'cold') {

								injuryText += `\ncold healed for ${quidData.name}`;
								profileData.injuries.cold = false;
							}

							if (healKind === 'sprains') {

								injuryText += `\n-1 sprain for ${quidData.name}`;
								profileData.injuries.sprains -= 1;
							}

							if (healKind === 'poison') {

								injuryText += `\npoison healed for ${quidData.name}`;
								profileData.injuries.poison = false;
							}

							userData = await userModel.findOneAndUpdate(
								u => u._id === userData._id,
								(u) => {
									const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
									p.injuries = profileData.injuries;
								},
							);
							quidData = getMapData(userData.quids, quidData._id);
							profileData = getMapData(quidData.profiles, interaction.guildId);

							changedCondition = await changeCondition(userData, quidData, profileData, 0);
							profileData = changedCondition.profileData;

							embed = new EmbedBuilder()
								.setColor(quidData.color)
								.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
								.setDescription(`*The cave is a pleasant place, with a small pond of crystal clear water, stalagmites, stalactites and stalagnates, and cool, damp air. Some stones glisten slightly, giving the room a magical atmosphere. ${quidData.name} does not have to stay here for long before ${pronounAndPlural(quidData, 0, 'feel')} much better.*`)
								.setFooter({ text: `${changedCondition.statsUpdateText}\n${injuryText}` });
						}

						const lastInteraction = interactions.last() || interaction;
						const levelUpCheck = await checkLevelUp(lastInteraction, userData, quidData, profileData, serverData);
						profileData = levelUpCheck.profileData;

						botReply = await (async function(messageObject) { return lastInteraction.isMessageComponent() ? await update(lastInteraction, messageObject) : await respond(lastInteraction, messageObject, true); })({
							content: messageContent,
							embeds: [
								embed,
								...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
								...(levelUpCheck.levelUpEmbed ? [levelUpCheck.levelUpEmbed] : [])],
							components: disableAllComponents(componentArray),
						});

						await isPassedOut(lastInteraction, userData, quidData, profileData, true);

						await restAdvice(lastInteraction, userData, profileData);
						await drinkAdvice(lastInteraction, userData, profileData);
						await eatAdvice(lastInteraction, userData, profileData);

						cooldownMap.set(userData._id + interaction.guildId, false);
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