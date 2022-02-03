const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'say',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const userText = argumentsArray.join(' ');

		if (!userText) {

			embedArray.push({
				color: config.default_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Talk to your fellow packmates! Gives 1 experience point each time. Here is how to use the command:',
				description: '\n\nrp say "text"\nReplace "text" with your text.',
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

		message
			.delete()
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $inc: { experience: 1 } },
		);

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: userText,
		});

		if (pingRuins == true) {

			let allRuinProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: profileData.currentRegion,
			});

			allRuinProfilesArray = allRuinProfilesArray.map(doc => doc.userId);
			const allRuinProfilesArrayUserIndex = allRuinProfilesArray.indexOf(`${profileData.userId}`);

			if (allRuinProfilesArrayUserIndex > -1) {

				allRuinProfilesArray.splice(allRuinProfilesArrayUserIndex, 1);
			}

			for (let i = 0; i < allRuinProfilesArray.length; i++) {

				allRuinProfilesArray[i] = `<@${allRuinProfilesArray[i]}>`;
			}

			if (allRuinProfilesArray != '') {


				return await message.channel
					.send({
						content: allRuinProfilesArray.join(' '),
						embeds: embedArray,
					})
					.catch((error) => {
						throw new Error(error);
					});
			}
		}

		return await message.channel
			.send({
				embeds: embedArray,
			})
			.catch((error) => {
				throw new Error(error);
			});
	},
};