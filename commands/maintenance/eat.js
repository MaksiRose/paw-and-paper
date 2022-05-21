// @ts-check
const profileModel = require('../../models/profileModel');
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
const sendNoDM = require('../../utils/sendNoDM');

module.exports.name = 'eat';

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

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.hunger >= profileData.maxHunger) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name}'s stomach bloats as ${pronounAndPlural(characterData, 0, 'roll')} around camp, stuffing food into ${pronoun(characterData, 2)} mouth. The ${characterData.displayedSpecies || characterData.species} might need to take a break from food before ${pronounAndPlural(characterData, 0, 'goes', 'go')} into a food coma.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if ((profileData.rank !== 'Youngling' && serverData.blockedEntrance.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntrance.den === 'food den') {

		await blockEntrance(message, messageContent, characterData, serverData, 'food den');
		return;
	}

	await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = 'food den';
		},
	);

	if (!argumentsArray.length) {

		// I have to call the inventory command directly here instead of executing messageCreate.js, since doing otherwise would always return profileData.hasCooldown as true
		await sendMessage(client, message, argumentsArray, userData, serverData, embedArray);
		return;
	}

	const chosenFood = argumentsArray.join(' ');
	let finalHungerPoints = 0;
	let finalHealthPoints = 0;
	let finalEnergyPoints = 0;

	const embed = {
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
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

		if (serverData.inventory[plantType][chosenFood] <= 0) {

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
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

			embed.description = `*A yucky feeling drifts down ${characterData.name}'s throat. ${upperCasePronounAndPlural(characterData, 0, 'shakes and spits', 'shake and spit')} it out, trying to rid ${pronoun(characterData, 2)} mouth of the taste. The plant is poisonous!*`;
		}

		if (plantMap.get(chosenFood).edibality === 'i') {

			finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(3, -3));

			embed.description = `*${characterData.name} slowly opens ${pronoun(characterData, 2)} mouth and chomps onto the ${chosenFood}. The ${characterData.displayedSpecies || characterData.species} swallows it, but ${pronoun(characterData, 2)} face has a look of disgust. That wasn't very tasty!*`;
		}

		if (plantMap.get(chosenFood).edibality === 'e') {

			if (speciesMap.get(characterData.species).diet === 'carnivore') {

				finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(5, 1));

				embed.description = `*${characterData.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${characterData.displayedSpecies || characterData.species} prefers.*`;
			}

			if (speciesMap.get(characterData.species).diet === 'herbivore' || speciesMap.get(characterData.species).diet === 'omnivore') {

				finalHungerPoints = function(hunger) { return profileData.hunger + hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(4, 15));

				embed.description = `*Leaves flutter into the storage den, landing near ${characterData.name}'s feet. The ${characterData.displayedSpecies || characterData.species} searches around the inventory determined to find the perfect meal, and that ${pronounAndPlural(characterData, 0, 'does', 'do')}. ${characterData.name} plucks a ${chosenFood} from the pile and eats until ${pronoun(characterData, 2)} stomach is pleased.*`;
			}
		}

		if (plantMap.get(chosenFood).givesEnergy === true) {

			finalEnergyPoints = function(energy) { return (profileData.energy + energy > profileData.maxEnergy) ? profileData.maxEnergy - profileData.energy : energy; }(20);
		}


		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.advice.eating = true;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger += finalHungerPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += finalEnergyPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].health += finalHealthPoints;
			},
		));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			(/** @type {import('../../typedef').ServerSchema} */ s) => {
				s.inventory[plantType][chosenFood] -= 1;
			},
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

		if (serverData.inventory.meat[chosenFood] <= 0) {

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
						footer: { text: profileData.currentRegion !== 'food den' ? '\nYou are now at the food den' : null },
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (speciesMap.get(characterData.species).diet === 'herbivore') {

			finalHungerPoints = function(hunger) { return profileData.hunger - hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(5, 1));

			embed.description = `*${characterData.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${pronoun(characterData, 2)} attention. The ${characterData.displayedSpecies || characterData.species} walks over to it and begins to eat.* "This isn't very good!" *${characterData.name} whispers to ${pronoun(characterData, 4)} and leaves the den, stomach still growling, and craving for plants to grow.*`;
		}

		if (speciesMap.get(characterData.species).diet === 'carnivore' || speciesMap.get(characterData.species).diet === 'omnivore') {

			finalHungerPoints = function(hunger) { return profileData.hunger - hunger < 0 ? profileData.hunger : profileData.hunger + hunger > profileData.maxHunger ? profileData.maxHunger - profileData.hunger : hunger; }(generateRandomNumber(4, 15));

			embed.description = `*${characterData.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${pronoun(characterData, 2)} jaw as the ${characterData.displayedSpecies || characterData.species} finishes off the meal. It was a delicious feast, but very messy!*`;
		}

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.advice.eating = true;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger += finalHungerPoints;
			},
		));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			(/** @type {import('../../typedef').ServerSchema} */ s) => {
				s.inventory.meat[chosenFood] -= 1;
			},
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

		const taggedUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first().id }));
		const taggedCharacterData = taggedUserData.characters[taggedUserData.currentCharacter[message.guild.id]];

		if (taggedUserData) {

			embed.description = `*${characterData.name} looks down at ${taggedCharacterData.name} as ${pronounAndPlural(characterData, 0, 'nom')} on the ${taggedCharacterData.displayedSpecies || taggedCharacterData.species}'s leg.* "No eating packmates here!" *${taggedCharacterData.name} chuckled, shaking off ${characterData.name}.*`;
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
	await sendMessage(client, message, argumentsArray, userData, serverData, embedArray);
	return;
};