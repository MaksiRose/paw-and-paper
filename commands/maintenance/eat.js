// @ts-check
const { profileModel } = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber } = require('../../utils/randomizers');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { sendMessage } = require('./inventory');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const blockEntrance = require('../../utils/blockEntrance');

module.exports.name = 'eat';

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

	if (profileData.hunger >= profileData.maxHunger) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name}'s stomach bloats as ${pronounAndPlural(profileData, 0, 'roll')} around camp, stuffing food into ${pronoun(profileData, 2)} mouth. The ${profileData.species} might need to take a break from food before ${pronounAndPlural(profileData, 0, 'goes', 'go')} into a food coma.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if ((profileData.rank !== 'Youngling' && serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntranceObject.den === 'food den') {

		await blockEntrance(message, messageContent, profileData, serverData, 'food den');
		return;
	}

	await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{ $set: { currentRegion: 'food den' } },
	);

	if (!argumentsArray.length) {

		// I have to call the inventory command directly here instead of executing messageCreate.js, since doing otherwise would always return profileData.hasCooldown as true
		await sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
		return;
	}

	const chosenFood = argumentsArray.join(' ');
	let finalHungerPoints = 0;
	let finalHealthPoints = 0;
	let finalEnergyPoints = 0;

	profileData.advice.eating = true;

	const embed = {
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
		description: '',
		footer: { text: '' },
	};

	const allPlantMaps = new Map([...commonPlantsMap, ...uncommonPlantsMap, ...rarePlantsMap]);

	if (allPlantMaps.has(chosenFood) === true) {

		/** @type {'commonPlants' | 'uncommonPlants' | 'rarePlants'} */
		let plantType;
		/** @type {Map<string, import('../../typedef').PlantMapObject>} */
		let plantMap;

		if (commonPlantsMap.has(chosenFood) === true) {

			plantType = 'commonPlants';
			plantMap = new Map([...commonPlantsMap]);
		}

		if (uncommonPlantsMap.has(chosenFood) === true) {

			plantType = 'uncommonPlants';
			plantMap = new Map([...uncommonPlantsMap]);
		}

		if (rarePlantsMap.has(chosenFood) === true) {

			plantType = 'rarePlants';
			plantMap = new Map([...rarePlantsMap]);
		}

		if (serverData.inventoryObject[plantType][chosenFood] <= 0) {

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
						footer: { text: profileData.currentRegion !== 'food den' ? '\nYou are now at the food den' : null },
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (plantMap.get(chosenFood).edibality === 't') {

			finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(3, -5));
			finalHealthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(3, -10));

			embed.description = `*A yucky feeling drifts down ${profileData.name}'s throat. ${upperCasePronounAndPlural(profileData, 0, 'shakes and spits', 'shake and spit')} it out, trying to rid ${pronoun(profileData, 2)} mouth of the taste. The plant is poisonous!*`;
		}

		if (plantMap.get(chosenFood).edibality === 'i') {

			finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(3, -3));

			embed.description = `*${profileData.name} slowly opens ${pronoun(profileData, 2)} mouth and chomps onto the ${chosenFood}. The ${profileData.species} swallows it, but ${pronoun(profileData, 2)} face has a look of disgust. That wasn't very tasty!*`;
		}

		if (plantMap.get(chosenFood).edibality === 'e') {

			if (speciesMap.get(profileData.species).diet === 'carnivore') {

				finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(5, 1));

				embed.description = `*${profileData.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${profileData.species} prefers.*`;
			}

			if (speciesMap.get(profileData.species).diet === 'herbivore' || speciesMap.get(profileData.species).diet === 'omnivore') {

				finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(4, 15));

				embed.description = `*Leaves flutter into the storage den, landing near ${profileData.name}'s feet. The ${profileData.species} searches around the inventory determined to find the perfect meal, and that ${pronounAndPlural(profileData, 0, 'does', 'do')}. ${profileData.name} plucks a ${chosenFood} from the pile and eats until ${pronoun(profileData, 2)} stomach is pleased.*`;
			}
		}

		if (plantMap.get(chosenFood).givesEnergy === true) {

			finalEnergyPoints = function(energy) { return (profileData.energy + energy > profileData.maxEnergy) ? profileData.maxEnergy - profileData.energy : energy; }(20);
		}

		serverData.inventoryObject[plantType][chosenFood] -= 1;

		profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					hunger: +finalHungerPoints,
					energy: +finalEnergyPoints,
					health: +finalHealthPoints,
				},
				$set: {
					advice: profileData.advice,
				},
			},
		));

		serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			{ $set: { inventoryObject: serverData.inventoryObject } },
		));

		embed.footer.text = `${finalHungerPoints >= 0 ? '+' : ''}${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;

		if (plantMap.get(chosenFood).givesEnergy === true) {

			embed.footer.text += `\n+${finalEnergyPoints} energy (${profileData.energy}/${profileData.maxHunger})`;
		}

		if (plantMap.get(chosenFood).edibality === 't') {

			embed.footer.text += `\n${finalHealthPoints} health (${profileData.health}/${profileData.maxHealth})`;
		}

		embed.footer.text += `${profileData.currentRegion !== 'food den' ? '\nYou are now at the food den' : ''}\n\n-1 ${chosenFood} for ${message.guild.name}`;

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (speciesMap.has(chosenFood) === true) {

		if (serverData.inventoryObject.meat[chosenFood] <= 0) {

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
						footer: { text: profileData.currentRegion !== 'food den' ? '\nYou are now at the food den' : null },
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (speciesMap.get(profileData.species).diet === 'herbivore') {

			finalHungerPoints = function(hunger) { return profileData.hunger - hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(5, 1));

			embed.description = `*${profileData.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${pronoun(profileData, 2)} attention. The ${profileData.species} walks over to it and begins to eat.* "This isn't very good!" *${profileData.name} whispers to ${pronoun(profileData, 4)} and leaves the den, stomach still growling, and craving for plants to grow.*`;
		}

		if (speciesMap.get(profileData.species).diet === 'carnivore' || speciesMap.get(profileData.species).diet === 'omnivore') {

			finalHungerPoints = function(hunger) { return profileData.hunger - hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(4, 15));

			embed.description = `*${profileData.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${pronoun(profileData, 2)} jaw as the ${profileData.species} finishes off the meal. It was a delicious feast, but very messy!*`;
		}

		serverData.inventoryObject.meat[chosenFood] -= 1;

		profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: { hunger: +finalHungerPoints },
				$set: { advice: profileData.advice },
			},
		));

		serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			{ $set: { inventoryObject: serverData.inventoryObject } },
		));

		embed.footer.text = `+${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})${(profileData.currentRegion != 'food den') ? '\nYou are now at the food den' : ''}\n\n-1 ${chosenFood} for ${message.guild.name}`;

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (message.mentions.users.size > 0) {

		const taggedProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.mentions.users.first().id,
			serverId: message.guild.id,
		}));

		if (taggedProfileData) {

			embed.description = `*${profileData.name} looks down at ${taggedProfileData.name} as ${pronounAndPlural(profileData, 0, 'nom')} on the ${taggedProfileData.species}'s leg.* "No eating packmates here!" *${taggedProfileData.name} chuckled, shaking off ${profileData.name}.*`;
			embed.footer.text = profileData.currentRegion !== 'food den' ? '\nYou are now at the food den' : null;

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}

	// I have to call the inventory command directly here instead of executing messageCreate.js, since doing otherwise would always return profileData.hasCooldown as true
	await sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
	return;
};