const profileModel = require('../models/profileModel');
const config = require('../config.json');
const { stopResting } = require('./executeResting');
const { decreaseLevel } = require('./levelHandling');
const { pronounAndPlural, pronoun, upperCasePronoun } = require('./getPronouns');
const { passingoutAdvice } = require('./adviceMessages');

module.exports = {

	async isPassedOut(message, profileData, isNew) {

		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) {

			const botReply = await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(profileData, 0, 'screeches', 'screech')} with ${pronoun(profileData, 2)} last energy. Without help, ${pronoun(profileData, 0)} will not be able to continue.*`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			if (isNew === true) {

				decreaseLevel(profileData, botReply);
			}

			await passingoutAdvice(message, profileData);

			return true;
		}

		return false;
	},

	async hasCooldown(message, profileData, callerNameArray) {

		const commandName = message.content.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase();

		if (profileData.hasCooldown == true && callerNameArray.includes(commandName)) {

			await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} is so eager to get things done today that ${pronounAndPlural(profileData, 0, 'is', 'are')} somersaulting. ${upperCasePronoun(profileData, 0)} should probably take a few seconds to calm down.*`,
					}],
					failIfNotExists: false,
				})
				.then(reply => {
					setTimeout(async function() {

						await reply
							.delete()
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}, 10000);
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return true;
		}

		return false;
	},

	async isResting(message, profileData, embedArray) {

		if (profileData.isResting == true) {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { isResting: false } },
			);

			stopResting(message.author.id, message.guild.id);

			embedArray.unshift({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} opens ${pronoun(profileData, 2)} eyes, blinking at the bright sun. After a long stretch, ${pronounAndPlural(profileData, 0, 'leave')} ${pronoun(profileData, 2)} den to continue ${pronoun(profileData, 2)} day.*`,
				footer: { text: `Current energy: ${profileData.energy}` },
			});
		}

		return profileData;
	},

	async isInvalid(message, profileData, embedArray, callerNameArray) {

		if (await module.exports.isPassedOut(message, profileData, false)) {

			return true;
		}

		if (await module.exports.hasCooldown(message, profileData, callerNameArray)) {

			return true;
		}

		await module.exports.isResting(message, profileData, embedArray);

		return false;
	},
};