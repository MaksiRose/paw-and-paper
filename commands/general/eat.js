const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const inventory = require('./inventory');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const maps = require('../../utils/maps');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'eat',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (profileData.hunger >= 100) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name}'s stomach bloats as ${profileData.pronounArray[0]} roll${(profileData.pronounArray[5] == 'singular') ? 's' : ''} around camp, stuffing food into ${profileData.pronounArray[2]} mouth. The ${profileData.species} might need to take a break from food before ${profileData.pronounArray[0]} go${(profileData.pronounArray[5] == 'singular') ? 'es' : ''} into a food coma.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (!argumentsArray.length) {

			return await inventory
				.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray)
				.catch((error) => {
					throw new Error(error);
				});
		}

		const chosenFood = argumentsArray.join(' ');
		let finalHungerPoints = 0;
		let minimumHungerPoints = 0;
		let finalHealthPoints = 0;
		let minimumHealthPoints = 0;
		let finalEnergyPoints = 0;

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
		};

		const allPlantMaps = new Map([...maps.commonPlantMap, ...maps.uncommonPlantMap, ...maps.rarePlantMap]);
		if (allPlantMaps.has(chosenFood) == true) {

			let plantType;
			let plantMap;

			if (maps.commonPlantMap.has(chosenFood) == true) {

				plantType = 'commonPlants';
				plantMap = new Map([...maps.commonPlantMap]);
			}

			if (maps.uncommonPlantMap.has(chosenFood) == true) {

				plantType = 'uncommonPlants';
				plantMap = new Map([...maps.uncommonPlantMap]);
			}

			if (maps.rarePlantMap.has(chosenFood) == true) {

				plantType = 'rarePlants';
				plantMap = new Map([...maps.rarePlantMap]);
			}

			if (serverData.inventoryObject[plantType][chosenFood] <= 0) {

				embedArray.push({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
				});

				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (plantMap.get(chosenFood).edibality == 't') {

				minimumHungerPoints = -5;
				minimumHealthPoints = -10;
				finalHungerPoints = Loottable(5, minimumHungerPoints);
				finalHealthPoints = Loottable(3, minimumHealthPoints);

				embed.description = `*A yucky feeling drifts down ${profileData.name}'s throat. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} shake${(profileData.pronounArray[5] == 'singular') ? 's' : ''} and spit${(profileData.pronounArray[5] == 'singular') ? 's' : ''} it out, trying to rid ${profileData.pronounArray[2]} mouth of the taste. The plant is poisonous!*`;
			}

			if (plantMap.get(chosenFood).edibality == 'i') {

				minimumHungerPoints = -1;
				finalHungerPoints = Loottable(3, minimumHungerPoints);

				embed.description = `*${profileData.name} slowly opens ${profileData.pronounArray[2]} mouth and chomps onto the ${chosenFood}. The ${profileData.species} swallows it, but ${profileData.pronounArray[2]} face has a look of disgust. That wasn't very tasty!*`;
			}

			if (plantMap.get(chosenFood).edibality == 'e') {

				if (maps.speciesMap.get(profileData.species).diet == 'carnivore') {

					minimumHungerPoints = 1;
					finalHungerPoints = Loottable(5, minimumHungerPoints);

					embed.description = `*${profileData.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${profileData.species} prefers.*`;
				}

				if (maps.speciesMap.get(profileData.species).diet == 'herbivore' || maps.speciesMap.get(profileData.species).diet == 'omnivore') {

					minimumHungerPoints = 11;
					finalHungerPoints = Loottable(10, minimumHungerPoints);

					embed.description = `*Leaves flutter into the storage den, landing near ${profileData.name}'s feet. The ${profileData.species} searches around the inventory determined to find the perfect meal, and that ${profileData.pronounArray[0]} do${(profileData.pronounArray[5] == 'singular') ? 'es' : ''}. ${profileData.name} plucks a ${chosenFood} from the pile and eats until ${profileData.pronounArray[2]} stomach is pleased.*`;
				}
			}

			if (plantMap.get(chosenFood).givesEnergy == true) {

				finalEnergyPoints = 20;

				if (profileData.energy + finalEnergyPoints > profileData.maxEnergy) {

					finalEnergyPoints -= (profileData.energy + finalEnergyPoints) - profileData.maxEnergy;
				}
			}

			if (profileData.health + finalHealthPoints < 0) {

				finalHealthPoints = -profileData.health;
			}

			if (profileData.hunger + finalHungerPoints > profileData.maxHunger) {

				finalHungerPoints -= (profileData.hunger + finalHungerPoints) - profileData.maxHunger;
			}

			serverData.inventoryObject[plantType][chosenFood] -= 1;

			embed.footer.text = `+${finalHungerPoints} hunger (${finalHungerPoints + profileData.hunger}/${profileData.maxHunger})`;

			if (plantMap[chosenFood] == true) {

				embed.footer.text += `\n+${finalEnergyPoints} energy (${finalEnergyPoints + profileData.energy}/${profileData.maxHunger})`;
			}

			if (plantMap[chosenFood] == 't') {

				embed.footer.text += `\n${finalHealthPoints} health (${finalHealthPoints + profileData.health}/${profileData.maxHealth})`;
			}

			embed.footer.text += `${(profileData.currentRegion != 'food den') ? '\nYou are now at the food den' : ''}\n\n-1 ${chosenFood} for ${message.guild.name}`;

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						hunger: +finalHungerPoints,
						energy: +finalEnergyPoints,
						health: +finalHealthPoints,
					},
					$set: { currentRegion: 'food den' },
				},
			);

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { inventoryObject: serverData.inventoryObject } },
			);

			embedArray.push(embed);
			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (maps.speciesMap.has(chosenFood) == true) {

			if (serverData.inventoryObject.meat[chosenFood] <= 0) {

				embedArray.push({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`,
				});

				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (maps.speciesMap.get(profileData.species).diet == 'herbivore') {

				minimumHungerPoints = 1;
				finalHungerPoints = Loottable(5, minimumHungerPoints);

				embed.description = `*${profileData.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${profileData.pronounArray[2]} attention. The ${profileData.species} walks over to it and begins to eat.* "This isn't very good!" *${profileData.name} whispers to ${profileData.pronounArray[4]} and leaves the den, stomach still growling, and craving for plants to grow.*`;
			}

			if (maps.speciesMap.get(profileData.species).diet == 'carnivore' || maps.speciesMap.get(profileData.species).diet == 'omnivore') {

				minimumHungerPoints = 11;
				finalHungerPoints = Loottable(10, minimumHungerPoints);

				embed.description = `*${profileData.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${profileData.pronounArray[2]} jaw as the ${profileData.species} finishes off the meal. It was a delicious feast, but very messy!*`;
			}

			if (profileData.hunger + finalHungerPoints > profileData.maxHunger) {

				finalHungerPoints -= (profileData.hunger + finalHungerPoints) - profileData.maxHunger;
			}

			serverData.inventoryObject.meat[chosenFood] -= 1;

			embed.footer.text = `+${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})${(profileData.currentRegion != 'food den') ? '\nYou are now at the food den' : ''}\n\n-1 ${chosenFood} for ${message.guild.name}`;

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { hunger: +finalHungerPoints } },
			);

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { inventoryObject: serverData.inventoryObject } },
			);

			embedArray.push(embed);
			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.users.size > 0) {

			const taggedProfileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
			});

			if (taggedProfileData) {

				embed.description = `*${profileData.name} looks down at ${taggedProfileData.name} as ${profileData.pronounArray[0]} nom${(profileData.pronounArray[5] == 'singular') ? 's' : ''} on the ${taggedProfileData.species}'s leg.* "No eating packmates here!" *${taggedProfileData.name} chuckled, shaking off ${profileData.name}.*`;
				embed.footer.text = (profileData.currentRegion != 'food den') ? '\nYou are now at the food den' : '';

				embedArray.push(embed);
				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}

		return await inventory
			.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray)
			.catch((error) => {
				throw new Error(error);
			});

		function Loottable(max, min) { return Math.floor(Math.random() * max + min); }
	},
};