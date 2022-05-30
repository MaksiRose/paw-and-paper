// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, pullFromWeightedTable, generateRandomNumberWithException } = require('../../utils/randomizers');
const { pickRandomRarePlant, pickRandomUncommonPlant, pickRandomCommonPlant } = require('../../utils/pickRandomPlant');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { introduceQuest } = require('./quest');
const { prefix } = require('../../config.json');
const { execute, serverActiveUsers } = require('../../events/messageCreate');
const { remindOfAttack, startAttack } = require('./attack');
const { pronoun, pronounAndPlural, upperCasePronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { coloredButtonsAdvice } = require('../../utils/adviceMessages');
const sendNoDM = require('../../utils/sendNoDM');

module.exports.name = 'explore';
module.exports.aliases = ['e'];

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

	if (await sendNoDM(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

		return;
	}

	userData = await startCooldown(message);
	let messageContent = remindOfAttack(message);

	if (/** @type {Array<number>} */ Object.values(profileData.inventory).map(type => Object.values(type)).flat().filter(value => value > 0).length > 25) {

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

	if (profileData.rank === 'Youngling') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*A hunter cuts ${characterData.name} as they see ${pronoun(characterData, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const responseTime = profileData.rank === 'Elderly' ? 3_000 : profileData.rank === 'Hunter' || profileData.rank === 'Healer' ? 4_000 : 5_000;
	const userSpeciesMap = speciesMap.get(characterData.species);

	const allBiomesArray = [
		['forest', 'taiga', 'tundra'],
		['shrubland', 'savanna', 'desert'],
		['river', 'coral reef', 'ocean'],
	][
		['cold', 'warm', 'water'].indexOf(userSpeciesMap.habitat)
	].slice(0, (profileData.rank == 'Elderly') ? 3 : (profileData.rank == 'Healer' || profileData.rank == 'Hunter') ? 2 : 1);

	/* This is up since it is used in the getBiome-function, so it has to be declared early */
	let filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id;

	/** @type {'forest' | 'taiga' | 'tundra' | 'shrubland' | 'savanna' | 'desert' | 'river' | 'coral reef' | 'ocean' | null} */
	const chosenBiome = allBiomesArray.includes(argumentsArray.join(' ').toLowerCase()) ? /** @type {'forest' | 'taiga' | 'tundra' | 'shrubland' | 'savanna' | 'desert' | 'river' | 'coral reef' | 'ocean'} */ (argumentsArray.join(' ').toLowerCase()) : await getBiome();
	const chosenBiomeNumber = allBiomesArray.findIndex(index => index === chosenBiome);

	if (chosenBiomeNumber === -1) {

		return;
	}

	const waitingArray = [
		['⬛', '⬛', '⬛', '🚩', '⬛', '⬛', '⬛'],
		['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
		['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
		['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
		['⬛', '⬛', '⬛', '📍', '⬛', '⬛', '⬛'],
	];

	const userHabitatEmojisArray = [
		['🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔'],
		['🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫'],
		['🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪨', '🪵', '🌴'],
	][
		['cold', 'warm', 'water'].indexOf(userSpeciesMap.habitat)
	];

	for (let index = 0; index < generateRandomNumber(3, 3); index++) {

		const [randomVerticalPos, randomHorizontalPos] = getRandomBox(waitingArray);
		waitingArray[randomVerticalPos][randomHorizontalPos] = userHabitatEmojisArray[generateRandomNumber(userHabitatEmojisArray.length, 0)];
	}

	const waitingString = `*${characterData.name} slips out of camp, ${pronoun(characterData, 2)} body disappearing in the morning mist. For a while ${pronoun(characterData, 0)} will look around in the ${chosenBiome}, searching for anything of use…*\n`;


	/** @type {{vertical: number | null, horizontal: number | null}} */
	let currentPushpinPosition = { vertical: null, horizontal: null };
	/** @type {{vertical: number | null, horizontal: number | null}} */
	let newPushpinPosition = { vertical: null, horizontal: null };

	for (let line = 0; line < waitingArray.length; line++) {

		for (let element = 0; element < waitingArray[line].length; element++) {

			if (waitingArray[line][element] === '📍') {

				currentPushpinPosition = { vertical: line, horizontal: element };
				newPushpinPosition = { vertical: line, horizontal: element };
			}
		}
	}

	const waitingComponent = new MessageActionRow({
		components: [ new MessageButton({
			customId: 'explore-left',
			emoji: '⬅️',
			disabled: waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal - 1] === '⬛' ? false : true,
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'explore-up',
			emoji: '⬆️',
			disabled: waitingArray[currentPushpinPosition.vertical - 1] !== undefined && waitingArray[currentPushpinPosition.vertical - 1][currentPushpinPosition.horizontal] === '⬛' ? false : true,
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'explore-down',
			emoji: '⬇️',
			disabled: waitingArray[currentPushpinPosition.vertical + 1] !== undefined && waitingArray[currentPushpinPosition.vertical + 1][currentPushpinPosition.horizontal] === '⬛' ? false : true,
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'explore-right',
			emoji: '➡️',
			disabled: waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal + 1] === '⬛' ? false : true,
			style: 'SECONDARY',
		})],
	});

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: waitingString + joinNestedArray(waitingArray),
				footer: { text: 'This game is voluntary to skip waiting time. If you don\'t mind waiting, you can ignore this game.' },
			}],
			components: [waitingComponent],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('explore-') && i.user.id === message.author.id;

	const collector = message.channel.createMessageComponentCollector({ filter, time: 15_000 });

	collector.on('collect', interaction => {

		if (waitingArray[newPushpinPosition.vertical][newPushpinPosition.horizontal] === '📍') {

			if (interaction.customId === 'explore-left') { newPushpinPosition.horizontal -= 1; }
			if (interaction.customId === 'explore-up') { newPushpinPosition.vertical -= 1; }
			if (interaction.customId === 'explore-down') { newPushpinPosition.vertical += 1; }
			if (interaction.customId === 'explore-right') { newPushpinPosition.horizontal += 1; }
		}
	});

	/** @type {{vertical: number | null, horizontal: number | null}} */
	let oldGoalPosition = { vertical: null, horizontal: null };
	/** @type {{vertical: number | null, horizontal: number | null}} */
	let currentGoalPosition = { vertical: null, horizontal: null };

	for (let line = 0; line < waitingArray.length; line++) {

		for (let element = 0; element < waitingArray[line].length; element++) {

			if (waitingArray[line][element] === '🚩') {

				currentGoalPosition = { vertical: line, horizontal: element };
			}
		}
	}


	await new Promise((resolve) => {

		const waitingInterval = setInterval(async function(array) {

			let options = [
				{ vertical: currentGoalPosition.vertical, horizontal: currentGoalPosition.horizontal - 1 },
				{ vertical: currentGoalPosition.vertical, horizontal: currentGoalPosition.horizontal + 1 },
				{ vertical: currentGoalPosition.vertical - 1, horizontal: currentGoalPosition.horizontal },
				{ vertical: currentGoalPosition.vertical + 1, horizontal: currentGoalPosition.horizontal },
			].filter(position => array[position.vertical] !== undefined && (array[position.vertical][position.horizontal] === '⬛' || array[position.vertical][position.horizontal] === '📍'));

			if (options.length > 1) {

				options = options.filter(position => position.vertical !== oldGoalPosition.vertical || position.horizontal !== oldGoalPosition.horizontal);
			}

			const newGoalPosition = options[generateRandomNumber(options.length, 0)];


			array[newGoalPosition.vertical][newGoalPosition.horizontal] = '🚩';
			array[currentGoalPosition.vertical][currentGoalPosition.horizontal] = '⬛';

			oldGoalPosition = { ...currentGoalPosition };
			currentGoalPosition = { ...newGoalPosition };


			array[currentPushpinPosition.vertical][currentPushpinPosition.horizontal] = '⬛';
			array[newPushpinPosition.vertical][newPushpinPosition.horizontal] = '📍';

			const oldPushPinPosition = { ...currentPushpinPosition };
			currentPushpinPosition = { ...newPushpinPosition };


			// if the currentpushpinposition is equal to the currentgoalposition OR if both the oldgoalposition is equal to the newpushpinposition and the oldpinposition equal to the newgoalposition, end the game early
			if ((currentGoalPosition.vertical === currentPushpinPosition.vertical && currentGoalPosition.horizontal === currentPushpinPosition.horizontal) || ((oldGoalPosition.vertical === newPushpinPosition.vertical && oldGoalPosition.horizontal === newPushpinPosition.horizontal) && (oldPushPinPosition.vertical === newGoalPosition.vertical && oldPushPinPosition.horizontal === newGoalPosition.horizontal))) {

				clearInterval(waitingInterval);
				resolve();
			}


			waitingComponent.components[0].disabled = waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal - 1] === '⬛' || waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal - 1] === '🚩' ? false : true;
			waitingComponent.components[1].disabled = waitingArray[currentPushpinPosition.vertical - 1] !== undefined && (waitingArray[currentPushpinPosition.vertical - 1][currentPushpinPosition.horizontal] === '⬛' || waitingArray[currentPushpinPosition.vertical - 1][currentPushpinPosition.horizontal] === '🚩') ? false : true;
			waitingComponent.components[2].disabled = waitingArray[currentPushpinPosition.vertical + 1] !== undefined && (waitingArray[currentPushpinPosition.vertical + 1][currentPushpinPosition.horizontal] === '⬛' || waitingArray[currentPushpinPosition.vertical + 1][currentPushpinPosition.horizontal] === '🚩') ? false : true;
			waitingComponent.components[3].disabled = waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal + 1] === '⬛' || waitingArray[currentPushpinPosition.vertical][currentPushpinPosition.horizontal + 1] === '🚩' ? false : true;

			botReply = await botReply
				.edit({
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: waitingString + joinNestedArray(array),
						footer: { text: 'This game is voluntary to skip waiting time. If you don\'t mind waiting, you can ignore this game.' },
					}],
					components: [waitingComponent],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}, 1500, waitingArray);

		setTimeout(() => {

			clearInterval(waitingInterval);
			resolve();
		}, 15000);
	});


	await botReply
		.delete()
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await message.channel
		.sendTyping()
		.catch((error) => {
			throw new Error(error);
		});

	const experiencePoints = chosenBiomeNumber == 2 ? generateRandomNumber(41, 20) : chosenBiomeNumber == 1 ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);
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
	characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	profileData = characterData?.profiles?.[message.guild.id];

	const embed = {
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: '',
		footer: { text: '' },
	};

	const embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${(hungerPoints > 0) ? `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})` : ''}${(thirstPoints > 0) ? `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` : ''}`;

	const userInjuryObject = { ...profileData.injuries };


	messageContent = remindOfAttack(message);
	const highRankProfilesCount = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
		.find(
			(/** @type {import('../../typedef').ProfileSchema} */ u) => Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].rank !== 'Youngling').length > 0))
		.map(u => Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].rank !== 'Youngling').length)
		.reduce((a, b) => a + b, 0);
	const serverInventoryCount = Object.values(serverData.inventory).map(type => Object.values(type)).flat().reduce((a, b) => a + b, 0);

	// If the server has more items than 8 per profile. It's 2 more than counted when the humans spawn, to give users a bit of leeway
	if (serverInventoryCount > highRankProfilesCount * 8 && messageContent === null && serverData.nextPossibleAttack <= Date.now()) {

		botReply = await findHumans();
	}
	else if (chosenBiomeNumber === (allBiomesArray.length - 1) && generateRandomNumber((profileData.rank === 'Elderly') ? 500 : (profileData.rank === 'Hunter' || profileData.rank == 'Healer') ? 375 : 250, 1) === 1) {

		botReply = await findQuest();
	}
	else if (pullFromWeightedTable({ 0: 10, 1: 90 + profileData.sapling.waterCycles }) === 0) {

		botReply = await findSaplingOrNothing();
	}
	else if (pullFromWeightedTable({ 0: profileData.rank === 'Healer' ? 2 : 1, 1: profileData.rank === 'Hunter' ? 2 : 1 }) === 0) {

		botReply = await findPlant();
	}
	else {

		botReply = await findEnemy();
	}

	botReply = await decreaseHealth(userData, botReply, userInjuryObject);
	botReply = await checkLevelUp(message, botReply, userData, serverData);
	await isPassedOut(message, userData, true);

	await coloredButtonsAdvice(message, userData);


	/**
	 * Starts a human attack.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findHumans() {

		// The numerator is the amount of items above 6 per profile, the denominator is the amount of profiles
		const humanCount = Math.round((serverInventoryCount - (highRankProfilesCount * 6)) / highRankProfilesCount);
		startAttack(message, humanCount);

		embed.description = `*${characterData.name} has just been looking around for food when ${pronounAndPlural(characterData, 0, 'suddenly hear')} voices to ${pronoun(characterData, 2)} right. Cautiously ${pronounAndPlural(characterData, 0, 'creep')} up, and sure enough: a group of humans! It looks like it's around ${humanCount}. They seem to be discussing something, and keep pointing over towards where the pack is lying. Alarmed, the ${characterData.displayedSpecies || characterData.species} runs away. **${upperCasePronoun(characterData, 0)} must gather as many packmates as possible to protect the pack!***`;
		embed.footer.text = `${embedFooterStatsText}\n\nYou have two minutes to prepare before the humans will attack!`;

		return await message
			.reply({
				content: serverActiveUsers.get(message.guild.id).map(user => `<@${user}>`).join(' '),
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => {throw new Error(error); });
	}

	/**
	 * Gives the user a quest.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findQuest() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[characterData._id].profiles[message.guild.id].hasQuest = true;
			},
		);

		botReply = await introduceQuest(message, userData, embedArray, embedFooterStatsText);

		filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId === 'quest-start' && i.user.id === message.author.id;

		botReply
			.awaitMessageComponent({ filter, time: 30_000 })
			.then(async interaction => {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				message.content = `${prefix}quest start`;

				await execute(client, message);
			})
			.catch(async () => {

				await botReply
					.edit({ components: disableAllComponents(botReply.components) })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			});

		return botReply;
	}

	/**
	 * Gives the user a ginkgo sapling, or nothing if they already have one.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findSaplingOrNothing() {

		if (profileData.sapling.exists === false) {

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[characterData._id].profiles[message.guild.id].sapling = { exists: true, health: 50, waterCycles: 0, nextWaterTimestamp: Date.now(), lastMessageChannelId: message.channel.id };
				},
			));

			embed.description = `*${characterData.name} is looking around for useful things around ${pronoun(characterData, 1)} when ${pronounAndPlural(characterData, 0, 'discover')} the sapling of a ginkgo tree. The ${characterData.displayedSpecies || characterData.species} remembers that they bring good luck and health. Surely it can't hurt to bring it back to the pack!*`;
			embed.footer.text = embedFooterStatsText + '\nWater the ginkgo sapling with \'rp water\'.';
		}
		else {

			embed.description = `*${characterData.name} trots back into camp, mouth empty, and luck run out. Maybe ${pronoun(characterData, 0)} will go exploring again later, bring something that time!*`;
			embed.footer.text = embedFooterStatsText;
		}

		return await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				allowedMentions: { repliedUser: true },
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}

	/**
	 * Starts a game in which the user can find a plant.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findPlant() {

		const emojiToAvoid = '🏕️';
		const emojiList = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰'];


		/** @type {string | null} */
		let foundItem = null;

		switch (true) {

			case (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.sapling.waterCycles }) == 1 && chosenBiomeNumber > 0):

				switch (true) {

					case (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.sapling.waterCycles }) == 1 && chosenBiomeNumber == 2):

						foundItem = await pickRandomRarePlant();

						break;

					default:

						foundItem = await pickRandomUncommonPlant();
				}

				break;

			default:

				foundItem = await pickRandomCommonPlant();
		}

		if (userSpeciesMap.habitat === 'warm') {

			embed.description = `*For a while, ${characterData.name} has been trudging through the hot sand, searching in vain for something useful. ${upperCasePronounAndPlural(characterData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(characterData, 0, 'discover')} a ${foundItem} in a small, lone bush. Now ${pronounAndPlural(characterData, 0, 'just need')} to pick it up gently...*`;
		}

		if (userSpeciesMap.habitat === 'cold') {

			embed.description = `*For a while, ${characterData.name} has been trudging through the dense undergrowth, searching in vain for something useful. ${upperCasePronounAndPlural(characterData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(characterData, 0, 'discover')} a ${foundItem} at the end of a tree trunk. Now ${pronounAndPlural(characterData, 0, 'just need')} to pick it up gently...*`;
		}

		if (userSpeciesMap.habitat === 'water') {

			embed.description = `*For a while, ${characterData.name} has been swimming through the water, searching in vain for something useful. ${upperCasePronounAndPlural(characterData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(characterData, 0, 'discover')} a ${foundItem} among large algae. Now ${pronounAndPlural(characterData, 0, 'just need')} to pick it up gently...*`;
		}

		embed.footer.text = `You will be presented five buttons with five emojis each. The footer will show you an emoji, and you have to find the button with that emoji, but without the campsite (${emojiToAvoid}).`;

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [ new MessageActionRow({
					components: [ new MessageButton({
						customId: 'plant-pickup',
						label: 'Pick up',
						emoji: '🌿',
						style: 'PRIMARY',
					}), new MessageButton({
						customId: 'plant-leave',
						label: 'Leave',
						emoji: '💨',
						style: 'PRIMARY',
					})],
				})],
				allowedMentions: { repliedUser: true },
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('plant') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 15_000 })
			.catch(() => { return null; });

		if (interaction === null || interaction.customId === 'plant-leave') {

			embed.description = `*After thinking about it for a moment, ${characterData.name} decides ${pronounAndPlural(characterData, 0, 'is', 'are')} too tired to focus on picking up the plant. It's better to leave it there in case another pack member comes along.*`;
			embed.footer.text = `${embedFooterStatsText}`;

			return await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		/* This is done so that later, these buttons aren't copied over. */
		botReply.components = [];

		return await pickupCycle(0, -1, 0);

		/**
		 * Creates a message with 5 buttons to click, then evaluates the results based on which button was clicked.
		 * @param {number} totalCycles
		 * @param {number} lastRoundEmojiIndex
		 * @param {number} winPoints
		 * @returns {Promise<import('discord.js').Message>}
		 */
		async function pickupCycle(totalCycles, lastRoundEmojiIndex, winPoints) {

			const { emojiToFind, buttonsArray, correctButton, incorrectButton, thisRoundEmojiIndex } = module.exports.createButtons(emojiList, lastRoundEmojiIndex, userHabitatEmojisArray, emojiToAvoid);

			embed.footer.text = `Click the button with this emoji: ${emojiToFind}. But watch out for the campsite (🏕️)!`;

			const herbComponent = new MessageActionRow();

			for (let i = 0; i < 5; i++) {

				herbComponent.components.push(new MessageButton({ customId: `plant-${i}`, label: buttonsArray[i].join(' '), style: 'SECONDARY' }));
			}

			botReply = await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: [...botReply.components.length > 0 ? [botReply.components[botReply.components.length - 1]] : [], herbComponent],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId.includes(`${correctButton}`))]).style = 'PRIMARY';

			const { customId } = await botReply
				.awaitMessageComponent({ filter, time: responseTime })
				.catch(() => { return { customId: '' }; });

			if (customId !== '') {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'DANGER';
			}

			if (customId.includes(`${incorrectButton}`) === true) {

				winPoints -= 1;
			}

			if (customId?.includes(`${correctButton}`) === true) {

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

			if (totalCycles < 3) {

				return await pickupCycle(totalCycles, thisRoundEmojiIndex, winPoints);
			}

			if (winPoints < 0) { winPoints = 0; }

			winPoints = pullFromWeightedTable({ 0: 3 - winPoints, 1: winPoints % 3, 2: winPoints });

			if (winPoints === 2) {

				const userInventory = {
					commonPlants: { ...profileData.inventory.commonPlants },
					uncommonPlants: { ...profileData.inventory.uncommonPlants },
					rarePlants: { ...profileData.inventory.rarePlants },
					meat: { ...profileData.inventory.meat },
				};

				for (const itemCategory of Object.keys(userInventory)) {

					// @ts-ignore
					if (Object.hasOwn(userInventory[itemCategory], foundItem)) {

						userInventory[itemCategory][foundItem] += 1;
					}
				}

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ userId: message.author.id },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[characterData._id].profiles[message.guild.id].inventory = userInventory;
					},
				));

				embed.description = `*${characterData.name} gently lowers ${pronoun(characterData, 2)} head, picking up the ${foundItem} and carrying it back in ${pronoun(characterData, 2)} mouth. What a success!*`;

				embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundItem}`;

				return await botReply
					.edit({
						embeds: [...embedArray, embed],
						components: [botReply.components[botReply.components.length - 1]],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}

			if (winPoints === 1) {

				if (userSpeciesMap.habitat === 'warm') {

					embed.description = `*${characterData.name} tries really hard to pick up the ${foundItem} that ${pronoun(characterData, 0)} discovered in a small, lone bush. But as the ${characterData.displayedSpecies || characterData.species} tries to pick it up, it just breaks into little pieces.*`;
				}

				if (userSpeciesMap.habitat === 'cold') {

					embed.description = `*${characterData.name} tries really hard to pick up the ${foundItem} that ${pronoun(characterData, 0)} discovered at the end of a tree trunk. But as the ${characterData.displayedSpecies || characterData.species} tries to pick it up, it just breaks into little pieces.*`;
				}

				if (userSpeciesMap.habitat === 'water') {

					embed.description = `*${characterData.name} tries really hard to pick up the ${foundItem} that ${pronoun(characterData, 0)} discovered among large algae. But as the ${characterData.displayedSpecies || characterData.species} tries to pick it up, it just breaks into little pieces.*`;
				}

				embed.footer.text = embedFooterStatsText;

				return await botReply
					.edit({
						embeds: [...embedArray, embed],
						components: [botReply.components[botReply.components.length - 1]],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}

			const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[characterData._id].profiles[message.guild.id].health -= healthPoints;
				},
			));

			const allElderlyUsersArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find(
				(/** @type {import('../../typedef').ProfileSchema} */ u) => {
					const thisServerProfiles = Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined).map(c => c.profiles[message.guild.id]);
					return thisServerProfiles.filter(p => {
						return p.rank === 'Elderly';
					}).length > 0;
				}));

			switch (true) {

				case (pullFromWeightedTable({ 0: 1, 1: 2 }) == 0 && allElderlyUsersArray.length > 1):

					userInjuryObject.poison = true;

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*Piles of sand and lone, scraggly bushes are dotting the landscape all around ${characterData.name}. ${upperCasePronounAndPlural(characterData, 0, 'pad')} through the scattered branches from long-dead trees, carefully avoiding the cacti, trying to reach the ${foundItem} ${pronoun(characterData, 0)} saw. The ${characterData.displayedSpecies || characterData.species} steps on a root but feels it twist and pulse before it leaps from its camouflage and latches onto ${pronoun(characterData, 2)} body. The snake pumps poison into ${pronoun(characterData, 1)} while ${pronounAndPlural(characterData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*Many sticks and roots are popping up all around ${characterData.name}. ${upperCasePronounAndPlural(characterData, 0, 'shuffle')} through the fallen branches and twisting vines, trying to reach the ${foundItem} ${pronoun(characterData, 0)} found. The ${characterData.displayedSpecies || characterData.species} steps on a root but feels it weave and pulse before it leaps from its camouflage and latches onto ${pronoun(characterData, 2)} body. The snake pumps poison into ${pronoun(characterData, 1)} while ${pronounAndPlural(characterData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*Many plants and jellyfish are popping up all around ${characterData.name}. ${upperCasePronounAndPlural(characterData, 0, 'weave')} through the jellyfish and twisting kelp, trying to reach the ${foundItem} ${pronoun(characterData, 0)} found. The ${characterData.displayedSpecies || characterData.species} pushes through a piece of kelp but feels it twist and pulse before it latches onto ${pronoun(characterData, 2)} body. The jellyfish wraps ${pronoun(characterData, 1)} with its stingers, poison flowing into ${pronoun(characterData, 1)} while ${pronounAndPlural(characterData, 0, 'thrashes', 'trash')} around trying to throw it off, finally succeeding and rushing away to the surface.*`;
					}

					embed.footer.text = `-${healthPoints} HP (from poison)\n${embedFooterStatsText}`;

					break;

				case (pullFromWeightedTable({ 0: 1, 1: 1 }) == 0 && profileData.injuries.cold == false):

					userInjuryObject.cold = true;

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*${characterData.name} pads along the ground, dashing from bush to bush, inspecting every corner for something ${pronoun(characterData, 0)} could add to the inventory. Suddenly, the ${characterData.displayedSpecies || characterData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(characterData, 2)} throat.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*${characterData.name} plots around the forest, dashing from tree to tree, inspecting every corner for something ${pronoun(characterData, 0)} could add to the inventory. Suddenly, the ${characterData.displayedSpecies || characterData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(characterData, 2)} throat.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*${characterData.name} flips around in the water, swimming from rock to rock, inspecting every nook for something ${pronoun(characterData, 0)} could add to the inventory. Suddenly, the ${characterData.displayedSpecies || characterData.species} falters in ${pronoun(characterData, 2)} stroke, feeling tired and feeble. A coughing fit grew louder, bubbles escaping ${pronoun(characterData, 2)} throat to rise to the surface.*`;
					}

					embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

					break;

				default:

					userInjuryObject.infections += 1;

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*The soft noise of sand shifting on the ground spooks ${characterData.name} as ${pronounAndPlural(characterData, 0, 'walk')} around the area, searching for something useful for ${pronoun(characterData, 2)} pack. A warm wind brushes against ${pronoun(characterData, 2)} side, and a cactus bush sweeps atop ${pronoun(characterData, 2)} path, going unnoticed. A needle pricks into ${pronoun(characterData, 2)} skin, sending pain waves through ${pronoun(characterData, 2)} body. While removing the needle ${characterData.name} notices how swollen the wound looks. It is infected.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*The thunks of acorns falling from trees spook ${characterData.name} as ${pronounAndPlural(characterData, 0, 'prance')} around the forest, searching for something useful for ${pronoun(characterData, 2)} pack. A warm wind brushes against ${pronoun(characterData, 2)} side, and a thorn bush sweeps atop ${pronoun(characterData, 2)} path, going unnoticed. A thorn pricks into ${pronoun(characterData, 2)} skin, sending pain waves through ${pronoun(characterData, 2)} body. While removing the thorn ${characterData.name} notices how swollen the wound looks. It is infected.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*The sudden silence in the water spooks ${characterData.name} as ${pronounAndPlural(characterData, 0, 'swim')} around in the water, searching for something useful for ${pronoun(characterData, 2)} pack. A rocky outcropping appears next to ${pronoun(characterData, 1)}, unnoticed. The rocks scrape into ${pronoun(characterData, 2)} side, sending shockwaves of pain up ${pronoun(characterData, 2)} flank. ${characterData.name} takes a closer look and notices how swollen the wound is. It is infected.*`;
					}

					embed.footer.text = `-${healthPoints} HP (from infection)\n${embedFooterStatsText}`;
			}

			return await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: [botReply.components[botReply.components.length - 1]],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}
	}

	/**
	 * Starts a game in which the user can find meat.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findEnemy() {

		let currentCombo = 0;
		let highestCombo = 0;
		let opponentLevel = generateRandomNumber(1 + Math.ceil(profileData.levels / 10) * 5, (profileData.levels > 2 ? profileData.levels : 3) - Math.ceil(profileData.levels / 10) * 2);
		chosenBiomeNumber === 2 ? generateRandomNumber(profileData.levels > 40 ? profileData.levels - 15 : 25, 26) : chosenBiomeNumber === 1 ? generateRandomNumber(15, 11) : generateRandomNumber(10, 1);
		const opponentsArray = [...userSpeciesMap.biome1OpponentArray];
		if (chosenBiomeNumber > 0) { opponentsArray.push(...userSpeciesMap.biome2OpponentArray); }
		if (chosenBiomeNumber === 2) { opponentsArray.push(...userSpeciesMap.biome3OpponentArray); }

		const opponentSpecies = opponentsArray[generateRandomNumber(opponentsArray.length, 0)];
		let playerLevel = profileData.levels;

		if (userSpeciesMap.habitat == 'warm') {

			embed.description = `*${characterData.name} creeps close to the ground, ${pronoun(characterData, 2)} pelt blending with the sand surrounding ${pronoun(characterData, 1)}. The ${characterData.displayedSpecies || characterData.species} watches a pile of shrubs, ${pronoun(characterData, 2)} eyes flitting around before catching a motion out of the corner of ${pronoun(characterData, 2)} eyes. A particularly daring ${opponentSpecies} walks on the ground surrounding the bushes before sitting down and cleaning itself.*`;
		}

		if (userSpeciesMap.habitat == 'cold') {

			embed.description = `*${characterData.name} pads silently to the clearing, stopping just shy of leaving the safety of the thick trees that housed ${pronoun(characterData, 2)} pack, camp, and home. A lone ${opponentSpecies} stands in the clearing, snout in the stream that cuts the clearing in two, leaving it unaware of the ${characterData.displayedSpecies || characterData.species} a few meters behind it, ready to pounce.*`;
		}

		if (userSpeciesMap.habitat == 'water') {

			embed.description = `*${characterData.name} hides behind some kelp, looking around the clear water for any prey. A lone ${opponentSpecies} swims around aimlessly, not alarmed of any potential attacks. The ${characterData.displayedSpecies || characterData.species} gets in position, contemplating an ambush.*`;
		}

		embed.footer.text = `The ${opponentSpecies} is level ${opponentLevel}.\nYou will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.`;

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [new MessageActionRow({
					components: [ new MessageButton({
						customId: 'enemy-fight',
						label: 'Fight',
						emoji: '⚔️',
						style: 'PRIMARY',
					}), new MessageButton({
						customId: 'enemy-flee',
						label: 'Flee',
						emoji: '💨',
						style: 'PRIMARY',
					})],
				})],
				allowedMentions: { repliedUser: true },
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		filter = (/** @type {{ customId: string; user: { id: string; }; }} */ i) => (i.customId === 'enemy-flee' || i.customId === 'enemy-fight') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 15_000 })
			.catch(() => { return null; });

		if (interaction === null || interaction.customId === 'enemy-flee') {

			if (userSpeciesMap.habitat == 'warm') {

				embed.description = `*${characterData.name} eyes the ${opponentSpecies}, which is still unaware of the possible danger. The ${characterData.displayedSpecies || characterData.species} paces, still unsure whether to attack. Suddenly, the ${characterData.displayedSpecies || characterData.species}'s head shoots up as it tries to find the source of the sound before running away. Looks like this hunt was unsuccessful.*`;
			}

			if (userSpeciesMap.habitat == 'cold') {

				embed.description = `*The ${opponentSpecies} sits in the clearing, unaware of ${characterData.name} hiding in the thicket behind it. The ${characterData.displayedSpecies || characterData.species} watches as the animal gets up, shakes the loose water droplets from its mouth, and walks into the forest, its shadow fading from ${characterData.name}'s sight. Looks like this hunt was unsuccessful.*`;
			}

			if (userSpeciesMap.habitat == 'water') {

				embed.description = `*${characterData.name} looks at the ${opponentSpecies}, which is still unaware of ${pronoun(characterData, 1)} watching through the kelp. Subconsciously, the ${characterData.displayedSpecies || characterData.species} starts swimming back and fourth, still unsure whether to attack. The ${opponentSpecies}'s head turns in a flash to eye the suddenly moving kelp before it frantically swims away. Looks like this hunt was unsuccessful.*`;
			}

			embed.footer.text = embedFooterStatsText;

			return await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		/* This is done so that later, these buttons aren't copied over. */
		botReply.components = [];

		return await fightCycle(0, '');

		/**
		 * Creates a message with 5 buttons to click, then evaluates the results based on which button was clicked.
		 * @param {number} totalCycles
		 * @param {string} cycleKind
		 * @returns {Promise<import('discord.js').Message>}
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

				embed.description = `⏫ *The ${opponentSpecies} gets ready to attack. ${characterData.name} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
			}

			if (cycleKind == 'dodge') {

				embed.description = `↪️ *Looks like the ${opponentSpecies} is preparing a maneuver for ${characterData.name}'s next move. The ${characterData.displayedSpecies || characterData.species} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
			}

			if (cycleKind == 'defend') {

				embed.description = `⏺️ *The ${opponentSpecies} gets into position to oppose an attack. ${characterData.name} must think quickly about how ${pronounAndPlural(characterData, 0, 'want')} to react.*`;
			}

			botReply = await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: [...botReply.components.length > 0 ? [botReply.components[botReply.components.length - 1]] : [], fightComponents],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			if (cycleKind === 'defend') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-attack')]).style = 'PRIMARY'; }
			if (cycleKind === 'dodge') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-defend')]).style = 'PRIMARY'; }
			if (cycleKind === 'attack') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'fight-dodge')]).style = 'PRIMARY'; }

			filter = i => (i.customId === 'fight-attack' || i.customId === 'fight-defend' || i.customId === 'fight-dodge') && i.user.id === message.author.id;

			const { customId } = await botReply
				.awaitMessageComponent({ filter, time: responseTime })
				.catch(() => { return { customId: '' }; });

			if (customId !== '') {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'DANGER';
			}

			if ((customId === 'fight-attack' && cycleKind === 'dodge') || (customId === 'fight-defend' && cycleKind === 'attack') || (customId === 'fight-dodge' && cycleKind === 'defend')) {

				opponentLevel += Math.ceil(profileData.levels / 10) * 2;
			}

			if ((customId === 'fight-attack' && cycleKind === 'defend') || (customId === 'fight-defend' && cycleKind === 'dodge') || (customId === 'fight-dodge' && cycleKind === 'attack')) {

				/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'SUCCESS';

				playerLevel += Math.ceil(profileData.levels / 10);
				currentCombo += 1;
				if (currentCombo > highestCombo) { highestCombo = currentCombo; }
			}
			else { currentCombo = 0; }

			/* Here we change the buttons customId's so that they will always stay unique, as well as disabling the buttons. */
			for (const button of botReply.components[botReply.components.length - 1].components) {

				button.customId += totalCycles;
			}

			botReply.components = disableAllComponents(botReply.components);


			totalCycles += 1;

			if (totalCycles < 3) {

				return await fightCycle(totalCycles, cycleKind);
			}

			playerLevel += (highestCombo === 3 ? 2 : highestCombo === 2 ? 1 : 0) * Math.ceil(profileData.levels / 10);
			playerLevel = generateRandomNumber(playerLevel, 0);
			opponentLevel = generateRandomNumber(opponentLevel, 0);

			if (playerLevel === opponentLevel || playerLevel === opponentLevel + 1 || playerLevel === opponentLevel + 2) {

				if (userSpeciesMap.habitat == 'warm') {

					embed.description = `*${characterData.name} and the ${opponentSpecies} are snarling at one another as they retreat to the opposite sides of the hill, now stirred up and filled with sticks from the surrounding bushes. The ${characterData.displayedSpecies || characterData.species} runs back to camp, ${pronoun(characterData, 2)} mouth empty as before.*`;
				}

				if (userSpeciesMap.habitat == 'cold') {

					embed.description = `*${characterData.name} and the ${opponentSpecies} are snarling at one another as they retreat into the bushes surrounding the clearing, now covered in trampled grass and loose clumps of dirt. The ${characterData.displayedSpecies || characterData.species} runs back to camp, ${pronoun(characterData, 2)} mouth empty as before.*`;
				}

				if (userSpeciesMap.habitat == 'water') {

					embed.description = `*${characterData.name} and the ${opponentSpecies} glance at one another as they swim in opposite directions from the kelp, now cloudy from the stirred up dirt. The ${characterData.displayedSpecies || characterData.species} swims back to camp, ${pronoun(characterData, 2)} mouth empty as before.*`;
				}

				embed.footer.text = `${embedFooterStatsText}`;
			}
			else if (playerLevel > opponentLevel) {

				const userInventory = {
					commonPlants: { ...profileData.inventory.commonPlants },
					uncommonPlants: { ...profileData.inventory.uncommonPlants },
					rarePlants: { ...profileData.inventory.rarePlants },
					meat: { ...profileData.inventory.meat },
				};

				userInventory.meat[opponentSpecies] += 1;

				if (userSpeciesMap.habitat == 'warm') {

					embed.description = `*${characterData.name} shakes the sand from ${pronoun(characterData, 2)} paws, the still figure of the ${opponentSpecies} casting a shadow for ${pronoun(characterData, 1)} to rest in before returning home with the meat. ${upperCasePronounAndPlural(characterData, 0, 'turn')} to the dead ${opponentSpecies} to start dragging it back to camp. The meat would be well-stored in the camp, added to the den of food for the night, after being cleaned.*`;
				}

				if (userSpeciesMap.habitat == 'cold') {

					embed.description = `*${characterData.name} licks ${pronoun(characterData, 2)} paws, freeing the dirt that is under ${pronoun(characterData, 2)} claws. The ${characterData.displayedSpecies || characterData.species} turns to the dead ${opponentSpecies} behind ${pronoun(characterData, 1)}, marveling at the size of it. Then, ${upperCasePronounAndPlural(characterData, 0, 'grab')} the ${opponentSpecies} by the neck, dragging it into the bushes and back to the camp.*`;
				}

				if (userSpeciesMap.habitat == 'water') {

					embed.description = `*The ${characterData.displayedSpecies || characterData.species} swims quickly to the surface, trying to stay as stealthy and unnoticed as possible. ${upperCasePronounAndPlural(characterData, 0, 'break')} the surface, gain ${pronoun(characterData, 2)} bearing, and the ${characterData.displayedSpecies || characterData.species} begins swimming to the shore, dragging the dead ${opponentSpecies} up the shore to the camp.*`;
				}

				embed.footer.text = `${embedFooterStatsText}\n\n+1 ${opponentSpecies}`;

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ userId: message.author.id },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[characterData._id].profiles[message.guild.id].inventory = userInventory;
					},
				));
			}
			else if (opponentLevel > playerLevel) {

				const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ userId: message.author.id },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[characterData._id].profiles[message.guild.id].health -= healthPoints;
					},
				));

				switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

					case 0:

						userInjuryObject.wounds += 1;

						if (userSpeciesMap.habitat == 'warm') {

							embed.description = `*The ${characterData.displayedSpecies || characterData.species} rolls over in the sand, pinned down by the ${opponentSpecies}.* "Get off my territory," *it growls before walking away from the shaking form of ${characterData.name} laying on the sand. ${upperCasePronounAndPlural(characterData, 0, 'let')} the ${opponentSpecies} walk away for a little, trying to put space between the two animals. After catching ${pronoun(characterData, 2)} breath, the ${characterData.displayedSpecies || characterData.species} pulls ${pronoun(characterData, 4)} off the ground, noticing sand sticking to ${pronoun(characterData, 2)} side. ${upperCasePronounAndPlural(characterData, 0, 'shake')} ${pronoun(characterData, 2)} body, sending bolts of pain up ${pronoun(characterData, 2)} side from the wound. ${upperCasePronounAndPlural(characterData, 0, 'slowly walk')} away from the valley that the ${opponentSpecies} was sitting in before running back towards camp.*`;
						}

						if (userSpeciesMap.habitat == 'cold') {

							embed.description = `*${characterData.name} runs into the brush, trying to avoid making the wound from the ${opponentSpecies} any worse than it already is. The ${characterData.displayedSpecies || characterData.species} stops and confirms that the ${opponentSpecies} isn't following ${pronoun(characterData, 1)}, before walking back inside the camp borders.*`;
						}

						if (userSpeciesMap.habitat == 'water') {

							embed.description = `*Running from the ${opponentSpecies}, ${characterData.name} flips and spins around in the water, trying to escape from the grasp of the animal behind ${pronoun(characterData, 1)}. ${upperCasePronounAndPlural(characterData, 0, 'slip')} into a small crack in a wall, waiting silently for the creature to give up. Finally, the ${opponentSpecies} swims away, leaving the ${characterData.displayedSpecies || characterData.species} alone. Slowly emerging from the crevice, ${characterData.name} flinches away from the wall as ${pronounAndPlural(characterData, 0, 'hit')} it, a wound making itself known from the fight. Hopefully, it can be treated back at the camp.*`;
						}

						embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;

						break;

					default:

						userInjuryObject.sprains += 1;

						if (userSpeciesMap.habitat == 'warm') {

							embed.description = `*${characterData.name} limps back to camp, ${pronoun(characterData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(characterData, 0)} get away, leaving the enemy alone in the sand that is now stirred up and filled with sticks from the surrounding bushes. Maybe next time, the ${characterData.displayedSpecies || characterData.species} will be successful in ${pronoun(characterData, 2)} hunt.*`;
						}

						if (userSpeciesMap.habitat == 'cold') {

							embed.description = `*${characterData.name} limps back to camp, ${pronoun(characterData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(characterData, 0)} get away, leaving the enemy alone in a clearing now filled with trampled grass and dirt clumps. Maybe next time, the ${characterData.displayedSpecies || characterData.species} will be successful in ${pronoun(characterData, 2)} hunt.*`;
						}

						if (userSpeciesMap.habitat == 'water') {

							embed.description = `*${characterData.name} swims back to camp in pain, ${pronoun(characterData, 2)} fin sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(characterData, 0)} get away, leaving the enemy alone in the water that is now cloudy from the stirred up dirt. Maybe next time, the ${characterData.displayedSpecies || characterData.species} will be successful in ${pronoun(characterData, 2)} hunt.*`;
						}

						embed.footer.text = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
				}
			}

			return await botReply
				.edit({
					embeds: [...embedArray, embed],
					components: [botReply.components[botReply.components.length - 1]],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}
	}

	/**
	 * Sends a message that lets the user pick a biome.
	 * @returns {Promise<'forest' | 'taiga' | 'tundra' | 'shrubland' | 'savanna' | 'desert' | 'river' | 'coral reef' | 'ocean' | null>}
	 */
	async function getBiome() {

		const biomeComponent = new MessageActionRow();

		for (let i = 0; i < allBiomesArray.length; i++) {

			biomeComponent.components.push(new MessageButton({ customId: allBiomesArray[i], label: allBiomesArray[i].charAt(0).toUpperCase() + allBiomesArray[i].slice(1), style: 'PRIMARY' }));
		}

		const getBiomeMessage = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is longing for adventure as ${pronounAndPlural(characterData, 0, 'look')} into the wild outside of camp. All there is to decide is where the journey will lead ${pronoun(characterData, 1)}.*`,
				}],
				components: [biomeComponent],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => allBiomesArray.includes(i.customId) && i.user.id == message.author.id;

		return await getBiomeMessage
			.awaitMessageComponent({ filter, time: 30_000 })
			.then(async interaction => {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return interaction.customId;
			})
			.catch(async () => {

				await getBiomeMessage
					.edit({ components: disableAllComponents(getBiomeMessage.components) })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return null;
			});
	}
};

/**
 * This takes a nested Array representing a field, and picks a random coordinate which is mutatable and surrounded by mutatable positions.
 * @param {Array<Array<string>>} field A field-array containing row-arrays filled with field positions
 * @returns {Array<number>} Coordinates for a random field position
 */
function getRandomBox(field) {

	const randomVertical = generateRandomNumber(field.length, 0);
	const randomLine = field[randomVertical];

	const randomHorizontal = generateRandomNumber(randomLine.length, 0);

	const chosenField = randomLine[randomHorizontal];
	const leftField = randomLine[(randomHorizontal > 0) ? randomHorizontal - 1 : randomHorizontal];
	const rightField = randomLine[(randomHorizontal < randomLine.length - 1) ? randomHorizontal + 1 : randomHorizontal];
	const upperField = field[(randomVertical > 0) ? randomVertical - 1 : randomVertical][randomHorizontal];
	const lowerField = field[(randomVertical < field.length - 1) ? randomVertical + 1 : randomVertical][randomHorizontal];

	return (chosenField == '⬛' && leftField == '⬛' && rightField == '⬛' && upperField == '⬛' && lowerField == '⬛') ? [randomVertical, randomHorizontal] : getRandomBox(field);
}

/**
 * Creates 5 buttons with 5 emojis each, and assigns two of them the emoji to find, of which one also has the emoji to avoid.
 * @param {Array<string>} emojis
 * @param {number} lastRoundEmojiIndex
 * @param {Array<string>} userHabitatEmojisArray
 * @param {string} emojiToAvoid
 * @returns {{emojiToFind: string, buttonsArray: Array<Array<string>>, correctButton: number, incorrectButton: number, thisRoundEmojiIndex: number }}
 */
module.exports.createButtons = (emojis, lastRoundEmojiIndex, userHabitatEmojisArray, emojiToAvoid) => {

	const thisRoundEmojiIndex = generateRandomNumberWithException(emojis.length, 0, lastRoundEmojiIndex);
	const emojiToFind = emojis.splice(thisRoundEmojiIndex, 1)[0];
	emojis = emojis.concat(emojis, userHabitatEmojisArray, userHabitatEmojisArray);

	/** @type {Array<Array<string>>} */
	const buttonsArray = [];
	for (let i = 0; i < 5; i++) {

		/** @type {Array<string>} */
		const buttonEmojis = [];
		for (let j = 0; j < 5; j++) {

			buttonEmojis.push(emojis.splice(generateRandomNumber(emojis.length, 0), 1)[0]);
		}
		buttonsArray.push(buttonEmojis);
	}

	const correctButton = generateRandomNumber(buttonsArray.length, 0);
	buttonsArray[correctButton][generateRandomNumber(5, 0)] = emojiToFind;

	const incorrectButton = generateRandomNumberWithException(buttonsArray.length, 0, correctButton);
	const wrongEmojiPlacement = generateRandomNumber(5, 0);
	buttonsArray[incorrectButton][wrongEmojiPlacement] = emojiToFind;
	buttonsArray[incorrectButton][generateRandomNumberWithException(5, 0, wrongEmojiPlacement)] = emojiToAvoid;

	return { emojiToFind, buttonsArray, correctButton, incorrectButton, thisRoundEmojiIndex };
};

/**
 *
 * @param {Array<Array<string>>} array
 * @returns {string}
 */
function joinNestedArray(array) {

	const newArray = [];

	for (let index = 0; index < array.length; index++) {

		newArray[index] = array[index].join('');
	}

	return newArray.join('\n');
}