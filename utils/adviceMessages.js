const profileModel = require('../models/profileModel');

module.exports = {

	async playAdvice(message) {

		await message.channel
			.send({
				content: `${message.author.toString()}\n❓ **Tip:** Go playing via \`rp play\` to find quests and rank up!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},

	async restAdvice(message, profileData) {

		if (profileData.energy <= 80 && profileData.advice.resting === false) {

			profileData.advice.resting = false;

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { advice: profileData.advice } },
			);

			await message.channel
				.send({
					content: `${message.author.toString()}\n❓ **Tip:** Rest via \`rp rest\` to fill up your energy. Resting takes a while, so be patient!`,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},

	async drinkAdvice(message, profileData) {

		if (profileData.thirst <= 80 && profileData.advice.drinking === false) {

			profileData.advice.drinking = true;

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { advice: profileData.advice } },
			);

			await message.channel
				.send({
					content: `${message.author.toString()}\n❓ **Tip:** Drink via \`rp drink\` to fill up your thirst.`,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},

	async eatAdvice(message, profileData) {

		if (profileData.hunger <= 80 && profileData.advice.eating === false) {

			profileData.advice.eating = true;

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { advice: profileData.advice } },
			);

			await message.channel
				.send({
					content: `${message.author.toString()}\n❓ **Tip:** Eat via \`rp eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},

	async passingoutAdvice(message, profileData) {

		if (profileData.advice.passingout === false) {

			profileData.advice.passingout = true;

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { advice: profileData.advice } },
			);

			await message.channel
				.send({
					content: `${message.author.toString()}\n❓ **Tip:** If your health, energy, hunger or thirst points hit zero, you pass out. Another player has to heal you so you can continue playing.\nMake sure to always watch your stats to prevent passing out!`,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},

	async apprenticeAdvice(message) {

		await message.channel
			.send({
				content: `${message.author.toString()}\n❓ **Tip:** As apprentice, you unlock new commands: \`explore\`, \`heal\`, \`practice\`, and \`dispose\`.\nCheck \`rp help\` to see what they do!\nGo exploring via \`rp explore\` to find more quests and rank up higher!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},

	async hunterhealerAdvice(message) {

		await message.channel
			.send({
				content: `${message.author.toString()}\n❓ **Tip:** Hunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly, but they are not able to use the \`practice\` and \`dispose\` commands or fight when \`exploring\`.\nHunters can \`dispose\` perfectly, but they are not able to use the \`heal\` command or pick up plants when \`exploring\`.\nHunters and Healers lose their ability to use the \`play\` command.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},

	async elderlyAdvice(message) {

		await message.channel
			.send({
				content: `${message.author.toString()}\n❓ **Tip:** Elderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};