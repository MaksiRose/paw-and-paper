// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { decreaseHunger, decreaseThirst, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap } = require('../../utils/itemsInfo');
const { generateRandomNumber } = require('../../utils/randomizers');
const isInGuild = require('../../utils/isInGuild');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('./attack');
const recoverCooldownProfilesMap = new Map();

module.exports.name = 'recover';
module.exports.aliases = ['regenerate'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, module.exports.aliases.concat(module.exports.name))) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (recoverCooldownProfilesMap.has('nr' + characterData._id + profileData.serverId) && Date.now() - recoverCooldownProfilesMap.get('nr' + characterData._id + profileData.serverId) < 43_200_000) {

		await message
			.reply({
				content: messageContent,
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} walks towards the entrance of the grotto, when an elderly is stopping ${pronoun(characterData, 1)}.*\n"Didn't I see you in here in the past 12 hours? You shouldn't use the grotto this often, it's a very precious place that needs to be preserved as much as possible!"\n\nYou can recover again in <t:${Math.floor((recoverCooldownProfilesMap.get('nr' + characterData._id + profileData.serverId) + 43_200_000) / 1_000)}:R>.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const serverInventory = Object.entries({ ...serverData.inventory.commonPlants, ...serverData.inventory.uncommonPlants, ...serverData.inventory.rarePlants })
		.filter(([, value]) => value > 0);
	const allPlantMaps = new Map([...commonPlantsMap, ...uncommonPlantsMap, ...rarePlantsMap]);

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} walks towards the entrance of the grotto, where an elderly is already waiting for ${pronoun(characterData, 1)}.*\n"Do you already know about this place? It has everything needed to heal any injury or illness. This makes it very precious, and so it should only be used in emergencies. So only go here if you can't find anything in the medicine den that can cure you!"\n*The ${characterData.displayedSpecies || characterData.species} must decide which of their injuries ${pronounAndPlural(characterData, 0, 'want')} to heal here.*`,
				footer: { text: 'You can only select an injury when the pack has no herbs that can heal that injury.' },
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'recover-wounds',
					label: 'Wound',
					disabled: profileData.injuries.wounds <= 0 || serverInventory.filter(([key]) => allPlantMaps.get(key)?.healsWounds === true).length > 0,
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'recover-infections',
					label: 'Infection',
					disabled: profileData.injuries.infections <= 0 || serverInventory.filter(([key]) => allPlantMaps.get(key)?.healsInfections === true).length > 0,
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'recover-cold',
					label: 'Cold',
					disabled: profileData.injuries.cold === false || serverInventory.filter(([key]) => allPlantMaps.get(key)?.healsColds === true).length > 0,
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'recover-sprains',
					label: 'Sprain',
					disabled: profileData.injuries.sprains <= 0 || serverInventory.filter(([key]) => allPlantMaps.get(key)?.healsSprains === true).length > 0,
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'recover-poison',
					label: 'Poison',
					disabled: profileData.injuries.poison === false || serverInventory.filter(([key]) => allPlantMaps.get(key)?.healsPoison === true).length > 0,
					style: 'SECONDARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			throw new Error(error);
		});

	createCommandCollector(message.author.id, message.guild.id, botReply);

	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('recover-') && i.user.id === message.author.id;

	botReply
		.awaitMessageComponent({ filter, time: 120_000 })
		.then(async interaction => {

			const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
			const hungerPoints = await decreaseHunger(profileData);
			const thirstPoints = await decreaseThirst(profileData);

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy -= energyPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger -= hungerPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst -= thirstPoints;
				},
			));
			characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
			profileData = characterData?.profiles?.[message.guild.id];

			const embedFooterStatsText = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${hungerPoints > 0 ? `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})` : ''}${thirstPoints > 0 ? `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` : ''}`;

			const userInjuryObject = { ...profileData.injuries };

			const healKind = interaction.customId.replace('recover-', '');
			const recoverFieldOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

			/** @type {Array<import('discord.js').MessageActionRow>} */
			const componentArray = [];
			/** @type {Array<string>} */
			const possibleEmojis = [];

			for (let i = 0; i < 3; i++) {

				componentArray.push(new MessageActionRow().addComponents([]));
				for (let j = 0; j < 3; j++) {

					const chosenEmoji = recoverFieldOptions.splice(generateRandomNumber(recoverFieldOptions.length, 0), 1)[0];
					componentArray[i].components.push(new MessageButton({
						customId: `recover-${chosenEmoji}`,
						emoji: chosenEmoji,
						disabled: false,
						style: 'SECONDARY',
					}));
					possibleEmojis.push(chosenEmoji);
				}
			}

			botReply = await botReply
				.edit({
					content: messageContent,
					components: disableAllComponents(componentArray),
				})
				.catch((error) => {
					throw new Error(error);
				});

			startNewRound([]);


			/**
			 * It displays a sequence of emojis, and the user has to click them in the same order
			 * @param {Array<string>} emojisToClick - An array of emojis that the user has to click in order.
			 */
			async function startNewRound(emojisToClick) {

				for (let index = 0; index < 3; index++) { emojisToClick.push(possibleEmojis[generateRandomNumber(possibleEmojis.length, 0)]); }
				let displayingEmoji = 0;
				let choosingEmoji = 0;

				await /** @type {Promise<void>} */(new Promise((resolve) => {

					const viewingInterval = setInterval(async function() {

						botReply = await botReply
							.edit({
								content: messageContent,
								embeds: [{
									color: characterData.color,
									author: { name: characterData.name, icon_url: characterData.avatarURL },
									description: drawEmojibar(displayingEmoji, emojisToClick),
									footer: { text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' },
								}],
								components: displayingEmoji === emojisToClick.length ? enableAllComponents(componentArray) : botReply.components,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return botReply;
							});

						if (displayingEmoji === emojisToClick.length) {

							clearInterval(viewingInterval);
							resolve();
						}

						displayingEmoji += 1;

					}, 1_500);
				}));

				interactionCollector();

				async function interactionCollector() {

					const { customId } = await botReply
						.awaitMessageComponent({ filter, time: 10_000 })
						.catch(() => { return { customId: '' }; });

					choosingEmoji += 1;

					if (customId.replace('recover-', '') === emojisToClick[choosingEmoji - 1]) {

						botReply = await botReply
							.edit({
								content: messageContent,
								embeds: [{
									color: characterData.color,
									author: { name: characterData.name, icon_url: characterData.avatarURL },
									description: '✅'.repeat(choosingEmoji - 1) + '✅',
									footer: { text: 'After a list of emojis is displayed to you one by one, choose the same emojis from the buttons below in the same order.' },
								}],
								components: choosingEmoji === emojisToClick.length ? disableAllComponents(componentArray) : botReply.components,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return botReply;
							});

						if (choosingEmoji === emojisToClick.length) {

							if (emojisToClick.length < 15) { startNewRound(emojisToClick); }
							else {

								recoverCooldownProfilesMap.set('nr' + characterData._id + profileData.serverId, Date.now());

								let embedFooterChosenUserInjuryText = '';

								if (healKind === 'wounds') {

									embedFooterChosenUserInjuryText += `\n-1 wound for ${characterData.name}`;
									userInjuryObject.wounds -= 1;
								}

								if (healKind === 'infections') {

									embedFooterChosenUserInjuryText += `\n-1 infection for ${characterData.name}`;
									userInjuryObject.infections -= 1;
								}

								if (healKind === 'cold') {

									embedFooterChosenUserInjuryText += `\ncold healed for ${characterData.name}`;
									userInjuryObject.cold = false;
								}

								if (healKind === 'sprains') {

									embedFooterChosenUserInjuryText += `\n-1 sprain for ${characterData.name}`;
									userInjuryObject.sprains -= 1;
								}

								if (healKind === 'poison') {

									embedFooterChosenUserInjuryText += `\npoison healed for ${characterData.name}`;
									userInjuryObject.poison = false;
								}

								botReply = await botReply
									.edit({
										content: messageContent,
										embeds: [{
											color: characterData.color,
											author: { name: characterData.name, icon_url: characterData.avatarURL },
											description: `*The cave is a pleasant place, with a small pond of crystal clear water, stalagmites, stalactites and stalagnates, and cool, damp air. Some stones glisten slightly, giving the room a magical atmosphere. ${characterData.name} does not have to stay here for long before ${pronounAndPlural(characterData, 0, 'feel')} much better.*`,
											footer: { text: embedFooterStatsText + '\n' + embedFooterChosenUserInjuryText },
										}],
									})
									.catch((error) => {
										if (error.httpStatus !== 404) { throw new Error(error); }
										return botReply;
									});

								userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
									{ userId: message.author.id },
									(/** @type {import('../../typedef').ProfileSchema} */ p) => {
										// @ts-ignore, as message is must be in server
										p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].injuries = userInjuryObject;
									},
								));
								// @ts-ignore, as message is must be in server
								characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
								// @ts-ignore, as message is must be in server
								profileData = characterData?.profiles?.[message.guildId];

								// @ts-ignore, as message is must be in server
								checkHealth(botReply, userData, userInjuryObject, message);

								return;
							}
						}
						else {

							interactionCollector();
						}
					}
					else {

						botReply = await botReply
							.edit({
								content: messageContent,
								embeds: [{
									color: characterData.color,
									author: { name: characterData.name, icon_url: characterData.avatarURL },
									description: '✅'.repeat(choosingEmoji - 1) + '❌\n\n' + `*${characterData.name} makes every effort to take full advantage of the grotto to heal ${pronoun(characterData, 2)} own injuries. But ${pronounAndPlural(characterData, 0, 'just doesn\'t', 'just don\'t')} seem to get better. The ${characterData.displayedSpecies || characterData.species} may have to try again...*`,
									footer: { text: embedFooterStatsText },
								}],
								components: disableAllComponents(componentArray),
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return botReply;
							});
						// @ts-ignore, as message is must be in server
						checkHealth(botReply, userData, userInjuryObject, message);

						return;
					}
				}
			}
		})
		.catch(async () => {

			botReply = await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description:`*After careful consideration, ${characterData.name} decides that none of ${pronoun(characterData, 2)} injuries are urgent enough to use the grotto to regenerate. The ${characterData.displayedSpecies || characterData.species} might inspect the medicine den for useful plants instead.*`,
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					throw new Error(error);
				});
			return;
		});
};

/**
 * Checks for player whether to decrease their health, if they are passed out and if they need to be given any advice.
 * @param {import('discord.js').Message} botReply
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObject
 * @param {import('discord.js').Message<true>} message
 */
async function checkHealth(botReply, userData, userInjuryObject, message) {

	botReply = await decreaseHealth(userData, botReply, userInjuryObject);
	await isPassedOut(message, userData, true);

	await restAdvice(message, userData);
	await drinkAdvice(message, userData);
	await eatAdvice(message, userData);
}

/**
 * Draws a string of emojis with X emojis based on a default emoji and a replacement emoji that is drawn in between based on its index.
 * @param {number} index - The position where the array item shouldn't be replaced
 * @param {Array<string>} array - The array that should be replaced
 * @returns {string} The string of emojis.
 */
function drawEmojibar(index, array) {

	const newArray = [];

	for (let position = 0; position < index + 1; position++) {

		newArray[position] = (position !== index) ? '⬛' : array[index];
	}

	return newArray.join('');
}

/**
 * Goes through all components in a message and enables them.
 * @param {Array<import('discord.js').MessageActionRow>} messageComponents
 * @returns {Array<import('discord.js').MessageActionRow>}
 */
function enableAllComponents(messageComponents) {

	for (const actionRow of messageComponents) {

		for (const component of actionRow.components) {

			if (component.type === 'BUTTON' && component.style === 'LINK') { continue; }
			component.disabled = false;
		}
	}

	return messageComponents;
}