const profileModel = require('../models/profileModel');
const maps = require('./maps');

module.exports = {

	async levelCheck(message, profileData, botReply) {

		const requiredExperiencePoints = profileData.levels * 50;

		if (profileData.experience >= requiredExperiencePoints) {

			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): experience changed from \x1b[33m${profileData.experience} \x1b[0mto \x1b[33m${profileData.experience - requiredExperiencePoints} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): levels changed from \x1b[33m${profileData.levels} \x1b[0mto \x1b[33m${profileData.levels + 1} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			profileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							experience: -requiredExperiencePoints,
							levels: +1,
						},
					},
				)
				.catch((error) => {
					throw new Error(error);
				});

			const embed = {
				color: profileData.color,
				title: `${profileData.name} just leveled up! ${profileData.pronounArray[0].charAt(0).toUpperCase() + profileData.pronounArray[0].slice(1)} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} now level ${profileData.levels}.`,
			};

			botReply.embeds.push(embed);
			await botReply
				.edit({
					embeds: botReply.embeds,
				})
				.catch((error) => {
					throw new Error(error);
				});
		}
	},

	async decreaseLevel(message, profileData) {

		const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));
		const emptyUserInventory = {
			commonPlants: {},
			uncommonPlants: {},
			rarePlants: {},
			meat: {},
		};

		for (const [commonPlantName] of maps.commonPlantMap) {

			emptyUserInventory.commonPlants[commonPlantName] = 0;
		}

		for (const [uncommonPlantName] of maps.uncommonPlantMap) {

			emptyUserInventory.uncommonPlants[uncommonPlantName] = 0;
		}

		for (const [rarePlantName] of maps.rarePlantMap) {

			emptyUserInventory.rarePlants[rarePlantName] = 0;
		}

		for (const [speciesName] of maps.speciesMap) {

			emptyUserInventory.meat[speciesName] = 0;
		}

		(profileData.levels != newUserLevel) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): levels changed from \x1b[33m${profileData.levels} \x1b[0mto \x1b[33m${newUserLevel} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		(profileData.experience != 0) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): experience changed from \x1b[33m${profileData.experience} \x1b[0mto \x1b[33m0 \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		(profileData.inventoryObject != emptyUserInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject changed from \x1b[33m${JSON.stringify(profileData.inventoryObject)} \x1b[0mto \x1b[33m[${JSON.stringify(emptyUserInventory)}] \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: {
						levels: newUserLevel,
						experience: 0,
						inventoryObject: emptyUserInventory,
					},
				},
			)
			.catch((error) => {
				throw new Error(error);
			});
	},

};