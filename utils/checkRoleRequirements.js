const config = require('../config.json');

module.exports = {

	async checkRankRequirements(serverData, message, userRank) {

		const shop = serverData.shop.filter(item => item.wayOfEarning === 'rank');

		for (const item of shop) {

			if (item.requirement === userRank && message.member.roles.cache.has(item.roleId) === false) {

				try {

					await message.member.roles.add(item.roleId);

					await message
						.reply({
							embeds: [{
								color: config.default_color,
								author: { name: message.guild.name, icon_url: message.guild.iconURL() },
								title: `You got the <@&${item.roleId}> role for being ${item.requirement}!`,
							}],
							failIfNotExists: false,
						})
						.catch((err) => {
							if (err.httpStatus !== 404) {
								throw new Error(err);
							}
						});
				}
				catch (error) {

					if (error.httpStatus === 403) {

						await message
							.reply({
								embeds: [{
									color: config.error_color,
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
								}],
								failIfNotExists: false,
							})
							.catch((err) => {
								if (err.httpStatus !== 404) {
									throw new Error(err);
								}
							});
					}
					else {

						console.error(error);
						await message
							.reply({
								embeds: [{
									color: config.error_color,
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									title: 'There was an error trying to add the role :(',
								}],
								failIfNotExists: false,
							})
							.catch((err) => {
								if (err.httpStatus !== 404) {
									throw new Error(err);
								}
							});
					}
				}
			}
		}
	},

	async checkLevelRequirements(serverData, message, userLevel) {

		const shop = serverData.shop.filter(item => item.wayOfEarning === 'levels');

		for (const item of shop) {

			if (item.requirement === userLevel && message.member.roles.cache.has(item.roleId) === false) {

				try {

					await message.member.roles.add(item.roleId);

					await message
						.reply({
							embeds: [{
								color: config.default_color,
								author: { name: message.guild.name, icon_url: message.guild.iconURL() },
								title: `You got the <@&${item.roleId}> role for being level ${item.requirement}!`,
							}],
							failIfNotExists: false,
						})
						.catch((err) => {
							if (err.httpStatus !== 404) {
								throw new Error(err);
							}
						});
				}
				catch (error) {

					if (error.httpStatus === 403) {

						await message
							.reply({
								embeds: [{
									color: config.error_color,
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
								}],
								failIfNotExists: false,
							})
							.catch((err) => {
								if (err.httpStatus !== 404) {
									throw new Error(err);
								}
							});
					}
					else {

						console.error(error);
						await message
							.reply({
								embeds: [{
									color: config.error_color,
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									title: 'There was an error trying to add the role :(',
								}],
								failIfNotExists: false,
							})
							.catch((err) => {
								if (err.httpStatus !== 404) {
									throw new Error(err);
								}
							});
					}
				}
			}
		}
	},
};