const profileModel = require('../../models/profileSchema');
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

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		message
			.delete()
			.catch((error) => {
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
					throw new Error(error);
				}
			});

		console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): experience changed from \x1b[33m${profileData.experience} \x1b[0mto \x1b[33m${profileData.experience + 1} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { experience: 1 } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: userText,
		});

		if (pingRuins == true) {

			let allRuinProfilesArray = await profileModel
				.find({
					serverId: message.guild.id,
					currentRegion: profileData.currentRegion,
				})
				.catch((error) => {
					throw new Error(error);
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