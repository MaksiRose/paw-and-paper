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
		const embed = {
			color: profileData.color,
			description: '',
			footer: { text: '' },
		};

		for (let i = 0; i < profileData.injuryObject.wounds; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });
			const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

			if (getsHealed == 0) {

				modifiedUserInjuryObject.wounds -= 1;

				embed.description += `\n*One of ${profileData.name}'s wounds healed! What luck!*`;
				continue;
			}

			extraLostHealthPoints += generateRandomNumber(5, 1);

			if (becomesInfection == 0) {

				modifiedUserInjuryObject.wounds -= 1;
				modifiedUserInjuryObject.infections += 1;

				embed.description += `\n*One of ${profileData.name}'s wounds turned into an infection!*`;
				continue;
			}

			embed.description += `\n*One of ${profileData.name}'s wounds is bleeding!*`;
		}

		for (let i = 0; i < profileData.injuryObject.infections; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				modifiedUserInjuryObject.infections -= 1;

				embed.description += `\n*One of ${profileData.name}'s infections healed! What luck!*`;
				continue;
			}

			const minimumInfectionHealthPoints = Math.round((10 - (profileData.health / 10)) / 3);
			extraLostHealthPoints += generateRandomNumber(5, (minimumInfectionHealthPoints > 0) ? minimumInfectionHealthPoints : 0);

			embed.description += `\n*One of ${profileData.name}'s infections is getting worse!*`;
		}

		if (profileData.injuryObject.cold == true) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				modifiedUserInjuryObject.cold = false;

				embed.description += `\n*${profileData.name} recovered from ${profileData.pronounArray[2]} cold! What luck!*`;
			}
			else {

				const minimumColdHealthPoints = Math.round((10 - (profileData.health / 10)) / 1.5);
				extraLostHealthPoints += generateRandomNumber(3, (minimumColdHealthPoints > 0) ? minimumColdHealthPoints : 0);

				embed.description += `\n*${profileData.name}'s cold is getting worse!*`;
			}
		}

		for (let i = 0; i < profileData.injuryObject.sprains; i++) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				modifiedUserInjuryObject.sprains -= 1;

				embed.description += `\n*One of ${profileData.name}'s sprains healed! What luck!*`;
				continue;
			}

			extraLostHealthPoints += generateRandomNumber(5, 4);

			embed.description += `\n*One of ${profileData.name}'s sprains is getting worse!*`;
		}

		if (profileData.injuryObject.poison == true) {

			const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

			if (getsHealed == 0) {

				modifiedUserInjuryObject.poison = false;

				embed.description += `\n*${profileData.name} recovered from ${profileData.pronounArray[2]} poisoning! What luck!*`;
			}
			else {

				const minimumPoisonHealthPoints = Math.round(10 - (profileData.health / 10));
				extraLostHealthPoints += generateRandomNumber(5, minimumPoisonHealthPoints);

				embed.description += `\n*The poison in ${profileData.name}'s body is spreading!*`;
			}
		}

		if (profileData.health - extraLostHealthPoints < 0) {

			extraLostHealthPoints = profileData.health;
		}

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: { health: -extraLostHealthPoints },
				$set: { injuryObject: modifiedUserInjuryObject },
			},
		);

		if (extraLostHealthPoints > 0) {

			embed.footer.text = `-${extraLostHealthPoints} HP (${profileData.health}/${profileData.maxHealth})`;
		}

		botReply.embeds.push(embed);
		botReply = await botReply
			.edit({
				embeds: botReply.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return botReply;
	},

};