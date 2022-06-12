// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { decreaseEnergy, decreaseHunger, decreaseThirst, decreaseHealth } = require('../../utils/checkCondition');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const disableAllComponents = require('../../utils/disableAllComponents');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const { speciesMap, materialsMap } = require('../../utils/itemsInfo');
const { checkLevelUp } = require('../../utils/levelHandling');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const sendNoDM = require('../../utils/sendNoDM');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('./attack');

module.exports.name = 'scavenge';

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

	/* Checking if the user is sending the command in a DM. If they are, it will send a message saying
	that the command can only be used in a server. */
	if (await sendNoDM(message)) { return; }

	/* Getting the character data and profile data of the user. */
	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	/* Checking if the user has completed their account and if the user is invalid. */
	if (await hasNotCompletedAccount(message, characterData) || await isInvalid(message, userData, embedArray, [module.exports.name])) { return; }

	/* Starting the cooldown for the command and checking if the user is in a battle and
	if they are, it will send a message reminding them to use the `rp attack` command. */
	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	/* Checking if the user has more than 25 items in their inventory. */
	if (/** @type {Array<number>} */ Object.values(profileData.inventory).map(type => Object.values(type)).flat().filter(value => value > 0).length > 25) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} approaches the pack borders, ${pronoun(characterData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(characterData, 0, 'is', 'are')} to go scavenging, ${pronounAndPlural(characterData, 0, 'decide')} to store some things away first.*`,
					footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Checking if the user's rank is Youngling. If it is, it will send a message saying that they don't
	have enough experience to go into the wilderness. */
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

	/* Updating the user's profile data. */
	const experiencePoints = generateRandomNumber(11, 5);
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

	/* Defining emojis and grids for the scavenge and the humantrap game. */
	const unclickedField = '❔';
	const humanTrapCorrectEmoji = '🕸️';
	const filledFieldArray = ['⬜', '🟩', '🟨', '🟧', '🟥'];
	const correctCoordinates = [generateRandomNumber(5, 0), generateRandomNumber(5, 0)];
	const gamePositionsArray = /** @type {Array<Array<string>>} */([]);
	let componentArray = /** @type {Array<import('discord.js').MessageActionRow>} */([]);

	/* Creating a 5x5 grid of buttons, with a random button being the correct one. */
	for (let i = 0; i < 5; i++) {

		componentArray.push(new MessageActionRow());
		gamePositionsArray.push([]);

		for (let j = 0; j < 5; j++) {

			componentArray[i].components.push(new MessageButton({
				customId: `board-${i}-${j}`,
				emoji: unclickedField,
				disabled: false,
				style: 'SECONDARY',
			}));
			if (i === correctCoordinates[0] && j === correctCoordinates[1]) { gamePositionsArray[i].push(filledFieldArray[0]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 1 && Math.abs(j - correctCoordinates[1]) <= 1) { gamePositionsArray[i].push(filledFieldArray[1]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 2 && Math.abs(j - correctCoordinates[1]) <= 2) { gamePositionsArray[i].push(filledFieldArray[2]); }
			else if (Math.abs(i - correctCoordinates[0]) <= 3 && Math.abs(j - correctCoordinates[1]) <= 3) { gamePositionsArray[i].push(filledFieldArray[3]); }
			else { gamePositionsArray[i].push(filledFieldArray[4]); }
		}
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				footer: { text: 'Click the fields to reveal what\'s underneath. Based on how close you are to the correct field, a color on a scale from green (closest) to red (farthest) is going to appear. You can click 4 times and have 2 minutes to win.' },
			}],
			components: componentArray,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	await interactionCollector(false);

	/**
	 * It's a function that creates a collector that collects the interactions of the user with the
	 * message
	 * @param {boolean} isHumanTrap - Boolean
	 */
	async function interactionCollector(isHumanTrap) {

		await new Promise((resolve) => {

			let correctButtonPresses = 0;

			/* Creating a collector that will collect the interactions of the user with the message. */
			const collector = message.channel.createMessageComponentCollector({
				filter: i => i.user.id === message.author.id && i.message.id === botReply.id,
				time: isHumanTrap ? 10_000 : 120_000,
				max: isHumanTrap ? 10 : 4,
			});

			collector.on('collect', async interaction => {

				/* It's checking if the customId of the button includes the word `board-`, which means that it is
				part of the scavenge game, or if the customId of the button includes the  word `humantrap-`, which
				means that it is part of the humantrap game. */
				if (interaction.customId.includes('board-')) {

					/* Getting the position of the button that the user clicked. */
					const verticalBoardPosition = Number(interaction.customId.split('-')[1]);
					const horizontalBoardPosition = Number(interaction.customId.split('-')[2]);
					const buttonInBoardPosition = componentArray[verticalBoardPosition].components[horizontalBoardPosition];

					/* Checking if the component is a button and if it is, it will set the emoji of the button to the
					emoji in the gamePositionsArray. It will then disable the button. */
					buttonInBoardPosition.type === 'BUTTON' && buttonInBoardPosition.setEmoji(gamePositionsArray[verticalBoardPosition][horizontalBoardPosition]);
					buttonInBoardPosition.disabled = true;

					/* Checking if the user has clicked on the correct field. If they have, it will stop the collector
					and if they haven't, it will edit the message with the new components. */
					if (gamePositionsArray[verticalBoardPosition][horizontalBoardPosition] === filledFieldArray[0]) {

						collector.stop('win');
					}
					else {

						botReply = await botReply
							.edit({ components: componentArray })
							.catch((error) => { throw new Error(error); });
					}
				}
				else if (interaction.customId.includes('humantrap-')) {

					/* It's checking if the customId of the button includes the correct emoji. If it does, it will
					add 1 to the `correctButtonPresses` variable. It will then call the `changeComponents` function. */
					if (interaction.customId.includes(humanTrapCorrectEmoji)) { correctButtonPresses += 1; }
					changeComponents();
				}
			});

			collector.on('end', async (interactions, reason) => {

				/* The below code is checking if the user has finished the game or not. If the user has finished the
				game, it will check if the server has enough meat and materials. If it doesn't, it will give the user
				meat or  materials. If it does, it will do nothing. If the user has lost the game, it will check if
				the user has lost the human trap game as well. If they did, it will add an injury to the user.
				If the game is not finished, start the human trap game. */
				if (reason === 'win') {

					/* Counting the number of profiles that have a rank higher than Youngling, the amount of meat
					and the amount of materials in the server's inventory. */
					const highRankProfilesCount = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
						.find(
							(/** @type {import('../../typedef').ProfileSchema} */ u) => Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].rank !== 'Youngling').length > 0))
						.map(u => Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].rank !== 'Youngling').length)
						.reduce((a, b) => a + b, 0);
					const serverMeatCount = Object.values(serverData.inventory.meat).flat().reduce((a, b) => a + b, 0);
					const serverMaterialsCount = Object.values(serverData.inventory.materials).flat().reduce((a, b) => a + b, 0);

					/* Checking if the server has enough meat, if it doesn't, give the user meat. If it does, check
					if the server has enough materials, if it doesn't, give the user material. If it does, do nothing. */
					if (serverMeatCount < highRankProfilesCount * 2) {

						const carrionArray = [...speciesMap.get(characterData.species).biome1OpponentArray];
						const foundCarrion = carrionArray[generateRandomNumber(carrionArray.length, 0)];

						embed.description = 'You found some carrion';
						embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundCarrion}`;

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ userId: message.author.id },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								p.characters[characterData._id].profiles[message.guild.id].inventory.meat[foundCarrion] += 1;
							},
						));
					}
					else if (serverMaterialsCount < 72) {

						const foundMaterial = Array.from(materialsMap.keys())[generateRandomNumber(Array.from(materialsMap.keys()).length, 0)];

						embed.description = 'You found some material';
						embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundMaterial}`;

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ userId: message.author.id },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								p.characters[characterData._id].profiles[message.guild.id].inventory.materials[foundMaterial] += 1;
							},
						));
					}
					else {

						embed.description = 'You found nothing, come back later';
						embed.footer.text = embedFooterStatsText;
					}

					/* The above code is creating a new embed object and adding it to the embed array. It is also
					disabling all the components in the component array. */
					botReply = await botReply
						.edit({
							embeds: [...embedArray, embed],
							components: disableAllComponents(componentArray),
						})
						.catch((error) => { throw new Error(error); });
					checkHealthAndLevel();
				}
				else if (isHumanTrap) {

					/* Creating a weighted table with the probability of the player not being hurt being equal to
					the number of correct button presses. */
					const isHurt = pullFromWeightedTable({ 0: correctButtonPresses, 1: 10 - correctButtonPresses });

					/* Checking if the user is hurt or not. If the user is hurt, it will subtract health points from
					the user and give them an injury. */
					if (isHurt == 0) {

						embed.description = 'You escaped the human trap safely';
						embed.footer.text = embedFooterStatsText;
					}
					else {

						const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ userId: message.author.id },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								p.characters[characterData._id].profiles[message.guild.id].health -= healthPoints;
							},
						));
						characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
						profileData = characterData?.profiles?.[message.guild.id];

						switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

							case 0:

								userInjuryObject.infections += 1;

								embed.description = 'You got an infection from the human trap';
								embed.footer.text = `-${healthPoints} HP (from infection)\n${embedFooterStatsText}`;

								break;

							default:

								userInjuryObject.sprains += 1;

								embed.description = 'You got a sprain from the human trap';
								embed.footer.text = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
						}
					}

					botReply = await botReply
						.edit({
							embeds: [...embedArray, embed],
							components: disableAllComponents(componentArray),
						})
						.catch((error) => { throw new Error(error); });
					checkHealthAndLevel();
				}
				else {

					changeComponents();
					await interactionCollector(true);
				}

				resolve();
			});
		});
	}

	/**
	 * This function checks the user's health and level
	 */
	async function checkHealthAndLevel() {

		botReply = await decreaseHealth(userData, botReply, userInjuryObject);
		botReply = await checkLevelUp(message, botReply, userData, serverData);
		await isPassedOut(message, userData, true);
	}

	/**
	 * This function updates the components for the human trap game
	 */
	async function changeComponents() {

		componentArray = [new MessageActionRow()];
		const correctButton = generateRandomNumber(5, 0);
		const humanTrapIncorrectEmojis = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

		for (let i = 0; i < 5; i++) {

			const chosenEmoji = i === correctButton ? humanTrapCorrectEmoji : humanTrapIncorrectEmojis.splice(generateRandomNumber(humanTrapIncorrectEmojis.length, 0), 1)[0];
			componentArray[0].components.push(new MessageButton({
				customId: `humantrap-${chosenEmoji}`,
				emoji: chosenEmoji,
				disabled: false,
				style: 'SECONDARY',
			}));
		}

		botReply = await botReply
			.edit({
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					footer: { text: `Click the "${humanTrapCorrectEmoji}" as many times as you can!` },
				}],
				components: componentArray,
			})
			.catch((error) => { throw new Error(error); });
	}
};