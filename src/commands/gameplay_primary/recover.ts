import { AsyncQueue } from '@sapphire/async-queue';
import { ActionRowBuilder, APIActionRowComponent, APIButtonComponent, APISelectMenuComponent, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, InteractionResponse, Message, SlashCommandBuilder } from 'discord.js';
import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, uncommonPlantsInfo } from '../../cluster';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, DecreasedStatsData } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { getArrayElement, getMessageId, keyInObject, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

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
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} walks towards the entrance of the grotto, when an elderly is stopping ${pronoun(quid, 1)}.*\n"Didn't I see you in here in the past 12 hours? You shouldn't use the grotto this often, it's a very precious place that needs to be preserved as much as possible!"\n\nYou can recover again <t:${Math.floor((recoverCooldown + twelveHoursInMs) / 1_000)}:R>.`),
				],
			});
			return;
		}

		const components = [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId('recover_wounds')
				.setLabel('Wound')
				.setDisabled(quidToServer.injuries_wounds <= 0 || inventoryHasHealingItem(server.inventory, 'healsWounds'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_infections')
				.setLabel('Infection')
				.setDisabled(quidToServer.injuries_infections <= 0 || inventoryHasHealingItem(server.inventory, 'healsInfections'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_cold')
				.setLabel('Cold')
				.setDisabled(quidToServer.injuries_cold === false || inventoryHasHealingItem(server.inventory, 'healsColds'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_sprains')
				.setLabel('Sprain')
				.setDisabled(quidToServer.injuries_sprains <= 0 || inventoryHasHealingItem(server.inventory, 'healsSprains'))
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('recover_poison')
				.setLabel('Poison')
				.setDisabled(quidToServer.injuries_poison === false || inventoryHasHealingItem(server.inventory, 'healsPoison'))
				.setStyle(ButtonStyle.Secondary),
			]),
		];

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} walks towards the entrance of the grotto, where an elderly is already waiting for ${pronoun(quid, 1)}.*\n"Do you already know about this place? It has everything needed to heal any injury or illness. This makes it very precious, and so it should only be used in emergencies. So only go here if you can't find anything in the medicine den that can cure you!"\n*The ${getDisplayspecies(quid)} must decide which of their injuries ${pronounAndPlural(quid, 0, 'want')} to heal here.*`)
				.setFooter({ text: 'You can only select an injury when the pack has no herbs that can heal that injury.' })],
			components: components,
		});
	},
	sendMessageComponentResponse: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!interaction.isButton()) { return; }
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		let restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }
		restEmbed = restEmbed.length <= 0 && interaction.message.embeds.length > 1 ? [EmbedBuilder.from(interaction.message.embeds[0]!)] : [];

		const messageContent = remindOfAttack(interaction.guildId);

		const healKind = interaction.customId.replace('recover_', '');

		if ((healKind === 'wounds' && (
			quidToServer.injuries_wounds <= 0 || inventoryHasHealingItem(server.inventory, 'healsWounds')
		))
			|| (healKind === 'infections' && (
				quidToServer.injuries_infections <= 0 || inventoryHasHealingItem(server.inventory, 'healsInfections')
			))
			|| (healKind === 'cold' && (
				quidToServer.injuries_cold === false || inventoryHasHealingItem(server.inventory, 'healsColds')
			))
			|| (healKind === 'sprains' && (
				quidToServer.injuries_sprains <= 0 || inventoryHasHealingItem(server.inventory, 'healsSprains')
			))
			|| (healKind === 'poison' && (
				quidToServer.injuries_poison === false || inventoryHasHealingItem(server.inventory, 'healsPoison')
			))) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setTitle(`${quid.name}'s condition or the server's inventory changed. Please try again.`)],
			}, 'update', interaction.message.id);
			return;
		}

		await setCooldown(userToServer, true);

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
		const components = disableAllComponents(componentArray);
		let botReply = await respond(interaction, {
			content: messageContent,
			components: components,
		}, 'update', interaction.message.id);

		startNewRound(interaction, user, userToServer, quid, quidToServer, []);


		/**
		 * It displays a sequence of emojis, and the user has to click them in the same order
		 * @param emojisToClick - An array of emojis that the user has to click in order.
		 */
		async function startNewRound(
			interaction: ButtonInteraction<'cached'>,
			user: User,
			userToServer: UserToServer,
			quid: Quid<true>,
			quidToServer: QuidToServer,
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
				user: User,
				userToServer: UserToServer,
				quid: Quid<true>,
				quidToServer: QuidToServer,
				callback: (
					interaction: ButtonInteraction<'cached'>,
					user: User,
					userToServer: UserToServer,
					quid: Quid<true>,
					quidToServer: QuidToServer,
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
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(drawEmojibar(displayingEmoji, emojisToClick))
								.setFooter({ text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' })],
							components: displayingEmoji === emojisToClick.length ? enableAllComponents(componentArray.map(c => c.toJSON())) : components,
						}, 'reply', getMessageId(botReply));

						if (displayingEmoji === emojisToClick.length) {

							clearInterval(viewingInterval);
							callback(interaction, user, userToServer, quid, quidToServer);
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
			})(interaction, user, userToServer, quid, quidToServer, async function(
				interaction: ButtonInteraction<'cached'>,
				user: User,
				userToServer: UserToServer,
				quid: Quid<true>,
				quidToServer: QuidToServer,
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
										name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
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
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription('✅'.repeat((choosingEmoji || 1) - 1) + '❌\n\n' + `*${quid.name} makes every effort to take full advantage of the grotto to heal ${pronoun(quid, 2)} own injuries_ But ${pronounAndPlural(quid, 0, 'just doesn\'t', 'just don\'t')} seem to get better. The ${getDisplayspecies(quid)} may have to try again...*`);
							if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
						}
						else if (emojisToClick.length < 12) {

							await startNewRound(lastInteraction, user, userToServer, quid, quidToServer, emojisToClick);
							return;
						}
						else {

							recoverCooldownProfilesMap.set(quid.id + interaction.guildId, Date.now());

							let injuryText = '';

							if (healKind === 'wounds') {

								injuryText += `\n-1 wound for ${quid.name}`;
								quidToServer.injuries_wounds -= 1;
							}

							if (healKind === 'infections') {

								injuryText += `\n-1 infection for ${quid.name}`;
								quidToServer.injuries_infections -= 1;
							}

							if (healKind === 'cold') {

								injuryText += `\ncold healed for ${quid.name}`;
								quidToServer.injuries_cold = false;
							}

							if (healKind === 'sprains') {

								injuryText += `\n-1 sprain for ${quid.name}`;
								quidToServer.injuries_sprains -= 1;
							}

							if (healKind === 'poison') {

								injuryText += `\npoison healed for ${quid.name}`;
								quidToServer.injuries_poison = false;
							}

							await quidToServer.update({
								injuries_wounds: quidToServer.injuries_wounds,
								injuries_infections: quidToServer.injuries_infections,
								injuries_cold: quidToServer.injuries_cold,
								injuries_sprains: quidToServer.injuries_sprains,
								injuries_poison: quidToServer.injuries_poison,
							});

							changedCondition = await changeCondition(quidToServer, quid, 0);

							embed = new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*The cave is a pleasant place, with a small pond of crystal clear water, stalagmites, stalactites and stalagnates, and cool, damp air. Some stones glisten slightly, giving the room a magical atmosphere. ${quid.name} does not have to stay here for long before ${pronounAndPlural(quid, 0, 'feel')} much better.*`)
								.setFooter({ text: `${changedCondition.statsUpdateText}\n${injuryText}` });
						}

						const members = await updateAndGetMembers(user.id, interaction.guild);
						const levelUpEmbed = await checkLevelUp(lastInteraction, quid, quidToServer, members);

						botReply = await respond(lastInteraction, {
							content: messageContent,
							embeds: [
								embed,
								...changedCondition.injuryUpdateEmbed,
								...levelUpEmbed,
							],
							components: disableAllComponents(componentArray),
						}, 'update', lastInteraction.message.id);

						await isPassedOut(lastInteraction, user, userToServer, quid, quidToServer, true);

						await restAdvice(lastInteraction, user, quidToServer);
						await drinkAdvice(lastInteraction, user, quidToServer);
						await eatAdvice(lastInteraction, user, quidToServer);

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
	inventory: string[],
	healingKind: 'healsWounds' | 'healsInfections' | 'healsColds' | 'healsSprains' | 'healsPoison',
): boolean {

	const allPlantsInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

	for (const item of inventory) {

		if (keyInObject(allPlantsInfo, item) && allPlantsInfo[item][healingKind]) { return true; }
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