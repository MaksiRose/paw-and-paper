// @ts-check
const { readFileSync } = require('fs');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { getFriendshipHearts, getFriendshipPoints, getFriendshipKey, addFriendshipPoints } = require('../../utils/friendshipHandling');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack, getHighestItem } = require('../gameplay/attack');
const { error_color } = require('../../config.json');
const { MessageActionRow, MessageButton } = require('discord.js');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const { pickRandomRarePlant, pickRandomUncommonPlant, pickRandomCommonPlant } = require('../../utils/pickRandomPlant');

module.exports.name = 'adventure';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (!message.mentions.users.size || message.mentions.users.first().id === message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} is looking to go on an adventure, but going alone is very dangerous. The ${profileData.species} should find someone to take with ${pronoun(profileData, 1)}.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
		userId: message.mentions.users.first()?.id,
		serverId: message.guild.id,
	}));

	if (!partnerProfileData || partnerProfileData.name === '' || partnerProfileData.species === '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown === true || partnerProfileData.isResting === true) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'The mentioned user has no account, is passed out or busy :(',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {import('../../typedef').FriendsList} */
	const friendshipList = JSON.parse(readFileSync('./database/friendshipList.json', 'utf-8'));
	const friendshipKey = getFriendshipKey(friendshipList, profileData, partnerProfileData);
	const friendshipPoints = getFriendshipPoints(friendshipList[friendshipKey]?.[profileData.uuid], friendshipList[friendshipKey]?.[partnerProfileData.uuid]);
	const friendshipHearts = getFriendshipHearts(friendshipPoints);

	if (friendshipHearts < 6) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: `You and ${partnerProfileData.name} need at least 6 ❤️ to be able to adventure together!`,
					description: 'You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `rp friendships`.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} impatiently paces at the pack borders, hoping for ${partnerProfileData.name} to come and adventure with ${pronoun(profileData, 1)}.*`,
				footer: { text: 'After 60 seconds, the invitation expires.' },
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'adventure-confirm',
					label: 'Start adventure',
					emoji: '🧭',
					style: 'SUCCESS',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let userInjuryObjectPlayer1 = { ...profileData.injuryObject };
	let userInjuryObjectPlayer2 = { ...partnerProfileData.injuryObject };

	const emptyField = '⬛';
	const memoryCardOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪨', '🪵', '🌴'];

	const memoryCardEmojis = [];
	for (let i = 0; i < 10; i++) {

		const chosenEmoji = memoryCardOptions.splice(generateRandomNumber(memoryCardOptions.length, 0), 1)[0];
		memoryCardEmojis.push(chosenEmoji, chosenEmoji);
	}

	/** @type {Array<import('discord.js').MessageActionRow>} */
	const componentArray = [];
	const cardPositionsArray = [];
	for (let i = 0; i < 4; i++) {

		componentArray.push(new MessageActionRow({ components: [] }));
		cardPositionsArray.push([]);
		for (let j = 0; j < 5; j++) {

			componentArray[i].components.push(new MessageButton({
				customId: `board-${i}-${j}`,
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}));
			cardPositionsArray[i].push(...memoryCardEmojis.splice(generateRandomNumber(memoryCardEmojis.length, 0), 1));
		}
	}

	/** Since accepting the adventure counts as a round, we have to be at -1 rounds here just to be at 0 after the adventure gets accepted. */
	let rounds = -1;
	let uncoveredCardsPlayer1 = 0;
	let uncoveredCardsPlayer2 = 0;

	startNewRound(generateRandomNumber(2, 0) === 0 ? true : false, false, [null, null]);

	/**
	 *
	 * @param {boolean} isPartner
	 * @param {boolean} isFirstPick
	 * @param {Array<number>} lastPickPosition
	 */
	async function startNewRound(isPartner, isFirstPick, lastPickPosition) {

		createCommandCollector(message.author.id, message.guild.id, botReply);
		createCommandCollector(message.mentions.users.first().id, message.guild.id, botReply);

		const currentProfileData = (isPartner === true) ? partnerProfileData : profileData;
		const otherProfileData = (isPartner === true) ? profileData : partnerProfileData;

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'adventure-confirm' && i.user.id === message.mentions.users.first().id) || (i.customId.includes('board') && i.user.id == currentProfileData.userId);

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: 60000 })
			.catch(() => { return { customId: '' }; });

		if (customId === '') {

			if (rounds === -1) {

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${partnerProfileData.name} seems to be busy and turns ${profileData.name} down.*`,
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${currentProfileData.name} decides that ${pronounAndPlural(currentProfileData, 0, 'has', 'have')} adventured enough and goes back to the pack.*`,
							footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}
			return;
		}

		/** @type {number} */
		let column = null;
		/** @type {number} */
		let row = null;

		if (customId.includes('board')) {

			column = Number(customId.split('-', 2).pop());
			row = Number(customId.split('-').pop());

			/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).emoji.name = cardPositionsArray[column][row];
			componentArray[column].components[row].disabled = true;


			botReply = await botReply
				.edit({
					components: componentArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		if (!isFirstPick) {

			rounds += 1;

			setTimeout(async () => {

				if (/** @type {import('discord.js').MessageButton} */ (componentArray[lastPickPosition[0]]?.components[lastPickPosition[1]])?.emoji?.name !== /** @type {import('discord.js').MessageButton} */ (componentArray[column]?.components[row])?.emoji?.name) {

					/** @type {import('discord.js').MessageButton} */ (componentArray[lastPickPosition[0]].components[lastPickPosition[1]]).emoji.name = emptyField;
					componentArray[lastPickPosition[0]].components[lastPickPosition[1]].disabled = false;

					/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).emoji.name = emptyField;
					componentArray[column].components[row].disabled = false;
				}
				else if (customId.includes('board')) {

					currentProfileData.userId === profileData.userId ? uncoveredCardsPlayer1 += 1 : uncoveredCardsPlayer2 += 1;
				}

				await botReply
					.delete()
					.catch((error) => {
						throw new Error(error);
					});

				botReply = await message
					.reply({
						content: `<@${otherProfileData.userId}>` + (messageContent == null ? '' : messageContent),
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*The two animals are strolling around. ${otherProfileData.name} notices something behind a plant and goes to take a closer look.*`,
						}],
						components: componentArray,
						failIfNotExists: false,
					})
					.catch((error) => { throw new Error(error); });

				if (componentArray.every(actionRow => actionRow.components.every(button => button.disabled === true))) {

					const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

					/** @type {string | null} */
					let foundItem = null;
					let extraHealthPoints = 0;
					let winningProfileData = uncoveredCardsPlayer1 > uncoveredCardsPlayer2 ? profileData : uncoveredCardsPlayer2 > uncoveredCardsPlayer1 ? partnerProfileData : generateRandomNumber(2, 0) === 0 ? profileData : partnerProfileData;

					switch (true) {

						case (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0 && winningProfileData.health < winningProfileData.maxHealth):

							extraHealthPoints = function(health) { return (winningProfileData.health + health > winningProfileData.maxHealth) ? winningProfileData.maxHealth - winningProfileData.health : health; }(generateRandomNumber(3, 6));

							break;

						default:

							switch (true) {

								case (pullFromWeightedTable({ 0: rounds * 8, 1: 30 - rounds }) === 1):

									switch (true) {

										case (pullFromWeightedTable({ 0: rounds * 8, 1: 30 - rounds }) === 1):

											foundItem = await pickRandomRarePlant();

											break;

										default:

											foundItem = await pickRandomUncommonPlant();
									}

									break;

								default:

									foundItem = await pickRandomCommonPlant();
							}
					}

					const userInventory = {
						commonPlants: { ...winningProfileData.inventoryObject.commonPlants },
						uncommonPlants: { ...winningProfileData.inventoryObject.uncommonPlants },
						rarePlants: { ...winningProfileData.inventoryObject.rarePlants },
						meat: { ...winningProfileData.inventoryObject.meat },
					};

					for (const itemCategory of Object.keys(userInventory)) {

						if (Object.hasOwn(userInventory[itemCategory], foundItem)) {

							userInventory[itemCategory][foundItem] += 1;
						}
					}

					winningProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ userId: winningProfileData.userId, serverId: winningProfileData.serverId },
						{
							$set: { inventoryObject: userInventory },
							$inc: { health: extraHealthPoints },
						},
					));

					profileData = winningProfileData.userId === profileData.userId ? winningProfileData : profileData;
					partnerProfileData = winningProfileData.userId === partnerProfileData.userId ? winningProfileData : partnerProfileData;


					botReply = await botReply
						.edit({
							content: messageContent == null ? '' : messageContent,
							embeds: [...embedArray, {
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*The two animals laugh as they return from a successful adventure. ${winningProfileData.name} ${foundItem === null ? 'feels especially refreshed from this trip.' : `even found a ${foundItem} on the way.`} What a success!*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}${foundItem === null ? `\n\n+${extraHealthPoints} HP for ${winningProfileData.name} (${winningProfileData.health}/${winningProfileData.maxHealth})` : `\n\n+1 ${foundItem} for ${winningProfileData.name}`}` },
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return botReply;
						});

					await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
				}
				else if (rounds >= 20) {

					const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

					let losingProfileData = uncoveredCardsPlayer1 < uncoveredCardsPlayer2 ? profileData : uncoveredCardsPlayer2 < uncoveredCardsPlayer1 ? partnerProfileData : generateRandomNumber(2, 0) === 0 ? profileData : partnerProfileData;
					const losingHealthPoints = function(health) { return (losingProfileData.health - health < 0) ? losingProfileData.health : health; }(generateRandomNumber(5, 3));
					const losingInjuryObject = (losingProfileData.userId === profileData.userId) ? { ...userInjuryObjectPlayer1 } : { ...userInjuryObjectPlayer2 };

					const userInventory = {
						commonPlants: { ...losingProfileData.inventoryObject.commonPlants },
						uncommonPlants: { ...losingProfileData.inventoryObject.uncommonPlants },
						rarePlants: { ...losingProfileData.inventoryObject.rarePlants },
						meat: { ...losingProfileData.inventoryObject.meat },
					};

					const { itemType, itemName } = getHighestItem(userInventory);

					let extraDescription = '';
					let extraFooter = '';

					switch (true) {

						case (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0 && /** @type {Array<number>} */ ([].concat(...Object.values(losingProfileData.inventoryObject).map(type => Object.values(type)))).filter(value => value > 0).length > 0):

							userInventory[itemType][itemName] -= 1;
							extraDescription = `accidentally drops a ${itemName} that ${pronoun(losingProfileData, 0)} had with them.`;
							extraFooter = `-1 ${itemName} for ${losingProfileData.name}`;

							break;

						default:

							switch (true) {

								case (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0 && losingInjuryObject.cold === false):

									losingInjuryObject.cold = true;
									extraDescription = `notices that ${pronounAndPlural(losingProfileData, 0, 'is', 'are')} feeling weak and can't stop coughing. The long jouney must've given ${pronoun(losingProfileData, 0)} a cold.`;
									extraFooter = `-${losingHealthPoints} HP (from cold)`;

									break;

								default:

									losingInjuryObject.wounds += 1;
									extraDescription = `feels blood running down ${pronoun(losingProfileData, 2)} side. The humans must've wounded ${pronoun(profileData, 0)}.`;
									extraFooter = `-${losingHealthPoints} HP (from wound)`;
							}
					}

					losingProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ userId: losingProfileData.userId, serverId: losingProfileData.serverId },
						{
							$set: { inventoryObject: userInventory },
							$inc: { health: -losingHealthPoints },
						},
					));

					userInjuryObjectPlayer1 = (otherProfileData.userId === profileData.userId) ? losingInjuryObject : userInjuryObjectPlayer1;
					userInjuryObjectPlayer2 = (otherProfileData.userId === profileData.userId) ? userInjuryObjectPlayer2 : losingInjuryObject;

					profileData = losingProfileData.userId === profileData.userId ? losingProfileData : profileData;
					partnerProfileData = losingProfileData.userId === partnerProfileData.userId ? losingProfileData : partnerProfileData;


					botReply = await botReply
						.edit({
							content: messageContent == null ? '' : messageContent,
							embeds: [...embedArray, {
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, the ${losingProfileData.name} ${extraDescription} What a shame!*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}\n\n${extraFooter}` },
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return botReply;
						});

					await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
				}
				else {

					return await startNewRound(!isPartner, true, [null, null]);
				}
			}, 3000);
		}
		else {

			return await startNewRound(isPartner, false, [column, row]);
		}
	}
};

/**
 * Decreases both players thirst, hunger and energy, and returns the footer text.
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ProfileSchema} partnerProfileData
 * @returns {Promise<{ embedFooterStatsTextPlayer1: string, embedFooterStatsTextPlayer2: string }>}
 */
async function decreaseStats(message, profileData, partnerProfileData) {

	let embedFooterStatsTextPlayer1 = '';
	let embedFooterStatsTextPlayer2 = '';

	const experiencePoints = generateRandomNumber(11, 5);

	const thirstPointsPlayer1 = await decreaseThirst(profileData);
	const hungerPointsPlayer1 = await decreaseHunger(profileData);
	const energyPointsPlayer1 = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));

	profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{
			$inc: {
				energy: -energyPointsPlayer1,
				hunger: -hungerPointsPlayer1,
				thirst: -thirstPointsPlayer1,
				experience: experiencePoints,
			},
			$set: {
				currentRegion: 'prairie',
				hasCooldown: false,
			},
		},
	));

	embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50}) for ${profileData.name}\n-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${profileData.name}`;

	if (hungerPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${hungerPointsPlayer1} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${profileData.name}`;
	}

	if (thirstPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${thirstPointsPlayer1} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${profileData.name}`;
	}


	const thirstPointsPlayer2 = await decreaseThirst(partnerProfileData);
	const hungerPointsPlayer2 = await decreaseHunger(partnerProfileData);
	const energyPointsPlayer2 = function(energy) { return (partnerProfileData.energy - energy < 0) ? partnerProfileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(partnerProfileData));

	partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.mentions.users.first().id, serverId: message.guild.id },
		{
			$inc: {
				energy: -energyPointsPlayer2,
				hunger: -hungerPointsPlayer2,
				thirst: -thirstPointsPlayer2,
				experience: experiencePoints,
			},
			$set: {
				currentRegion: 'prairie',
				hasCooldown: false,
			},
		},
	));

	embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience + experiencePoints}/${partnerProfileData.levels * 50}) for ${partnerProfileData.name}\n-${energyPointsPlayer2} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerProfileData.name}`;

	if (hungerPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer2} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerProfileData.name}`;
	}

	if (thirstPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer2} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerProfileData.name}`;
	}

	return { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 };
}

/**
 * Checks for both level whether to decrease their health, level them up, if they are passed out and if they need to be given any advice.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Message} botReply
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} partnerProfileData
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 */
async function checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	botReply = await decreaseHealth(profileData, botReply, userInjuryObjectPlayer1);
	botReply = await decreaseHealth(partnerProfileData, botReply, userInjuryObjectPlayer2);

	botReply = await checkLevelUp(message, botReply, profileData, serverData);
	botReply = await checkLevelUp(message, botReply, partnerProfileData, serverData);

	await isPassedOut(message, profileData, true);
	await isPassedOut(message, partnerProfileData, true);

	await addFriendshipPoints(message, profileData, partnerProfileData);

	await restAdvice(message, profileData);
	await restAdvice(message, partnerProfileData);

	await drinkAdvice(message, profileData);
	await drinkAdvice(message, partnerProfileData);

	await eatAdvice(message, profileData);
	await eatAdvice(message, partnerProfileData);
}