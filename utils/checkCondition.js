const profileModel = require('../models/profileModel');
const { generateRandomNumber, pullFromWeightedTable } = require('./randomizers');

module.exports = {

	async decreaseThirst(profileData) {

		const minimumThirstPoints = Math.round(10 - (profileData.energy / 10));
		let thirstPoints = 0;

		if (minimumThirstPoints > 0) {

			thirstPoints = Math.floor(Math.random() * 3) + minimumThirstPoints;

			if (profileData.thirst - thirstPoints < 0) {

				thirstPoints = profileData.thirst;
			}
		}

		return thirstPoints;
	},

	async decreaseHunger(profileData) {

		let minimumHungerPoints = Math.round(10 - (profileData.energy / 10));
		let hungerPoints = 0;

		if (minimumHungerPoints > 0) {

			minimumHungerPoints = Math.round(minimumHungerPoints / 2);
			hungerPoints = Math.floor(Math.random() * 3) + minimumHungerPoints;

			if (profileData.hunger - hungerPoints < 0) {

				hungerPoints = profileData.hunger;
			}
		}

		return hungerPoints;
	},

	async decreaseEnergy(profileData) {
		let minimumEnergyPoints = Math.round(10 - (profileData.health / 10));
		let extraLostEnergyPoints = 0;

		if (minimumEnergyPoints > 0) {

			minimumEnergyPoints = Math.round(minimumEnergyPoints / 1.5);
			extraLostEnergyPoints = Math.floor(Math.random() * 2) + minimumEnergyPoints;

			if (profileData.energy - extraLostEnergyPoints < 0) {

				extraLostEnergyPoints = profileData.energy;
			}
		}

		return extraLostEnergyPoints;
	},

	async decreaseHealth(message, profileData, botReply, modifiedUserInjuryObject) {

		if (Object.values(profileData.injuryObject).every((value) => value == 0)) {

			return modifiedUserInjuryObject;
		}

		let extraLostHealthPoints = 0;
		let woundHealthPoints = 0;
		let infectionHealthPoints = 0;
		let coldHealthPoints = 0;
		let sprainHealthPoints = 0;
		let poisonHealthPoints = 0;
		const userInjuryObject = { ...profileData.injuryObject };
		const embed = {
			color: profileData.color,
			description: '',
			footer: { text: '' },
		};

		for (let i = 0; i < profileData.injuryObject.wounds; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });
			const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

			if (getsHealed == 0) {

				userInjuryObject.wounds -= 1;
				modifiedUserInjuryObject.wounds -= 1;

				embed.description += `\n*One of ${profileData.name}'s wounds healed! What luck!*`;
				continue;
			}

			woundHealthPoints += generateRandomNumber(5, 1);

			if (becomesInfection == 0) {

				userInjuryObject.wounds -= 1;
				modifiedUserInjuryObject.wounds -= 1;

				userInjuryObject.infections += 1;
				modifiedUserInjuryObject.infections += 1;

				embed.description += `\n*One of ${profileData.name}'s wounds turned into an infection!*`;
				continue;
			}

			embed.description += `\n*One of ${profileData.name}'s wounds is bleeding!*`;
		}

		for (let i = 0; i < profileData.injuryObject.infections; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				userInjuryObject.infections -= 1;
				modifiedUserInjuryObject.infections -= 1;

				embed.description += `\n*One of ${profileData.name}'s infections healed! What luck!*`;
				continue;
			}

			let minimumInfectionHealthPoints = Math.round(10 - (profileData.health / 10));

			if (minimumInfectionHealthPoints > 0) {

				minimumInfectionHealthPoints = Math.round(minimumInfectionHealthPoints / 2);
			}

			infectionHealthPoints += generateRandomNumber(5, minimumInfectionHealthPoints);
			embed.description += `\n*One of ${profileData.name}'s infections is getting worse!*`;
		}

		if (profileData.injuryObject.cold == true) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				userInjuryObject.cold = false;
				modifiedUserInjuryObject.cold = false;

				embed.description += `\n*${profileData.name} recovered from ${profileData.pronounArray[2]} cold! What luck!*`;
			}
			else {

				const minimumColdHealthPoints = Math.round(10 - (profileData.health / 10));

				coldHealthPoints = coldHealthPoints + generateRandomNumber(5, minimumColdHealthPoints);
				embed.description += `\n*${profileData.name}'s cold is getting worse!*`;
			}
		}

		for (let i = 0; i < profileData.injuryObject.sprains; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				userInjuryObject.sprains -= 1;
				modifiedUserInjuryObject.sprains -= 1;

				embed.description += `\n*One of ${profileData.name}'s sprains healed! What luck!*`;
				continue;
			}

			sprainHealthPoints += generateRandomNumber(5, 6);
			embed.description += `\n*One of ${profileData.name}'s sprains is getting worse!*`;
		}

		if (profileData.injuryObject.poison == true) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				userInjuryObject.poison = false;
				modifiedUserInjuryObject.poison = false;

				embed.description += `\n*${profileData.name} recovered from ${profileData.pronounArray[2]} poisoning! What luck!*`;
			}
			else {

				const minimumPoisonHealthPoints = Math.round(21 - (profileData.health / 10));

				poisonHealthPoints = poisonHealthPoints + generateRandomNumber(5, minimumPoisonHealthPoints);
				embed.description += `\n*The poison in ${profileData.name}'s body is spreading!*`;
			}
		}

		extraLostHealthPoints = woundHealthPoints + infectionHealthPoints + coldHealthPoints + sprainHealthPoints + poisonHealthPoints;

		if (profileData.health - extraLostHealthPoints < 0) {

			extraLostHealthPoints = profileData.health;
		}

		// this is done to keep the console logs injury Array correct
		profileData = await profileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
		});

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: { health: -extraLostHealthPoints },
				$set: { injuryObject: userInjuryObject },
			},
		);

		if (extraLostHealthPoints > 0) {

			embed.footer.text = `-${extraLostHealthPoints} HP (${profileData.health}/${profileData.maxHealth})`;
		}

		botReply.embeds.push(embed);
		await botReply
			.edit({
				embeds: botReply.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return modifiedUserInjuryObject;
	},

};