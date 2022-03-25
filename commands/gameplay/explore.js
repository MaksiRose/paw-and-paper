const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, pullFromWeightedTable, generateRandomNumberWithException } = require('../../utils/randomizers');
const { pickRandomRarePlant, pickRandomUncommonPlant, pickRandomCommonPlant } = require('../../utils/pickRandomPlant');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { introduceQuest } = require('./quest');
const config = require('../../config.json');
const { execute } = require('../../events/messageCreate');
const { remindOfAttack, startAttack } = require('./attack');
const { pronoun, pronounAndPlural, upperCasePronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');

module.exports = {
	name: 'explore',
	aliases: ['e'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		let messageContent = remindOfAttack(message);

		if ([...Object.values(profileData.inventoryObject).map(type => Object.values(type))].filter(value => value > 0).length > 25) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} approaches the pack borders, ${pronoun(profileData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(profileData, 0, 'is', 'are')} to go exploring, ${pronounAndPlural(profileData, 0, 'decide')} to store some things away first.*`,
				footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.rank == 'Youngling') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A hunter cuts ${profileData.name} as they see ${pronoun(profileData, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const userSpeciesMap = speciesMap.get(profileData.species);

		const allBiomesArray = [
			['forest', 'taiga', 'tundra'],
			['shrubland', 'savanna', 'desert'],
			['river', 'coral reef', 'ocean'],
		][
			['cold', 'warm', 'water'].indexOf(userSpeciesMap.habitat)
		].slice(0, (profileData.rank == 'Elderly') ? 3 : (profileData.rank == 'Healer' || profileData.rank == 'Hunter') ? 2 : 1);

		const chosenBiome = allBiomesArray.includes(argumentsArray.join(' ').toLowerCase()) ? argumentsArray.join(' ').toLowerCase() : await getBiome();
		const chosenBiomeNumber = allBiomesArray.findIndex(index => index == chosenBiome);

		if (chosenBiomeNumber == -1) {

			return;
		}

		const waitingArray = [
			['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
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

		const waitingString = `*${profileData.name} slips out of camp, ${pronoun(profileData, 2)} body disappearing in the morning mist. For a while ${pronoun(profileData, 0)} will look around in the ${chosenBiome}, searching for anything of use…*\n`;


		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: waitingString + joinNestedArray(waitingArray),
		});

		let botReply = await message
			.reply({
				content: messageContent,
				embeds: embedArray,
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		let oldPushpinPosition = { vertical: null, horizontal: null };
		let currentPushpinPosition = { vertical: null, horizontal: null };

		for (let line = 0; line < waitingArray.length; line++) {

			for (let element = 0; element < waitingArray[line].length; element++) {

				if (waitingArray[line][element] == '📍') {

					currentPushpinPosition = { vertical: line, horizontal: element };
				}
			}
		}

		const waitingInterval = setInterval(async function(array) {

			let options = [
				{ vertical: currentPushpinPosition.vertical, horizontal: currentPushpinPosition.horizontal - 1 },
				{ vertical: currentPushpinPosition.vertical, horizontal: currentPushpinPosition.horizontal + 1 },
				{ vertical: currentPushpinPosition.vertical - 1, horizontal: currentPushpinPosition.horizontal },
				{ vertical: currentPushpinPosition.vertical + 1, horizontal: currentPushpinPosition.horizontal },
			].filter(position => array[position.vertical] != undefined && array[position.vertical][position.horizontal] == '⬛');

			if (options.length > 1) {

				options = options.filter(position => position.vertical != oldPushpinPosition.vertical || position.horizontal != oldPushpinPosition.horizontal);
			}

			const newPushpinPosition = options[generateRandomNumber(options.length, 0)];

			array[newPushpinPosition.vertical][newPushpinPosition.horizontal] = '📍';
			array[currentPushpinPosition.vertical][currentPushpinPosition.horizontal] = '⬛';

			oldPushpinPosition = currentPushpinPosition;
			currentPushpinPosition = newPushpinPosition;

			embedArray.splice(-1, 1, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: waitingString + joinNestedArray(array),
			});

			botReply = await botReply
				.edit({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}, 1500, waitingArray);


		await new Promise((resolve) => {

			setTimeout(resolve, 15000);
		});


		clearInterval(waitingInterval);
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

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					experience: +experiencePoints,
					energy: -energyPoints,
					hunger: -hungerPoints,
					thirst: -thirstPoints,
				},
			},
		);

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
		};

		const embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${(hungerPoints > 0) ? `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})` : ''}${(thirstPoints > 0) ? `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` : ''}`;

		const userInjuryObject = { ...profileData.injuryObject };


		serverData = await serverModel.findOne({ serverId: message.guild.id });
		messageContent = remindOfAttack(message);

		if (serverData.activeUsersArray.length >= 3 && messageContent == null && serverData.nextPossibleAttack <= Date.now()) {

			await findHumans();
		}
		else if (chosenBiomeNumber == (profileData.unlockedRanks - 1) && chosenBiomeNumber == (allBiomesArray.length - 1) && generateRandomNumber((profileData.rank == 'Elderly') ? 500 : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? 375 : 250, 1) === 1) {

			await findQuest();
		}
		else if (pullFromWeightedTable({ 0: 10, 1: 90 + profileData.saplingObject.waterCycles }) == 0) {

			await findSaplingOrNothing();
		}
		else if (pullFromWeightedTable({ 0: 1, 1: 1 }) == 0) {

			await findPlant();
		}
		else {

			await findEnemy();
		}

		botReply = await decreaseHealth(message, profileData, botReply, userInjuryObject);
		botReply = await checkLevelUp(profileData, botReply);
		await isPassedOut(message, profileData, true);


		async function findHumans() {

			startAttack(message, serverData);

			embed.description = `*${profileData.name} has just been looking around for food when ${pronounAndPlural(profileData, 0, 'suddenly hear')} voices to ${pronoun(profileData, 2)} right. Cautiously ${pronounAndPlural(profileData, 0, 'creep')} up, and sure enough: a group of humans! They seem to be discussing something, and keep pointing over towards where the pack is lying. Alarmed, the ${profileData.species} runs away. ${upperCasePronoun(profileData, 0)} must gather as many packmates as possible to protect the pack!*`;
			embed.footer.text = `${embedFooterStatsText}\n\nYou have one minute to prepare before the humans will attack!`;

			embedArray.splice(-1, 1, embed);
			return botReply = await message
				.reply({
					content: serverData.activeUsersArray.map(user => `<@${user}>`).join(' '),
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		async function findQuest() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: true } },
			);

			botReply = await introduceQuest(message, profileData, embedArray.slice(0, -1), embedFooterStatsText);

			const filter = i => i.customId === 'quest-start' && i.user.id === message.author.id;

			botReply
				.awaitMessageComponent({ filter, time: 30000 })
				.then(async interaction => {

					await interaction.message
						.delete()
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					message.content = `${config.prefix}quest start`;

					await execute(client, message);
				})
				.catch(async () => {

					await botReply
						.edit({ components: [] })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				});

			return;
		}

		async function findSaplingOrNothing() {

			if (profileData.saplingObject.exists === false) {

				profileData = await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { saplingObject: { exists: true, health: 50, waterCycles: 0, nextWaterTimestamp: Date.now() } } },
				);

				embed.description = `*${profileData.name} is looking around for useful things around ${pronoun(profileData, 1)} when ${pronounAndPlural(profileData, 0, 'discover')} the sapling of a ginkgo tree. The ${profileData.species} remembers that they bring good luck and health. Surely it can't hurt to bring it back to the pack!*`;
				embed.footer.text = embedFooterStatsText + '\nWater the ginkgo sapling with \'rp water\'.';
			}
			else {

				embed.description = `*${profileData.name} trots back into camp, mouth empty, and luck run out. Maybe ${pronoun(profileData, 0)} will go exploring again later, bring something that time!*`;
				embed.footer.text = embedFooterStatsText;
			}

			embedArray.splice(-1, 1, embed);
			return botReply = await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					allowedMentions: { repliedUser: true },
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		async function findPlant() {

			const wrongEmoji = '🏕️';
			let emojiList = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰'];

			const emojiToFind = emojiList.splice(generateRandomNumber(emojiList.length, 0), 1);
			emojiList = emojiList.concat(emojiList, userHabitatEmojisArray, userHabitatEmojisArray);

			const buttonsArray = [];
			for (let i = 0; i < 5; i++) {

				const buttonEmojis = [];
				for (let j = 0; j < 5; j++) {

					buttonEmojis.push(emojiList.splice(generateRandomNumber(emojiList.length, 0), 1));
				}
				buttonsArray.push(buttonEmojis);
			}

			const correctButton = generateRandomNumber(buttonsArray.length, 0);
			buttonsArray[correctButton][generateRandomNumber(5, 0)] = emojiToFind;

			const incorrectButton = generateRandomNumberWithException(buttonsArray.length, 0, correctButton);
			const wrongEmojiPlacement = generateRandomNumber(5, 0);
			buttonsArray[incorrectButton][wrongEmojiPlacement] = emojiToFind;
			buttonsArray[incorrectButton][generateRandomNumberWithException(5, 0, wrongEmojiPlacement)] = wrongEmoji;


			let foundItem = null;

			switch (true) {

				case (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.saplingObject.waterCycles }) == 1 && chosenBiomeNumber > 0):

					switch (true) {

						case (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.saplingObject.waterCycles }) == 1 && chosenBiomeNumber == 2):

							foundItem = await pickRandomRarePlant();

							break;

						default:

							foundItem = await pickRandomUncommonPlant();
					}

					break;

				default:

					foundItem = await pickRandomCommonPlant();
			}

			if (userSpeciesMap.habitat == 'warm') {

				embed.description = `*For a while, ${profileData.name} has been trudging through the hot sand, searching in vain for something useful. ${upperCasePronounAndPlural(profileData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(profileData, 0, 'discover')} a ${foundItem} in a small, lone bush. Now ${pronounAndPlural(profileData, 0, 'just need')} to pick it up gently...*`;
			}

			if (userSpeciesMap.habitat == 'cold') {

				embed.description = `*For a while, ${profileData.name} has been trudging through the dense undergrowth, searching in vain for something useful. ${upperCasePronounAndPlural(profileData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(profileData, 0, 'discord')} a ${foundItem} at the end of a tree trunk. Now ${pronounAndPlural(profileData, 0, 'just need')} to pick it up gently...*`;
			}

			if (userSpeciesMap.habitat == 'water') {

				embed.description = `*For a while, ${profileData.name} has been swimming through the water, searching in vain for something useful. ${upperCasePronounAndPlural(profileData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(profileData, 0, 'discover')} a ${foundItem} among large algae. Now ${pronounAndPlural(profileData, 0, 'just need')} to pick it up gently...*`;
			}

			embed.footer.text = 'You will be presented five buttons with five emojis each. The footer will show you an emoji, and you have to find the button with that emoji, but without the campsite (🏕️).';

			embedArray.splice(-1, 1, embed);
			botReply = await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							customId: 'plant-pickup',
							label: 'Pick up',
							emoji: { name: '🌿' },
							style: 'PRIMARY',
							disabled: (profileData.rank == 'Hunter') ? true : false,
						}, {
							type: 'BUTTON',
							customId: 'plant-leave',
							label: 'Leave',
							emoji: { name: '💨' },
							style: 'PRIMARY',
						}],
					}],
					allowedMentions: { repliedUser: true },
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			const filter = i => i.customId.includes('plant') && i.user.id == message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 15000 })
				.catch(() => null);

			if (interaction == null || interaction.customId === 'plant-leave') {

				embed.description = `*After thinking about it for a moment, ${profileData.name} decides ${pronounAndPlural(profileData, 0, 'is', 'are')} too tired to focus on picking up the plant. It's better to leave it there in case another pack member comes along.*`;
				embed.footer.text = `${embedFooterStatsText}`;

				embedArray.splice(-1, 1, embed);
				return await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			embed.footer.text = `Click the button with this emoji: ${emojiToFind}. But watch out for the campsite (🏕️)!`;

			const selectHerbComponent = {
				type: 'ACTION_ROW',
				components: [],
			};

			for (let i = 0; i < 5; i++) {

				selectHerbComponent.components.push({ type: 'BUTTON', customId: `plant-${i}`, label: buttonsArray[i].join(''), style: 'SECONDARY' });
			}

			embedArray.splice(-1, 1, embed);
			botReply = await botReply
				.edit({
					embeds: embedArray,
					components: [selectHerbComponent],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return await botReply
				.awaitMessageComponent({ filter, time: 5000 })
				.then(async button => {

					if (!button.customId.includes(correctButton)) {

						return Promise.reject();
					}

					const userInventory = {
						commonPlants: { ...profileData.inventoryObject.commonPlants },
						uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
						rarePlants: { ...profileData.inventoryObject.rarePlants },
						meat: { ...profileData.inventoryObject.meat },
					};

					for (const itemCategory of Object.keys(userInventory)) {

						if (Object.hasOwn(userInventory[itemCategory], foundItem)) {

							userInventory[itemCategory][foundItem] += 1;
						}
					}

					profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { inventoryObject: userInventory } },
					);

					embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundItem}`;

					embedArray.splice(-1, 1, embed);
					return botReply = await botReply
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				})
				.catch(async () => {

					const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -healthPoints } },
					);

					const allElderlyProfilesArray = (await profileModel.find({
						serverId: message.guild.id,
						rank: 'Elderly',
					})).map(user => user.userId);

					switch (true) {

						case (pullFromWeightedTable({ 0: 1, 1: 2 }) == 0 && allElderlyProfilesArray.length > 1):

							userInjuryObject.poison = true;

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*Piles of sand and lone, scraggly bushes are dotting the landscape all around ${profileData.name}. ${upperCasePronounAndPlural(profileData, 0, 'pad')} through the scattered branches from long-dead trees, carefully avoiding the cacti, trying to reach the ${foundItem} ${pronoun(profileData, 0)} saw. The ${profileData.species} steps on a root but feels it twist and pulse before it leaps from its camouflage and latches onto ${pronoun(profileData, 2)} body. The snake pumps poison into ${pronoun(profileData, 1)} while ${pronounAndPlural(profileData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*Many sticks and roots are popping up all around ${profileData.name}. ${upperCasePronounAndPlural(profileData, 0, 'shuffle')} through the fallen branches and twisting vines, trying to reach the ${foundItem} ${pronoun(profileData, 0)} found. The ${profileData.species} steps on a root but feels it weave and pulse before it leaps from its camouflage and latches onto ${pronoun(profileData, 2)} body. The snake pumps poison into $${pronoun(profileData, 1)} while ${pronounAndPlural(profileData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*Many plants and jellyfish are popping up all around ${profileData.name}. ${upperCasePronounAndPlural(profileData, 0, 'weave')} through the jellyfish and twisting kelp, trying to reach the ${foundItem} ${pronoun(profileData, 0)} found. The ${profileData.species} pushes through a piece of kelp but feels it twist and pulse before it latches onto ${pronoun(profileData, 2)} body. The jellyfish wraps ${pronoun(profileData, 1)} with its stingers, poison flowing into ${pronoun(profileData, 1)} while ${pronounAndPlural(profileData, 0, 'thrashes', 'trash')} around trying to throw it off, finally succeeding and rushing away to the surface.*`;
							}

							embed.footer.text = `-${healthPoints} HP (from poison)\n${embedFooterStatsText}`;

							break;

						case (pullFromWeightedTable({ 0: 1, 1: 1 }) == 0 && profileData.injuryObject.cold == false):

							userInjuryObject.cold = true;

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*${profileData.name} pads along the ground, dashing from bush to bush, inspecting every corner for something ${pronoun(profileData, 0)} could add to the inventory. Suddenly, the ${profileData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(profileData, 2)} throat.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*${profileData.name} plots around the forest, dashing from tree to tree, inspecting every corner for something ${profileData.pronoun(profileData, 0)} could add to the inventory. Suddenly, the ${profileData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(profileData, 2)} throat.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*${profileData.name} flips around in the water, swimming from rock to rock, inspecting every nook for something ${profileData.pronoun(profileData, 0)} could add to the inventory. Suddenly, the ${profileData.species} falters in ${pronoun(profileData, 2)} stroke, feeling tired and feeble. A coughing fit grew louder, bubbles escaping ${pronoun(profileData, 2)} throat to rise to the surface.*`;
							}

							embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

							break;

						default:

							userInjuryObject.infections += 1;

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*The soft noise of sand shifting on the ground spooks ${profileData.name} as ${pronounAndPlural(profileData, 0, 'walk')} around the area, searching for something useful for ${pronoun(profileData, 2)} pack. A warm wind brushes against ${pronoun(profileData, 2)} side, and a cactus bush sweeps atop ${pronoun(profileData, 2)} path, going unnoticed. A needle pricks into ${pronoun(profileData, 2)} skin, sending pain waves through ${pronoun(profileData, 2)} body. While removing the needle ${profileData.name} notices how swollen the wound looks. It is infected.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*The thunks of acorns falling from trees spook ${profileData.name} as ${pronounAndPlural(profileData, 0, 'prance')} around the forest, searching for something useful for ${pronoun(profileData, 2)} pack. A warm wind brushes against ${pronoun(profileData, 2)} side, and a thorn bush sweeps atop ${pronoun(profileData, 2)} path, going unnoticed. A thorn pricks into ${pronoun(profileData, 2)} skin, sending pain waves through ${pronoun(profileData, 2)} body. While removing the thorn ${profileData.name} notices how swollen the wound looks. It is infected.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*The sudden silence in the water spooks ${profileData.name} as ${pronounAndPlural(profileData, 0, 'swim')} around in the water, searching for something useful for their pack. A rocky outcropping appears next to ${pronoun(profileData, 1)}, unnoticed. The rocks scrape into ${pronoun(profileData, 2)} side, sending shockwaves of pain up ${pronoun(profileData, 2)} flank. ${profileData.name} takes a closer look and notices how swollen the wound is. It is infected.*`;
							}

							embed.footer.text = `-${healthPoints} HP (from infection)\n${embedFooterStatsText}`;
					}

					embedArray.splice(-1, 1, embed);
					return botReply = await botReply
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				});
		}

		async function findEnemy() {

			let opponentLevel = chosenBiomeNumber == 2 ? generateRandomNumber(profileData.levels > 40 ? profileData.levels - 15 : 25, 26) : chosenBiomeNumber == 1 ? generateRandomNumber(15, 11) : generateRandomNumber(10, 1);
			const opponentsArray = [...userSpeciesMap.biome1OpponentArray];
			if (chosenBiome > 0) { opponentsArray.push(...userSpeciesMap.biome2OpponentArray); }
			if (chosenBiome === 2) { opponentsArray.push(...userSpeciesMap.biome3OpponentArray); }

			const opponentSpecies = opponentsArray[generateRandomNumber(opponentsArray.length, 0)];
			let playerLevel = profileData.levels;

			if (userSpeciesMap.habitat == 'warm') {

				embed.description = `*${profileData.name} creeps close to the ground, ${pronoun(profileData, 2)} pelt blending with the sand surrounding ${pronoun(profileData, 1)}. The ${profileData.species} watches a pile of shrubs, ${pronoun(profileData, 2)} eyes flitting around before catching a motion out of the corner of ${pronoun(profileData, 2)} eyes. A particularly daring ${opponentSpecies} walks on the ground surrounding the bushes before sitting down and cleaning itself.*`;
			}

			if (userSpeciesMap.habitat == 'cold') {

				embed.description = `*${profileData.name} pads silently to the clearing, stopping just shy of leaving the safety of the thick trees that housed ${pronoun(profileData, 2)} pack, camp, and home. A lone ${opponentSpecies} stands in the clearing, snout in the stream that cuts the clearing in two, leaving it unaware of the ${profileData.species} a few meters behind it, ready to pounce.*`;
			}

			if (userSpeciesMap.habitat == 'water') {

				embed.description = `*${profileData.name} hides behind some kelp, looking around the clear water for any prey. A lone ${opponentSpecies} swims around aimlessly, not alarmed of any potential attacks. The ${profileData.species} gets in position, contemplating an ambush.*`;
			}

			embed.footer.text = `The ${opponentSpecies} is level ${opponentLevel}.\nYou will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.`;

			embedArray.splice(-1, 1, embed);
			botReply = await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							customId: 'enemy-fight',
							label: 'Fight',
							emoji: { name: '⚔️' },
							style: 'PRIMARY',
							disabled: (profileData.rank == 'Healer') ? true : false,
						}, {
							type: 'BUTTON',
							customId: 'enemy-flee',
							label: 'Flee',
							emoji: { name: '💨' },
							style: 'PRIMARY',
						}],
					}],
					allowedMentions: { repliedUser: true },
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			let filter = i => (i.customId === 'enemy-flee' || i.customId === 'enemy-fight') && i.user.id == message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 15000 })
				.catch(() => null);

			if (interaction == null || interaction.customId === 'enemy-flee') {

				if (userSpeciesMap.habitat == 'warm') {

					embed.description = `*${profileData.name} eyes the ${opponentSpecies}, which is still unaware of the possible danger. The ${profileData.species} paces, still unsure whether to attack. Suddenly, the ${profileData.species}'s head shoots up as it tries to find the source of the sound before running away. Looks like this hunt was unsuccessful.*`;
				}

				if (userSpeciesMap.habitat == 'cold') {

					embed.description = `*The ${opponentSpecies} sits in the clearing, unaware of ${profileData.name} hiding in the thicket behind it. The ${profileData.species} watches as the animal gets up, shakes the loose water droplets from its mouth, and walks into the forest, its shadow fading from ${profileData.name}'s sight. Looks like this hunt was unsuccessful.*`;
				}

				if (userSpeciesMap.habitat == 'water') {

					embed.description = `*${profileData.name} looks at the ${opponentSpecies}, which is still unaware of ${pronoun(profileData, 1)} watching through the kelp. Subconsciously, the ${profileData.species} starts swimming back and fourth, still unsure whether to attack. The ${opponentSpecies}'s head turns in a flash to eye the suddenly moving kelp before it frantically swims away. Looks like this hunt was unsuccessful.*`;
				}

				embed.footer.text = `${embedFooterStatsText}`;

				embedArray.splice(-1, 1, embed);
				return await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			await fightCycle(0, '');

			async function fightCycle(totalCycles, cycleKind) {

				const newCycleArray = ['attack', 'dodge', 'defend'];
				cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

				if (cycleKind == 'attack') {

					embed.description = `⏫ *The ${opponentSpecies} gets ready to attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
				}

				if (cycleKind == 'dodge') {

					embed.description = `↪️ *Looks like the ${opponentSpecies} is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
				}

				if (cycleKind == 'defend') {

					embed.description = `⏺️ *The ${opponentSpecies} gets into position to oppose an attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
				}

				const fightButtons = [{
					type: 'BUTTON',
					customId: 'fight-attack',
					label: 'Attack',
					emoji: { name: '⏫' },
					style: 'PRIMARY',
				}, {
					type: 'BUTTON',
					customId: 'fight-defend',
					label: 'Defend',
					emoji: { name: '⏺️' },
					style: 'PRIMARY',
				}, {
					type: 'BUTTON',
					customId: 'fight-dodge',
					label: 'Dodge',
					emoji: { name: '↪️' },
					style: 'PRIMARY',
				}].sort(() => Math.random() - 0.5);

				embedArray.splice(-1, 1, embed);
				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: fightButtons,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				filter = i => (i.customId == 'fight-attack' || i.customId == 'fight-defend' || i.customId == 'fight-dodge') && i.user.id == message.author.id;

				const { customId } = await botReply
					.awaitMessageComponent({ filter, time: 4000 })
					.catch(() => { return { customId: null }; });

				if (customId == null || (customId == 'fight-attack' && cycleKind == 'dodge') || (customId == 'fight-defend' && cycleKind == 'attack') || (customId == 'fight-dodge' && cycleKind == 'defend')) {

					opponentLevel += Math.ceil(profileData.levels / 10) * 2;
				}

				if ((customId == 'fight-attack' && cycleKind == 'defend') || (customId == 'fight-defend' && cycleKind == 'dodge') || (customId == 'fight-dodge' && cycleKind == 'attack')) {

					playerLevel += Math.ceil(profileData.levels / 10);
				}

				totalCycles += 1;

				if (totalCycles < 3) {

					return await fightCycle(totalCycles, cycleKind);
				}

				opponentLevel = generateRandomNumber(opponentLevel, 0);
				playerLevel = generateRandomNumber(playerLevel, 0);

				if (playerLevel == opponentLevel || playerLevel + 1 == opponentLevel || playerLevel == opponentLevel + 1) {

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*${profileData.name} and the ${opponentSpecies} are snarling at one another as they retreat to the opposite sides of the hill, now stirred up and filled with sticks from the surrounding bushes. The ${profileData.species} runs back to camp, ${pronoun(profileData, 2)} mouth empty as before.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*${profileData.name} and the ${opponentSpecies} are snarling at one another as they retreat into the bushes surrounding the clearing, now covered in trampled grass and loose clumps of dirt. The ${profileData.species} runs back to camp, ${pronoun(profileData, 2)} mouth empty as before.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*${profileData.name} and the ${opponentSpecies} glance at one another as they swim in opposite directions from the kelp, now cloudy from the stirred up dirt. The ${profileData.species} swims back to camp, ${pronoun(profileData, 2)} mouth empty as before.*`;
					}

					embed.footer.text = `${embedFooterStatsText}`;
				}
				else if (playerLevel > opponentLevel) {

					const userInventory = {
						commonPlants: { ...profileData.inventoryObject.commonPlants },
						uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
						rarePlants: { ...profileData.inventoryObject.rarePlants },
						meat: { ...profileData.inventoryObject.meat },
					};

					userInventory.meat[opponentSpecies] += 1;

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*${profileData.name} shakes the sand from ${pronoun(profileData, 2)} paws, the still figure of the ${opponentSpecies} casting a shadow for ${pronoun(profileData, 1)} to rest in before returning home with the meat. ${upperCasePronounAndPlural(profileData, 0, 'turn')} to the dead ${opponentSpecies} to start dragging it back to camp. The meat would be well-stored in the camp, added to the den of food for the night, after being cleaned.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*${profileData.name} licks ${pronoun(profileData, 2)} paws, freeing the dirt that is under ${pronoun(profileData, 2)} claws. The ${profileData.species} turns to the dead ${opponentSpecies} behind ${pronoun(profileData, 1)}, marveling at the size of it. Then, ${upperCasePronounAndPlural(profileData, 0, 'grab')} the ${opponentSpecies} by the neck, dragging it into the bushes and back to the camp.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*The ${profileData.species} swims quickly to the surface, trying to stay as stealthy and unnoticed as possible. ${upperCasePronounAndPlural(profileData, 0, 'break')} the surface, gain ${pronoun(profileData, 2)} bearing, and the ${profileData.species} begins swimming to the shore, dragging the dead ${opponentSpecies} up the shore to the camp.*`;
					}

					embed.footer.text = `${embedFooterStatsText}\n\n+1 ${opponentSpecies}`;

					profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { inventoryObject: userInventory } },
					);
				}
				else if (opponentLevel > playerLevel) {

					const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -healthPoints } },
					);

					switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

						case 0:

							userInjuryObject.wounds += 1;

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*The ${profileData.species} rolls over in the sand, pinned down by the ${opponentSpecies}.* "Get off my territory," *it growls before walking away from the shaking form of ${profileData.name} laying on the sand. ${upperCasePronounAndPlural(profileData, 0, 'let')} the ${opponentSpecies} walk away for a little, trying to put space between the two animals. After catching ${pronoun(profileData, 2)} breath, the ${profileData.species} pulls ${pronoun(profileData, 4)} off the ground, noticing sand sticking to ${pronoun(profileData, 2)} side. ${upperCasePronounAndPlural(profileData, 0, 'shake')} ${pronoun(profileData, 2)} body, sending bolts of pain up ${pronoun(profileData, 2)} side from the wound. ${upperCasePronounAndPlural(profileData, 0, 'slowly walk')} away from the valley that the ${opponentSpecies} was sitting in before running back towards camp.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*${profileData.name} runs into the brush, trying to avoid making the wound from the ${opponentSpecies} any worse than it already is. The ${profileData.species} stops and confirms that the ${opponentSpecies} isn't following ${pronoun(profileData, 1)}, before walking back inside the camp borders.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*Running from the ${opponentSpecies}, ${profileData.name} flips and spins around in the water, trying to escape from the grasp of the animal behind ${pronoun(profileData, 1)}. ${upperCasePronounAndPlural(profileData, 0, 'slip')} into a small crack in a wall, waiting silently for the creature to give up. Finally, the ${opponentSpecies} swims away, leaving the ${profileData.species} alone. Slowly emerging from the crevice, ${profileData.name} flinches away from the wall as ${pronounAndPlural(profileData, 0, 'hit')} it, a wound making itself known from the fight. Hopefully, it can be treated back at the camp.*`;
							}

							embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;

							break;

						default:

							userInjuryObject.sprains += 1;

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*${profileData.name} limps back to camp, ${pronoun(profileData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(profileData, 0)} get away, leaving the enemy alone in the sand that is now stirred up and filled with sticks from the surrounding bushes. Maybe next time, the ${profileData.species} will be successful in ${pronoun(profileData, 2)} hunt.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*${profileData.name} limps back to camp, ${pronoun(profileData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(profileData, 0)} get away, leaving the enemy alone in a clearing now filled with trampled grass and dirt clumps. Maybe next time, the ${profileData.species} will be successful in ${pronoun(profileData, 2)} hunt.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*${profileData.name} swims back to camp in pain, ${pronoun(profileData, 2)} fin sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(profileData, 0)} get away, leaving the enemy alone in the water that is now cloudy from the stirred up dirt. Maybe next time, the ${profileData.species} will be successful in ${pronoun(profileData, 2)} hunt.*`;
							}

							embed.footer.text = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
					}
				}

				embedArray.splice(-1, 1, embed);
				return botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}

		async function getBiome() {

			const selectBiomeComponent = {
				type: 'ACTION_ROW',
				components: [],
			};

			for (let i = 0; i < allBiomesArray.length; i++) {

				selectBiomeComponent.components.push({ type: 'BUTTON', customId: allBiomesArray[i], label: allBiomesArray[i].charAt(0).toUpperCase() + allBiomesArray[i].slice(1), style: 'PRIMARY' });
			}

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is longing for adventure as ${pronounAndPlural(profileData, 0, 'look')} into the wild outside of camp. All there is to decide is where the journey will lead ${pronoun(profileData, 1)}.*`,
			});

			const getBiomeMessage = await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					components: [selectBiomeComponent],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			embedArray.splice(-1, 1);

			const filter = i => allBiomesArray.includes(i.customId) && i.user.id == message.author.id;

			return await getBiomeMessage
				.awaitMessageComponent({ filter, time: 30000 })
				.then(async interaction => {

					await interaction.message
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
						.edit({ components: [] })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return null;
				});
		}
	},
};

/**
 * This takes a nested Array representing a field, and picks a random coordinate which is mutatable and surrounded by mutatable positions.
 * @param {Array<Array<string>>} field A field-array containing row-arrays filled with field positions
 * @returns {Array<string>} Coordinates for a random field position
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
 *
 * @param {Array} array
 * @returns string
 */
function joinNestedArray(array) {

	const newArray = [];

	for (let index = 0; index < array.length; index++) {

		newArray[index] = array[index].join('');
	}

	return newArray.join('\n');
}