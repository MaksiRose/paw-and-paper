const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { decreaseEnergy, decreaseHunger, decreaseThirst, decreaseHealth } = require('../../utils/checkCondition');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { generateRandomNumberWithException, pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const startCooldown = require('../../utils/startCooldown');
const { checkLevelUp } = require('../../utils/levelHandling');
const config = require('../../config.json');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const serverMap = new Map();


module.exports = {
	name: 'attack',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		if (!serverMap.has('nr' + message.guild.id) || serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is ready to attack any intruder. But no matter how far ${pronounAndPlural(profileData, 0, 'look')}, ${pronoun(profileData, 0)} can't see anyone. It seems that the pack is not under attack at the moment.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (serverMap.get('nr' + message.guild.id).humans <= 0) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} looks around, searching for a human to attack. It looks like everyone is already being attacked by other pack members. The ${profileData.species} better not interfere before ${pronounAndPlural(profileData, 0, 'hurt')} ${pronoun(profileData, 2)} friends.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		profileData = await startCooldown(message, profileData);

		serverMap.get('nr' + message.guild.id).humans -= 1;
		serverMap.get('nr' + message.guild.id).currentFights += 1;

		let
			winPoints = 0,
			botReply;
		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: null },
		};

		await fightCycle(0, '');

		async function fightCycle(totalCycles, cycleKind) {

			const newCycleArray = ['attack', 'dodge', 'defend'];
			cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

			if (cycleKind == 'attack') {

				embed.description = `⏫ *The human gets ready to attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			}

			if (cycleKind == 'dodge') {

				embed.description = `↪️ *Looks like the human is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			}

			if (cycleKind == 'defend') {

				embed.description = `⏺️ *The human gets into position to oppose an attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			}

			embed.footer.text = 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.';

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

			if (totalCycles == 0) {

				botReply = await message
					.reply({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: fightButtons,
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
			else {

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
			}

			const filter = i => (i.customId == 'fight-attack' || i.customId == 'fight-defend' || i.customId == 'fight-dodge') && i.user.id == message.author.id;

			const { customId } = await botReply
				.awaitMessageComponent({ filter, time: 4000 })
				.catch(() => { return { customId: null }; });

			if (customId == null || (customId == 'fight-attack' && cycleKind == 'dodge') || (customId == 'fight-defend' && cycleKind == 'attack') || (customId == 'fight-dodge' && cycleKind == 'defend')) {

				winPoints -= 1;
			}

			if ((customId == 'fight-attack' && cycleKind == 'defend') || (customId == 'fight-defend' && cycleKind == 'dodge') || (customId == 'fight-dodge' && cycleKind == 'attack')) {

				winPoints += 1;
			}

			totalCycles += 1;

			if (totalCycles < 5) {

				return await fightCycle(totalCycles, cycleKind);
			}

			const experiencePoints = generateRandomNumber(10, 11);
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

			let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${hungerPoints > 0 ? `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})` : ''}${thirstPoints > 0 ? `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})` : ''}`;

			const userInjuryObject = { ...profileData.injuryObject };


			if (winPoints < 0) {

				winPoints = 0;
			}

			winPoints = pullFromWeightedTable({ 0: 8 - winPoints, 1: 8, 2: winPoints });

			if (winPoints == 2) {

				embed.description = `*For a moment it looks like the human might get the upper hand before ${profileData.name} jumps on them with a big hop. The human falls to the ground and crawls away with a terrified look on their face. It looks like their not coming back.*`;
			}
			else {

				const inventoryObject = { ...serverData.inventoryObject };
				const { itemType, itemName } = getHighestItem(inventoryObject);

				if (inventoryObject[itemType][itemName] > 0) {

					embedFooterStatsText += `\n\n-${Math.round(inventoryObject[itemType][itemName] / 10)} ${itemName} for ${message.guild.name}`;
					inventoryObject[itemType][itemName] -= Math.round(inventoryObject[itemType][itemName] / 10);
				}

				await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { inventoryObject: inventoryObject } },
				);

				embed.description = `*The battle between the human and ${profileData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${profileData.species} tries to jump at them, but the human manages to dodge. Quickly they run in the direction of the food den. They escaped from ${pronoun(profileData, 1)}!*`;

				if (winPoints == 0) {

					const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -healthPoints } },
					);

					switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

						case 0:

							userInjuryObject.wounds += 1;

							embed.description = `*The battle between the human and ${profileData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${profileData.species} tries to jump at them, but the human manages to dodge. Unfortunately, a rock is directly in ${profileData.name}'s jump line. A sharp pain runs through ${pronoun(profileData, 2)} hip. A red spot slowly spreads where ${pronoun(profileData, 0)} hit the rock. Meanwhile, the human runs into the food den.*`;

							embedFooterStatsText = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;

							break;

						default:

							userInjuryObject.sprains += 1;

							embed.description = `*The battle between the human and ${profileData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${profileData.species} tries to jump at them, but the human manages to dodge. ${profileData.name} is not prepared for the fall. A sharp pain runs through ${pronoun(profileData, 2)} arm as it bends in the fall. Meanwhile, the human runs into the food den.*`;

							embedFooterStatsText = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
					}
				}

				serverMap.get('nr' + message.guild.id).humans += 1;
			}

			embed.footer.text = embedFooterStatsText + `\n${serverMap.get('nr' + message.guild.id).humans} humans remaining`;

			embedArray.splice(-1, 1, embed);
			botReply = await botReply
				.edit({
					embeds: embedArray,
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			botReply = await decreaseHealth(message, profileData, botReply, userInjuryObject);
			botReply = await checkLevelUp(profileData, botReply);
			await isPassedOut(message, profileData, true);

			await restAdvice(message, profileData);
			await drinkAdvice(message, profileData);
			await eatAdvice(message, profileData);

			return;
		}

		serverMap.get('nr' + message.guild.id).currentFights -= 1;

		if (serverMap.get('nr' + message.guild.id).humans <= 0 && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

			await message.channel
				.send({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'The attack is over!',
						description: '*The packmates howl, dance and cheer as the humans run back into the woods. The battle wasn\'t easy, but they were victorious nonetheless.*',
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			clearTimeout(serverMap.get('nr' + message.guild.id).endingTimeout);
			serverMap.delete('nr' + message.guild.id);

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { nextPossibleAttack: Date.now() + 86400000 } },
			);
		}
		else if (serverMap.get('nr' + message.guild.id).endingTimeout == null && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

			remainingHumans(message, serverData);
		}
	},
	startAttack(message, serverData) {

		serverMap.set('nr' + message.guild.id, { startsTimestamp: Date.now() + 60000, humans: serverData.activeUsersArray.length, endingTimeout: null, currentFights: 0 });
		setTimeout(async function() {

			serverData = await serverModel.findOne({ serverId: message.guild.id });

			if (serverData.activeUsersArray.length > serverMap.get('nr' + message.guild.id).humans) {

				serverMap.get('nr' + message.guild.id).humans = serverData.activeUsersArray.length;
			}

			await message.channel
				.send({
					content: serverData.activeUsersArray.map(user => `<@!${user}>`).join(' '),
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: `*The packmates get ready as ${serverMap.get('nr' + message.guild.id).humans} humans run over the borders. Now it is up to them to defend their land.*`,
						footer: { text: 'You have 5 minutes to defeat all the humans. Type \'rp attack\' to attack one.' },
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			serverMap.get('nr' + message.guild.id).startsTimestamp = null;
			serverMap.get('nr' + message.guild.id).endingTimeout = setTimeout(async function() {

				serverMap.get('nr' + message.guild.id).endingTimeout = null;
				if (serverMap.get('nr' + message.guild.id).currentFights <= 0) {

					remainingHumans(message, serverData);
				}
			}, 300000);
		}, 60000);
	},
	remindOfAttack(message) {

		if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

			return `Humans will attack in ${Math.floor((serverMap.get('nr' + message.guild.id).startsTimestamp - Date.now()) / 1000)} seconds!`;
		}
		else if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp == null) {

			return 'Humans are attacking the pack! Type `rp attack` to attack.';
		}

		return null;
	},
};

async function remainingHumans(message, serverData) {

	const embed = {
		color: config.default_color,
		author: { name: message.guild.name, icon_url: message.guild.iconURL() },
		title: 'The attack is over!',
		description: `*Before anyone could stop them, the last ${serverMap.get('nr' + message.guild.id).humans} humans run into the food den, take whatever they can grab and run away. The battle wasn't easy, but it is over at last.*`,
		footer: { text: '' },
	};

	const inventoryObject = { ...serverData.inventoryObject };
	while (serverMap.get('nr' + message.guild.id).humans > 0) {

		const { itemType, itemName } = getHighestItem(inventoryObject);

		if (inventoryObject[itemType][itemName] > 0) {

			embed.footer.text += `\n-${Math.round(inventoryObject[itemType][itemName] / 10)} ${itemName} for ${message.guild.name}`;
			inventoryObject[itemType][itemName] -= Math.round(inventoryObject[itemType][itemName] / 10);
		}

		serverMap.get('nr' + message.guild.id).humans -= 1;
	}

	if (embed.footer.text == '') {

		embed.footer.text = null;
	}

	await serverModel.findOneAndUpdate(
		{ serverId: message.guild.id },
		{
			$set: {
				inventoryObject: inventoryObject,
				nextPossibleAttack: Date.now() + 86400000,
			},
		},
	);

	await message.channel
		.send({ embeds: [embed] })
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	serverMap.delete('nr' + message.guild.id);
}

function getHighestItem(inventoryObject) {

	const inventoryReduced = {};
	Object.entries(inventoryObject).map(([itemType, items]) => inventoryReduced[itemType] = Math.max(...Object.values(items)));
	const itemType = Object.keys(inventoryReduced).reduce((a, b) => inventoryReduced[a] > inventoryReduced[b] ? a : b);
	const itemName = Object.keys(inventoryObject[itemType]).reduce((a, b) => inventoryObject[itemType][a] > inventoryObject[itemType][b] ? a : b);

	return { itemType, itemName };
}