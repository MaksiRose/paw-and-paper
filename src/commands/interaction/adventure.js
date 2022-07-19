// @ts-check
const profileModel = require('../../models/profileModel');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { getFriendshipHearts, getFriendshipPoints, addFriendshipPoints, checkOldMentions } = require('../../utils/friendshipHandling');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack, getHighestItem } = require('../gameplay_primary/attack');
const { error_color } = require('../../../config.json');
const { MessageActionRow, MessageButton } = require('discord.js');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const { pickRandomRarePlant, pickRandomUncommonPlant, pickRandomCommonPlant } = require('../../utils/pickRandomPlant');
const isInGuild = require('../../utils/isInGuild');
const { materialsMap, specialPlantsMap } = require('../../utils/itemsInfo');

module.exports.name = 'adventure';

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

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	let profileData = characterData?.profiles?.[message.guildId];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (Object.values(profileData.inventory).map(type => Object.values(type)).flat().reduce((a, b) => a + b) >= 5) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} approaches the pack borders, ${pronoun(characterData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(characterData, 0, 'is', 'are')} to go exploring, ${pronounAndPlural(characterData, 0, 'decide')} to store some things away first.*`,
					footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const firstMentionedUser = message.mentions.users.first();
	if (firstMentionedUser && firstMentionedUser.id === message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is looking to go on an adventure, but going alone is very dangerous. The ${characterData.displayedSpecies || characterData.species} should find someone to take with ${pronoun(characterData, 1)}.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (!firstMentionedUser) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Please mention a user that you want to adventure with!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: firstMentionedUser.id }));
	let partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
	let partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

	if (!partnerUserData || !partnerCharacterData || partnerCharacterData.name === '' || partnerCharacterData.species === '' || !partnerProfileData || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown === true || partnerProfileData.isResting === true) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: 'The mentioned user has no (selected) character, hasn\'t completed setting up their profile, is busy or is passed out :(',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (Object.values(partnerProfileData.inventory).map(type => Object.values(type)).flat().reduce((a, b) => a + b) >= 5) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: `${partnerCharacterData.name} is carrying too many items with ${pronoun(partnerCharacterData, 1)}. Ask ${pronoun(partnerCharacterData, 1)} to store those away first.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	checkOldMentions(userData, characterData._id, partnerUserData, partnerCharacterData._id);
	const friendshipPoints = getFriendshipPoints(characterData.mentions[partnerCharacterData._id], partnerCharacterData.mentions[characterData._id]);
	const friendshipHearts = getFriendshipHearts(friendshipPoints);

	if (friendshipHearts < 6) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: `You and ${partnerCharacterData.name} need at least 6 ❤️ to be able to adventure together!`,
					description: 'You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `rp friendships`.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (Object.values(profileData.inventory).map(type => Object.values(type)).flat().reduce((a, b) => a + b) >= 5) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} approaches the pack borders, ${pronoun(characterData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(characterData, 0, 'is', 'are')} to go adventuring, ${pronounAndPlural(characterData, 0, 'decide')} to store some things away first.*`,
					footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
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
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} impatiently paces at the pack borders, hoping for ${partnerCharacterData.name} to come and adventure with ${pronoun(characterData, 1)}.*`,
				footer: { text: 'The game that is being played is memory, meaning that a player has to uncover two cards. If the emojis match, the cards are left uncovered.\nThe invitation expires after 60 seconds.' },
			}],
			components: [new MessageActionRow({
				components: [new MessageButton({
					customId: 'adventure-confirm',
					label: 'Start adventure',
					emoji: '🧭',
					style: 'SUCCESS',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let userInjuryObjectPlayer1 = { ...profileData.injuries };
	let userInjuryObjectPlayer2 = { ...partnerProfileData.injuries };

	const emptyField = '⬛';
	const memoryCardOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

	const memoryCardEmojis = [];
	for (let i = 0; i < 10; i++) {

		const chosenEmoji = memoryCardOptions.splice(generateRandomNumber(memoryCardOptions.length, 0), 1)[0];
		memoryCardEmojis.push(chosenEmoji, chosenEmoji);
	}

	/** @type {Array<import('discord.js').MessageActionRow>} */
	const componentArray = [];
	const cardPositionsArray = /** @type {Array<Array<string>>} */ ([]);
	for (let i = 0; i < 4; i++) {

		componentArray.push(new MessageActionRow().addComponents([]));
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
	 * @param {Array<number | null>} lastPickPosition
	 */
	async function startNewRound(isPartner, isFirstPick, lastPickPosition) {

		// @ts-ignore, since message must be in guild
		createCommandCollector(message.author.id, message.guildId, botReply);
		// @ts-ignore, since message must be in guild and there must be mentioned user
		createCommandCollector(firstMentionedUser.id, message.guildId, botReply);

		const currentUserData = (isPartner === true) ? partnerUserData : userData;
		// @ts-ignore, since message must be in guild
		const currentCharacterData = currentUserData.characters[currentUserData.currentCharacter[message.guildId]];
		const otherUserData = (isPartner === true) ? userData : partnerUserData;
		// @ts-ignore, since message must be in guild
		const otherCharacterData = otherUserData.characters[otherUserData.currentCharacter[message.guildId]];

		// @ts-ignore, since there must be mentioned user
		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'adventure-confirm' && i.user.id === firstMentionedUser.id) || (i.customId.includes('board') && i.user.id == currentUserData.userId);

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return { customId: '' }; });

		if (customId === '') {

			if (rounds === -1) {

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${partnerCharacterData.name} seems to be busy and turns ${characterData.name} down.*`,
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData);

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${currentCharacterData.name} decides that ${pronounAndPlural(currentCharacterData, 0, 'has', 'have')} adventured enough and goes back to the pack.*`,
							footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				// @ts-ignore, since message must be in guild
				await checkHealthAndLevel(message, botReply, userData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, serverData);
			}
			return;
		}

		/** @type {number | null} */
		let column = null;
		/** @type {number | null} */
		let row = null;

		if (customId.includes('board')) {

			column = Number(customId.split('-', 2).pop());
			row = Number(customId.split('-').pop());

			/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).setEmoji(cardPositionsArray[column][row]);
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

				if (lastPickPosition[0] !== null && lastPickPosition[1] !== null && column !== null && row !== null && /** @type {import('discord.js').MessageButton} */ (componentArray[lastPickPosition[0]]?.components[lastPickPosition[1]])?.emoji?.name !== /** @type {import('discord.js').MessageButton} */ (componentArray[column]?.components[row])?.emoji?.name) {

					/** @type {import('discord.js').MessageButton} */ (componentArray[lastPickPosition[0]].components[lastPickPosition[1]]).setEmoji(emptyField);
					componentArray[lastPickPosition[0]].components[lastPickPosition[1]].disabled = false;

					/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).setEmoji(emptyField);
					componentArray[column].components[row].disabled = false;
				}
				else if (customId.includes('board')) {

					currentUserData.userId === userData.userId ? uncoveredCardsPlayer1 += 1 : uncoveredCardsPlayer2 += 1;
				}

				await botReply
					.delete()
					.catch((error) => {
						throw new Error(error);
					});

				botReply = await message
					.reply({
						content: `<@${otherUserData.userId}>` + (messageContent == null ? '' : messageContent),
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*The two animals are strolling around. ${otherCharacterData.name} notices something behind a plant and goes to take a closer look.*`,
						}],
						components: componentArray,
						failIfNotExists: false,
					})
					.catch((error) => { throw new Error(error); });

				if (componentArray.every(actionRow => actionRow.components.every(button => button.disabled === true))) {

					const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData);

					/** @type {string | null} */
					let foundItem = null;
					let extraHealthPoints = 0;
					let winningUserData = uncoveredCardsPlayer1 > uncoveredCardsPlayer2 ? userData : uncoveredCardsPlayer2 > uncoveredCardsPlayer1 ? partnerUserData : generateRandomNumber(2, 0) === 0 ? userData : partnerUserData;
					// @ts-ignore, since message must be in guild
					let winningCharacterData = winningUserData.characters[winningUserData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					let winningProfileData = winningCharacterData.profiles[message.guildId];

					if (winningProfileData.health < winningProfileData.maxHealth) {

						extraHealthPoints = function(health) { return (winningProfileData.health + health > winningProfileData.maxHealth) ? winningProfileData.maxHealth - winningProfileData.health : health; }(generateRandomNumber(5, 8));
					}
					else if (pullFromWeightedTable({ 0: rounds * 3, 1: 45 - rounds }) === 1 && Object.keys(winningProfileData.temporaryStatIncrease).length <= 1) {

						foundItem = Array.from(specialPlantsMap.keys())[generateRandomNumber(Array.from(specialPlantsMap.keys()).length, 0)];
					}
					else if (Object.values(serverData.inventory.materials).reduce((a, b) => a + b, 0) < 36) {

						foundItem = Array.from(materialsMap.keys())[generateRandomNumber(Array.from(materialsMap.keys()).length, 0)];
					}
					else if (pullFromWeightedTable({ 0: rounds * 8, 1: 30 - rounds }) === 1) {

						if (pullFromWeightedTable({ 0: rounds * 8, 1: 30 - rounds }) === 1) {

							foundItem = await pickRandomRarePlant();
						}
						else {

							foundItem = await pickRandomUncommonPlant();
						}
					}
					else {

						foundItem = await pickRandomCommonPlant();
					}

					const userInventory = {
						commonPlants: { ...winningProfileData.inventory.commonPlants },
						uncommonPlants: { ...winningProfileData.inventory.uncommonPlants },
						rarePlants: { ...winningProfileData.inventory.rarePlants },
						specialPlants: { ...winningProfileData.inventory.specialPlants },
						meat: { ...winningProfileData.inventory.meat },
						materials: { ...winningProfileData.inventory.materials },
					};

					for (const itemCategory of Object.keys(userInventory)) {

						if (foundItem !== null && Object.hasOwn(userInventory[itemCategory], foundItem)) {

							userInventory[itemCategory][foundItem] += 1;
						}
					}

					winningUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ userId: winningUserData.userId },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							// @ts-ignore, since message must be in guild
							p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].inventory = userInventory;
							// @ts-ignore, since message must be in guild
							p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].health += extraHealthPoints;
						},
					));
					// @ts-ignore, since message must be in guild
					winningCharacterData = winningUserData.characters[winningUserData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					winningProfileData = winningCharacterData.profiles[message.guildId];

					userData = winningUserData.userId === userData.userId ? winningUserData : userData;
					// @ts-ignore, since message must be in guild
					characterData = userData.characters[userData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					profileData = characterData.profiles[message.guildId];
					partnerUserData = winningUserData.userId === partnerUserData.userId ? winningUserData : partnerUserData;
					// @ts-ignore, since message must be in guild
					partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
					// @ts-ignore, since message must be in guild
					partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];


					botReply = await botReply
						.edit({
							content: messageContent,
							embeds: [...embedArray, {
								color: characterData.color,
								author: { name: characterData.name, icon_url: characterData.avatarURL },
								description: `*The two animals laugh as they return from a successful adventure. ${winningCharacterData.name} ${foundItem === null ? 'feels especially refreshed from this trip.' : `even found a ${foundItem} on the way.`} What a success!*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}${foundItem === null ? `\n\n+${extraHealthPoints} HP for ${winningCharacterData.name} (${winningProfileData.health}/${winningProfileData.maxHealth})` : `\n\n+1 ${foundItem} for ${winningCharacterData.name}`}` },
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return botReply;
						});

					// @ts-ignore, since message must be in guild
					await checkHealthAndLevel(message, botReply, userData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, serverData);
				}
				else if (rounds >= 20) {

					const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData);

					let losingUserData = uncoveredCardsPlayer1 < uncoveredCardsPlayer2 ? userData : uncoveredCardsPlayer2 < uncoveredCardsPlayer1 ? partnerUserData : generateRandomNumber(2, 0) === 0 ? userData : partnerUserData;
					// @ts-ignore, since message must be in guild
					let losingCharacterData = losingUserData.characters[losingUserData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					let losingProfileData = losingCharacterData.profiles[message.guildId];

					const losingHealthPoints = function(health) { return (losingProfileData.health - health < 0) ? losingProfileData.health : health; }(generateRandomNumber(5, 3));
					const losingInjuryObject = (losingUserData.userId === userData.userId) ? { ...userInjuryObjectPlayer1 } : { ...userInjuryObjectPlayer2 };

					const userInventory = {
						commonPlants: { ...losingProfileData.inventory.commonPlants },
						uncommonPlants: { ...losingProfileData.inventory.uncommonPlants },
						rarePlants: { ...losingProfileData.inventory.rarePlants },
						specialPlants: { ...losingProfileData.inventory.specialPlants },
						meat: { ...losingProfileData.inventory.meat },
						materials: { ...losingProfileData.inventory.materials },
					};

					const { itemType, itemName } = getHighestItem(userInventory);

					let extraDescription = '';
					let extraFooter = '';

					switch (true) {

						case (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0 && /** @type {Array<number>} */ Object.values(losingProfileData.inventory).map(type => Object.values(type)).flat().filter(value => value > 0).length > 0):

							userInventory[itemType][itemName] -= 1;
							extraDescription = `accidentally drops a ${itemName} that ${pronoun(losingCharacterData, 0)} had with ${pronoun(characterData, 1)}.`;
							extraFooter = `-1 ${itemName} for ${losingCharacterData.name}`;

							break;

						default:

							switch (true) {

								case (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0 && losingInjuryObject.cold === false):

									losingInjuryObject.cold = true;
									extraDescription = `notices that ${pronounAndPlural(losingCharacterData, 0, 'is', 'are')} feeling weak and can't stop coughing. The long jouney must've given ${pronoun(losingCharacterData, 1)} a cold.`;
									extraFooter = `-${losingHealthPoints} HP (from cold) for ${losingCharacterData.name}`;

									break;

								default:

									losingInjuryObject.wounds += 1;
									extraDescription = `feels blood running down ${pronoun(losingCharacterData, 2)} side. The humans must've wounded ${pronoun(losingCharacterData, 0)}.`;
									extraFooter = `-${losingHealthPoints} HP (from wound) for ${losingCharacterData.name}`;
							}
					}

					losingUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ userId: losingUserData.userId },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							// @ts-ignore, since message must be in guild
							p.characters[losingCharacterData._id].profiles[message.guildId].inventory = userInventory;
							// @ts-ignore, since message must be in guild
							p.characters[losingCharacterData._id].profiles[message.guildId].health -= losingHealthPoints;
						},
					));
					// @ts-ignore, since message must be in guild
					losingCharacterData = losingUserData.characters[losingUserData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					losingProfileData = losingCharacterData.profiles[message.guildId];

					userInjuryObjectPlayer1 = (losingUserData.userId === userData.userId) ? losingInjuryObject : userInjuryObjectPlayer1;
					userInjuryObjectPlayer2 = (losingUserData.userId === userData.userId) ? userInjuryObjectPlayer2 : losingInjuryObject;

					userData = losingUserData.userId === userData.userId ? losingUserData : userData;
					// @ts-ignore, since message must be in guild
					characterData = userData.characters[userData.currentCharacter[message.guildId]];
					// @ts-ignore, since message must be in guild
					profileData = characterData.profiles[message.guildId];
					partnerUserData = losingUserData.userId === partnerUserData.userId ? losingUserData : partnerUserData;
					// @ts-ignore, since message must be in guild
					partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
					// @ts-ignore, since message must be in guild
					partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];


					botReply = await botReply
						.edit({
							content: messageContent,
							embeds: [...embedArray, {
								color: characterData.color,
								author: { name: characterData.name, icon_url: characterData.avatarURL },
								description: `*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, ${losingCharacterData.name} ${extraDescription} What a shame!*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}\n\n${extraFooter}` },
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return botReply;
						});

					// @ts-ignore, since message must be in guild
					await checkHealthAndLevel(message, botReply, userData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, serverData);
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
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').Profile} profileData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('../../typedef').Profile} partnerProfileData
 * @returns {Promise<{ embedFooterStatsTextPlayer1: string, embedFooterStatsTextPlayer2: string }>}
 */
async function decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData) {

	let embedFooterStatsTextPlayer1 = '';
	let embedFooterStatsTextPlayer2 = '';

	const experiencePoints = generateRandomNumber(11, 5);

	const thirstPointsPlayer1 = await decreaseThirst(profileData);
	const hungerPointsPlayer1 = await decreaseHunger(profileData);
	const energyPointsPlayer1 = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy -= energyPointsPlayer1;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger -= hungerPointsPlayer1;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst -= thirstPointsPlayer1;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].experience += experiencePoints;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'prairie';
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hasCooldown = false;
		},
	));
	// @ts-ignore, since message must be in guild
	const characterData = userData.characters[userData.currentCharacter[message.guildId]];
	// @ts-ignore, since message must be in guild
	profileData = characterData.profiles[message.guildId];


	embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50}) for ${characterData.name}\n-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${characterData.name}`;

	if (hungerPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${hungerPointsPlayer1} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${characterData.name}`;
	}

	if (thirstPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${thirstPointsPlayer1} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${characterData.name}`;
	}


	const thirstPointsPlayer2 = await decreaseThirst(partnerProfileData);
	const hungerPointsPlayer2 = await decreaseHunger(partnerProfileData);
	const energyPointsPlayer2 = function(energy) { return (partnerProfileData.energy - energy < 0) ? partnerProfileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(partnerProfileData));

	partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		// @ts-ignore, since mentioned user must exist
		{ userId: message.mentions.users.first().id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy -= energyPointsPlayer2;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger -= hungerPointsPlayer2;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst -= thirstPointsPlayer2;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].experience += experiencePoints;
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'prairie';
			// @ts-ignore, since message must be in guild
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hasCooldown = false;
		},
	));
	// @ts-ignore, since message must be in guild
	const partnerCharacterData = partnerUserData.characters[partnerUserData.currentCharacter[message.guildId]];
	// @ts-ignore, since message must be in guild
	partnerProfileData = partnerCharacterData.profiles[message.guildId];

	embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience}/${partnerProfileData.levels * 50}) for ${partnerCharacterData.name}\n-${energyPointsPlayer2} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerCharacterData.name}`;

	if (hungerPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer2} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerCharacterData.name}`;
	}

	if (thirstPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer2} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerCharacterData.name}`;
	}

	return { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 };
}

/**
 * Checks for both level whether to decrease their health, level them up, if they are passed out and if they need to be given any advice.
 * @param {import('discord.js').Message<true>} message
 * @param {import('discord.js').Message} botReply
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 * @param {import('../../typedef').ServerSchema} serverData
 */
async function checkHealthAndLevel(message, botReply, userData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, serverData) {

	botReply = await decreaseHealth(userData, botReply, userInjuryObjectPlayer1);
	botReply = await decreaseHealth(partnerUserData, botReply, userInjuryObjectPlayer2);

	botReply = await checkLevelUp(message, userData, serverData, botReply) || botReply;
	botReply = await checkLevelUp(message, partnerUserData, serverData, botReply) || botReply;

	await isPassedOut(message, userData.uuid, true);
	await isPassedOut(message, partnerUserData.uuid, true);

	await addFriendshipPoints(message, userData, userData.currentCharacter[message.guildId], partnerUserData, partnerUserData.currentCharacter[message.guildId]);

	await restAdvice(message, userData);
	await restAdvice(message, partnerUserData);

	await drinkAdvice(message, userData);
	await drinkAdvice(message, partnerUserData);

	await eatAdvice(message, userData);
	await eatAdvice(message, partnerUserData);
}