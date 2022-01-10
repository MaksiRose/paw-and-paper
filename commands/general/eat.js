const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const inventory = require('./inventory');
const profileModel = require('../../models/profileSchema');
const serverModel = require('../../models/serverSchema');
const arrays = require('../../utils/arrays');

module.exports = {
	name: 'eat',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		if (!argumentsArray.length) {
			return await inventory.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
		}

		console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): currentRegion changed from \x1b[33m${profileData.currentRegion} \x1b[0mto \x1b[33mfood den \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'food den' } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		const species = arrays.species(profileData);

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

		const userSpeciesArrayIndex = species.nameArray.findIndex((index) => index == profileData.species);

		const allPlantNamesArray = [].concat(arrays.commonPlantNamesArray, arrays.uncommonPlantNamesArray, arrays.rarePlantNamesArray);
		if (allPlantNamesArray.some(element => element == chosenFood)) {

			let serverPlantArray;
			let plantNamesArray;
			let plantEdibalityArray;
			let plantGivesEnergyArray;

			if (arrays.commonPlantNamesArray.some(element => element == chosenFood)) {

				serverPlantArray = serverData.commonPlantsArray;
				plantNamesArray = [...arrays.commonPlantNamesArray];
				plantEdibalityArray = [...arrays.commonPlantEdibalityArray];
				plantGivesEnergyArray = [...arrays.commonPlantGivesEnergyArray];
			}

			if (arrays.uncommonPlantNamesArray.some(element => element == chosenFood)) {

				serverPlantArray = serverData.uncommonPlantsArray;
				plantNamesArray = [...arrays.uncommonPlantNamesArray];
				plantEdibalityArray = [...arrays.uncommonPlantEdibalityArray];
				plantGivesEnergyArray = [...arrays.uncommonPlantGivesEnergyArray];
			}

			if (arrays.rarePlantNamesArray.some(element => element == chosenFood)) {

				serverPlantArray = serverData.rarePlantsArray;
				plantNamesArray = [...arrays.rarePlantNamesArray];
				plantEdibalityArray = [...arrays.rarePlantEdibalityArray];
				plantGivesEnergyArray = [...arrays.rarePlantGivesEnergyArray];
			}

			const plantNamesArrayIndex = plantNamesArray.findIndex((index) => index == chosenFood);

			if (serverPlantArray[plantNamesArrayIndex] <= 0) {

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
						if (error.httpStatus == 404) {
							console.log('Message already deleted');
						}
						else {
							throw new Error(error);
						}
					});
			}

			if (plantEdibalityArray[plantNamesArrayIndex] == 't') {

				minimumHungerPoints = -5;
				minimumHealthPoints = -10;
				finalHungerPoints = Loottable(5, minimumHungerPoints);
				finalHealthPoints = Loottable(3, minimumHealthPoints);

				embed.description = `*A yucky feeling drifts down ${profileData.name}'s throat. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} shake${(profileData.pronounArray[5] == 'singular') ? 's' : ''} and spit${(profileData.pronounArray[5] == 'singular') ? 's' : ''} it out, trying to rid ${profileData.pronounArray[2]} mouth of the taste. The plant is poisonous!*`;
			}

			if (plantEdibalityArray[plantNamesArrayIndex] == 'i') {

				minimumHungerPoints = -1;
				finalHungerPoints = Loottable(3, minimumHungerPoints);

				embed.description = `*${profileData.name} slowly opens ${profileData.pronounArray[2]} mouth and chomps onto the ${chosenFood}. The ${profileData.species} swallows it, but ${profileData.pronounArray[2]} face has a look of disgust. That wasn't very tasty!*`;
			}

			if (plantEdibalityArray[plantNamesArrayIndex] == 'e') {

				if (species.dietArray[userSpeciesArrayIndex] == 'carnivore') {

					minimumHungerPoints = 1;
					finalHungerPoints = Loottable(5, minimumHungerPoints);

					embed.description = `*${profileData.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${profileData.species} prefers.*`;
				}

				if (species.dietArray[userSpeciesArrayIndex] == 'herbivore' || species.dietArray[userSpeciesArrayIndex] == 'omnivore') {

					minimumHungerPoints = 11;
					finalHungerPoints = Loottable(20, minimumHungerPoints);

					embed.description = `*Leaves flutter into the storage den, landing near ${profileData.name}'s feet. The ${profileData.species} searches around the inventory determined to find the perfect meal, and that ${profileData.pronounArray[0]} do${(profileData.pronounArray[5] == 'singular') ? 'es' : ''}. ${profileData.name} plucks a ${chosenFood} from the pile and eats until ${profileData.pronounArray[2]} stomach is pleased.*`;
				}
			}

			if (plantGivesEnergyArray[plantNamesArrayIndex] == true) {

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

			finalHungerPoints.toString();
			if (finalHungerPoints >= 0) {

				finalHungerPoints = '+' + finalHungerPoints;
			}

			--serverPlantArray[plantNamesArrayIndex];

			if (arrays.commonPlantNamesArray.some(element => element == chosenFood)) {

				console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): commonPlantsArray changed from \x1b[33m${serverData.commonPlantsArray} \x1b[0mto \x1b[33m${serverPlantArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await serverModel
					.findOneAndUpdate(
						{ serverId: message.guild.id },
						{ $set: { commonPlantsArray: serverPlantArray } },
						{ new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});
			}

			if (arrays.uncommonPlantNamesArray.some(element => element == chosenFood)) {

				console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): uncommonPlantsArray changed from \x1b[33m${serverData.uncommonPlantsArray} \x1b[0mto \x1b[33m${serverPlantArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await serverModel
					.findOneAndUpdate(
						{ serverId: message.guild.id },
						{ $set: { uncommonPlantsArray: serverPlantArray } },
						{ new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});
			}

			if (arrays.rarePlantNamesArray.some(element => element == chosenFood)) {

				console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): rarePlantsArray changed from \x1b[33m${serverData.rarePlantsArray} \x1b[0mto \x1b[33m${serverPlantArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await serverModel
					.findOneAndUpdate(
						{ serverId: message.guild.id },
						{ $set: { rarePlantsArray: serverPlantArray } },
						{ new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});
			}

			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hunger changed from \x1b[33m${profileData.hunger} \x1b[0mto \x1b[33m${profileData.hunger + finalHungerPoints} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): health changed from \x1b[33m${profileData.health} \x1b[0mto \x1b[33m${profileData.health + finalHealthPoints} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): energy changed from \x1b[33m${profileData.energy} \x1b[0mto \x1b[33m${profileData.energy + finalEnergyPoints} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			profileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							hunger: +finalHungerPoints,
							health: +finalHealthPoints,
							energy: +finalEnergyPoints,
						},
					},
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			embed.footer.text = `${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;

			if (plantGivesEnergyArray[plantNamesArrayIndex] == true) {

				embed.footer.text += `\n+${finalEnergyPoints} energy (${profileData.energy}/${profileData.maxHunger})`;
			}

			if (plantEdibalityArray[plantNamesArrayIndex] == 't') {

				embed.footer.text += `\n${finalHealthPoints} health (${profileData.health}/${profileData.maxHealth})`;
			}

			embed.footer.text += `\n\n-1 ${chosenFood} for ${message.guild.name}`;

			embedArray.push(embed);
			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		if (species.nameArray.some(element => element == chosenFood)) {

			const serverMeatArray = serverData.meatArray;
			const meatNameArrayIndex = species.nameArray.findIndex((index) => index == chosenFood);

			if (serverMeatArray[meatNameArrayIndex] <= 0) {

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
						if (error.httpStatus == 404) {
							console.log('Message already deleted');
						}
						else {
							throw new Error(error);
						}
					});
			}

			if (species.dietArray[userSpeciesArrayIndex] == 'herbivore') {

				minimumHungerPoints = 1;
				finalHungerPoints = Loottable(5, minimumHungerPoints);

				embed.description = `*${profileData.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${profileData.pronounArray[2]} attention. The ${profileData.species} walks over to it and begins to eat.* "This isn't very good!" *${profileData.name} whispers to ${profileData.pronounArray[4]} and leaves the den, stomach still growling, and craving for plants to grow.*`;
			}

			if (species.dietArray[userSpeciesArrayIndex] == 'carnivore' || species.dietArray[userSpeciesArrayIndex] == 'omnivore') {

				minimumHungerPoints = 11;
				finalHungerPoints = Loottable(20, minimumHungerPoints);

				embed.description = `*${profileData.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${profileData.pronounArray[2]} jaw as the ${profileData.species} finishes off the meal. It was a delicious feast, but very messy!*`;
			}

			if (profileData.hunger + finalHungerPoints > profileData.maxHunger) {

				finalHungerPoints -= (profileData.hunger + finalHungerPoints) - profileData.maxHunger;
			}

			serverMeatArray[meatNameArrayIndex]--;

			console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): meatArray changed from \x1b[33m${serverData.meatArray} \x1b[0mto \x1b[33m${serverMeatArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			await serverModel
				.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { meatArray: serverMeatArray } },
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hunger changed from \x1b[33m${profileData.hunger} \x1b[0mto \x1b[33m${profileData.hunger + finalHungerPoints} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			profileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $inc: { hunger: +finalHungerPoints } },
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			embed.footer.text = `+${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})\n\n-1 ${chosenFood} for ${message.guild.name}`;

			embedArray.push(embed);
			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.users.size > 0) {
			let taggedProfileData;
			try {
				taggedProfileData = await profileModel
					.findOne({
						userId: message.mentions.users.first().id,
					})
					.catch((error) => {
						throw new Error(error);
					});
			}
			catch (err) {
				console.log(err);
			}

			if (taggedProfileData) {

				embed.description = `*${profileData.name} looks down at ${taggedProfileData.name} as ${profileData.pronounArray[0]} nom${(profileData.pronounArray[5] == 'singular') ? 's' : ''} on the ${taggedProfileData.species}'s leg.* "No eating packmates here!" *${taggedProfileData.name} chuckled, shaking off ${profileData.name}.*`;

				embedArray.push(embed);
				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus == 404) {
							console.log('Message already deleted');
						}
						else {
							throw new Error(error);
						}
					});
			}
		}

		return await inventory.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);

		function Loottable(max, min) { return Math.floor(Math.random() * max + min); }
	},
};