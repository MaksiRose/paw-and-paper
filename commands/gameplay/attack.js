// @ts-check
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { decreaseEnergy, decreaseHunger, decreaseThirst, decreaseHealth } = require('../../utils/checkCondition');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { generateRandomNumberWithException, pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const startCooldown = require('../../utils/startCooldown');
const { checkLevelUp } = require('../../utils/levelHandling');
const { default_color } = require('../../config.json');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice, coloredButtonsAdvice } = require('../../utils/adviceMessages');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const serverMap = new Map();

module.exports.name = 'attack';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	if (!serverMap.has('nr' + message.guild.id) || serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

		await message
			.reply({
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is ready to attack any intruder. But no matter how far ${pronounAndPlural(characterData, 0, 'look')}, ${pronoun(characterData, 0)} can't see anyone. It seems that the pack is not under attack at the moment.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverMap.get('nr' + message.guild.id).humans <= 0) {

		await message
			.reply({
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} looks around, searching for a human to attack. It looks like everyone is already being attacked by other pack members. The ${characterData.species} better not interfere before ${pronounAndPlural(characterData, 0, 'hurt')} ${pronoun(characterData, 2)} friends.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	userData = await startCooldown(message);

	serverMap.get('nr' + message.guild.id).humans -= 1;
	serverMap.get('nr' + message.guild.id).currentFights += 1;

	let
		winPoints = 0,
		/** @type {import('discord.js').Message} */
		botReply;
	const embed = {
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: '',
		footer: { text: /** @type {string} */ (null) },
	};

	await fightCycle(0, '');

	/**
	 *
	 * @param {number} totalCycles
	 * @param {string} cycleKind
	 * @returns {Promise<void>}
	 */
	async function fightCycle(totalCycles, cycleKind) {

		const fightComponents = new MessageActionRow({
			components: [ new MessageButton({
				customId: 'fight-attack',
				label: 'Attack',
				emoji: '⏫',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'fight-defend',
				label: 'Defend',
				emoji: '⏺️',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'fight-dodge',
				label: 'Dodge',
				emoji: '↪️',
				style: 'SECONDARY',
			})].sort(() => Math.random() - 0.5),
		});

		const newCycleArray = ['attack', 'dodge', 'defend'];
		cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

		if (cycleKind == 'attack') {

			embed.description = `⏫ *The human gets ready to attack. ${characterData.name} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
		}

		if (cycleKind == 'dodge') {

			embed.description = `↪️ *Looks like the human is preparing a maneuver for ${characterData.name}'s next move. The ${characterData.species} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
		}

		if (cycleKind == 'defend') {

			embed.description = `⏺️ *The human gets into position to oppose an attack. ${characterData.name} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
		}

		embed.footer.text = 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.';

		if (totalCycles == 0) {

			botReply = await message
				.reply({
					embeds: [...embedArray, embed],
					components: [fightComponents],
					failIfNotExists: false,
				})
				.catch((error) => { throw new Error(error); });
		}
		else {

			botReply = await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: [...botReply.components.length > 0 ? [botReply.components[botReply.components.length - 1]] : [], fightComponents],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		if (cycleKind === 'defend') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-attack')]).style = 'PRIMARY'; }
		if (cycleKind === 'dodge') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-defend')]).style = 'PRIMARY'; }
		if (cycleKind === 'attack') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-dodge')]).style = 'PRIMARY'; }

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'fight-attack' || i.customId === 'fight-defend' || i.customId === 'fight-dodge') && i.user.id === message.author.id;

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: profileData.rank === 'Elderly' ? 3_000 : profileData.rank === 'Hunter' || profileData.rank === 'Healer' ? 4_000 : profileData.rank === 'Apprentice' ? 5_000 : 10_000 })
			.catch(() => { return { customId: '' }; });

		if (customId !== '') {

			/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'DANGER';
		}

		if (customId === '' || (customId === 'fight-attack' && cycleKind === 'dodge') || (customId === 'fight-defend' && cycleKind === 'attack') || (customId === 'fight-dodge' && cycleKind === 'defend')) {

			winPoints -= 1;
		}

		if ((customId === 'fight-attack' && cycleKind === 'defend') || (customId === 'fight-defend' && cycleKind === 'dodge') || (customId === 'fight-dodge' && cycleKind === 'attack')) {

			/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'SUCCESS';

			winPoints += 1;
		}

		/* Here we change the buttons customId's so that they will always stay unique, as well as disabling the buttons. */
		for (const button of botReply.components[botReply.components.length - 1].components) {

			button.customId += totalCycles;
		}

		botReply.components = disableAllComponents(botReply.components);


		totalCycles += 1;

		if (totalCycles < 5) {

			return await fightCycle(totalCycles, cycleKind);
		}

		const experiencePoints = generateRandomNumber(10, 11);
		const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
		const hungerPoints = await decreaseHunger(profileData);
		const thirstPoints = await decreaseThirst(profileData);

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += experiencePoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy -= energyPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger -= hungerPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst -= thirstPoints;
			},
		));

		let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${hungerPoints > 0 ? `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})` : ''}${thirstPoints > 0 ? `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` : ''}`;

		const userInjuryObject = { ...profileData.injuries };


		if (winPoints < 0) {

			winPoints = 0;
		}

		winPoints = pullFromWeightedTable({ 0: 8 - winPoints, 1: 8, 2: winPoints });

		if (winPoints == 2) {

			embed.description = `*For a moment it looks like the human might get the upper hand before ${characterData.name} jumps on them with a big hop. The human falls to the ground and crawls away with a terrified look on their face. It looks like their not coming back.*`;
		}
		else {

			const inventoryObject = {
				commonPlants: { ...serverData.inventory.commonPlants },
				uncommonPlants: { ...serverData.inventory.uncommonPlants },
				rarePlants: { ...serverData.inventory.rarePlants },
				meat: { ...serverData.inventory.meat },
			};
			const { itemType, itemName } = module.exports.getHighestItem(inventoryObject);

			if (inventoryObject[itemType][itemName] > 0) {

				embedFooterStatsText += `\n\n-${Math.round(inventoryObject[itemType][itemName] / 10)} ${itemName} for ${message.guild.name}`;
				inventoryObject[itemType][itemName] -= Math.round(inventoryObject[itemType][itemName] / 10);
			}

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.inventory = inventoryObject;
				},
			);

			embed.description = `*The battle between the human and ${characterData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${characterData.species} tries to jump at them, but the human manages to dodge. Quickly they run in the direction of the food den. They escaped from ${pronoun(characterData, 1)}!*`;

			if (winPoints == 0) {

				const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].health -= healthPoints;
					},
				);

				switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

					case 0:

						userInjuryObject.wounds += 1;

						embed.description = `*The battle between the human and ${characterData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${characterData.species} tries to jump at them, but the human manages to dodge. Unfortunately, a rock is directly in ${characterData.name}'s jump line. A sharp pain runs through ${pronoun(characterData, 2)} hip. A red spot slowly spreads where ${pronoun(characterData, 0)} hit the rock. Meanwhile, the human runs into the food den.*`;

						embedFooterStatsText = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;

						break;

					default:

						userInjuryObject.sprains += 1;

						embed.description = `*The battle between the human and ${characterData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${characterData.species} tries to jump at them, but the human manages to dodge. ${characterData.name} is not prepared for the fall. A sharp pain runs through ${pronoun(characterData, 2)} arm as it bends in the fall. Meanwhile, the human runs into the food den.*`;

						embedFooterStatsText = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
				}
			}

			serverMap.get('nr' + message.guild.id).humans += 1;
		}

		embed.footer.text = embedFooterStatsText + `\n${serverMap.get('nr' + message.guild.id).humans} humans remaining`;

		botReply = await botReply
			.edit({
				embeds: [...embedArray, embed],
				components: [botReply.components[botReply.components.length - 1]],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});

		botReply = await decreaseHealth(userData, botReply, userInjuryObject);
		botReply = await checkLevelUp(message, botReply, userData, serverData);
		await isPassedOut(message, userData, true);

		await coloredButtonsAdvice(message, userData);
		await restAdvice(message, userData);
		await drinkAdvice(message, userData);
		await eatAdvice(message, userData);

		return;
	}

	serverMap.get('nr' + message.guild.id).currentFights -= 1;

	if (serverMap.get('nr' + message.guild.id).humans <= 0 && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

		await message.channel
			.send({
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'The attack is over!',
					description: '*The packmates howl, dance and cheer as the humans run back into the woods. The battle wasn\'t easy, but they were victorious nonetheless.*',
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		clearTimeout(serverMap.get('nr' + message.guild.id).endingTimeout);
		serverMap.delete('nr' + message.guild.id);

		await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			(/** @type {import('../../typedef').ServerSchema} */ s) => {
				s.nextPossibleAttack = Date.now() + 86400000;
			},
		);
	}
	else if (serverMap.get('nr' + message.guild.id).endingTimeout == null && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

		remainingHumans(message, serverData);
	}
};

/**
 * Starts a timeout of 60 seconds after which an attack starts.
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {void}
 */
module.exports.startAttack = (message, serverData) => {

	serverMap.set('nr' + message.guild.id, { startsTimestamp: Date.now() + 60000, humans: serverData.activeUsers.length, endingTimeout: null, currentFights: 0 });
	setTimeout(async function() {

		serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: message.guild.id }));

		if (serverData.activeUsers.length > serverMap.get('nr' + message.guild.id).humans) {

			serverMap.get('nr' + message.guild.id).humans = serverData.activeUsers.length;
		}

		await message.channel
			.send({
				content: serverData.activeUsers.map(user => `<@!${user}>`).join(' '),
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `*The packmates get ready as ${serverMap.get('nr' + message.guild.id).humans} humans run over the borders. Now it is up to them to defend their land.*`,
					footer: { text: 'You have 5 minutes to defeat all the humans. Type \'rp attack\' to attack one.' },
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		serverMap.get('nr' + message.guild.id).startsTimestamp = null;
		serverMap.get('nr' + message.guild.id).endingTimeout = setTimeout(async function() {

			serverMap.get('nr' + message.guild.id).endingTimeout = null;
			if (serverMap.get('nr' + message.guild.id).currentFights <= 0) {

				remainingHumans(message, serverData);
			}
		}, 300000);
	}, 60000);
};

/**
 * Checks if there is an attack that is going to start soon or currently running, and returns the appropriate string.
 * @param {import('discord.js').Message} message
 * @returns  {string | null}
 */
module.exports.remindOfAttack = (message) => {

	if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

		return `Humans will attack in ${Math.floor((serverMap.get('nr' + message.guild.id).startsTimestamp - Date.now()) / 1000)} seconds!`;
	}
	else if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp == null) {

		return 'Humans are attacking the pack! Type `rp attack` to attack.';
	}

	return null;
};

/**
 * Checks if any humans are undefeated and removes items for each that is left.
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
async function remainingHumans(message, serverData) {

	const embed = {
		color: /** @type {`#${string}`} */ (default_color),
		author: { name: message.guild.name, icon_url: message.guild.iconURL() },
		title: 'The attack is over!',
		description: `*Before anyone could stop them, the last ${serverMap.get('nr' + message.guild.id).humans} humans run into the food den, take whatever they can grab and run away. The battle wasn't easy, but it is over at last.*`,
		footer: { text: '' },
	};

	const inventoryObject = {
		commonPlants: { ...serverData.inventory.commonPlants },
		uncommonPlants: { ...serverData.inventory.uncommonPlants },
		rarePlants: { ...serverData.inventory.rarePlants },
		meat: { ...serverData.inventory.meat },
	};
	while (serverMap.get('nr' + message.guild.id).humans > 0) {

		const { itemType, itemName } = module.exports.getHighestItem(inventoryObject);

		if (inventoryObject[itemType][itemName] > 0) {

			embed.footer.text += `\n-${Math.round(inventoryObject[itemType][itemName] / 10)} ${itemName} for ${message.guild.name}`;
			inventoryObject[itemType][itemName] -= Math.round(inventoryObject[itemType][itemName] / 10);
		}

		serverMap.get('nr' + message.guild.id).humans -= 1;
	}

	if (embed.footer.text === '') {

		embed.footer.text = null;
	}

	await serverModel.findOneAndUpdate(
		{ serverId: message.guild.id },
		(/** @type {import('../../typedef').ServerSchema} */ s) => {
			s.inventory = inventoryObject,
			s.nextPossibleAttack = Date.now() + 86400000;
		},
	);

	await message.channel
		.send({ embeds: [embed] })
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	serverMap.delete('nr' + message.guild.id);
}

/**
 * Finds whichever item there is most of, and returns its type and name.
 * @param {{commonPlants: Object<string, number>, uncommonPlants: Object<string, number>, rarePlants: Object<string, number>, meat: Object<string, number>}} inventoryObject
 * @returns {{itemType: 'commonPlants' | 'uncommonPlants' | 'rarePlants' | 'meat', itemName: string}}
 */
module.exports.getHighestItem = (inventoryObject) => {

	/** @type {{commonPlants?: number, uncommonPlants?: number, rarePlants?: number, meat?: number}} */
	const inventoryReduced = {};
	Object.entries(inventoryObject).map(([itemType, items]) => inventoryReduced[itemType] = Math.max(...Object.values(items)));
	/** @type {'commonPlants' | 'uncommonPlants' | 'rarePlants' | 'meat'} */
	const itemType = /** @type {'commonPlants' | 'uncommonPlants' | 'rarePlants' | 'meat'} */ (Object.keys(inventoryReduced).reduce((a, b) => inventoryReduced[a] > inventoryReduced[b] ? a : b));
	const itemName = Object.keys(inventoryObject[itemType]).reduce((a, b) => inventoryObject[itemType][a] > inventoryObject[itemType][b] ? a : b);

	return { itemType, itemName };
};