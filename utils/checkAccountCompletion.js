const config = require('../config.json');

module.exports = {

	async hasNoName(message, profileData) {

		if (!profileData || profileData.name == '') {

			await message.channel
				.sendTyping()
				.catch((error) => {
					throw new Error(error);
				});

			await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Please type "rp name [name] to begin setting up your account!',
					}],
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

	async hasNoSpecies(message, profileData) {

		if (profileData.species == '') {

			await message.channel
				.sendTyping()
				.catch((error) => {
					throw new Error(error);
				});

			await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: `Please choose ${profileData.name}'s species!!`,
					}],
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

	async hasNotCompletedAccount(message, profileData) {

		if (await module.exports.hasNoName(message, profileData)) {
			return true;
		}

		if (await module.exports.hasNoSpecies(message, profileData)) {

			return true;
		}

		return false;
	},
};