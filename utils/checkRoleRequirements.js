const config = require('../config.json');
const profileModel = require('../models/profileModel');

module.exports = {

	async checkRankRequirements(serverData, message, member, userRank) {

		// the reason why Elderly is also 2 is because as Elderly, it isn't clear if you were Hunter or Healer before
		// therefore, having the higher rank Elderly shouldn't automatically grant you a Hunter or Healer role
		const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
		const shop = serverData.shop.filter(item => item.wayOfEarning === 'rank');

		for (const item of shop) {

			if ((userRank === item.requirement || rankList[userRank] > rankList[item.requirement]) && message.member.roles.cache.has(item.roleId) === false) {

				try {

					await member.roles.add(item.roleId);

					const profileData = await profileModel.findOne(
						{ userId: member.id, serverId: member.guild.id },
					);

					profileData.roles.push({
						roleId: item.roleId,
						wayOfEarning: item.wayOfEarning,
						requirement: item.requirement,
					});

					await profileModel.findOneAndUpdate(
						{ userId: member.id, serverId: member.guild.id },
						{ $set: { roles: profileData.roles } },
					);

					await message.channel
						.send({
							content: member.toString(),
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

					await module.exports.checkRoleCatchBlock(error, message, member);
				}
			}
		}
	},

	async checkLevelRequirements(serverData, message, member, userLevel) {

		const shop = serverData.shop.filter(item => item.wayOfEarning === 'levels');

		for (const item of shop) {

			if (userLevel >= item.requirement && message.member.roles.cache.has(item.roleId) === false) {

				try {

					await member.roles.add(item.roleId);

					const profileData = await profileModel.findOne(
						{ userId: member.id, serverId: member.guild.id },
					);

					profileData.roles.push({
						roleId: item.roleId,
						wayOfEarning: item.wayOfEarning,
						requirement: item.requirement,
					});

					await profileModel.findOneAndUpdate(
						{ userId: member.id, serverId: member.guild.id },
						{ $set: { roles: profileData.roles } },
					);

					await message.channel
						.send({
							content: member.toString(),
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

					await module.exports.checkRoleCatchBlock(error, message, member);
				}
			}
		}
	},

	async checkRoleCatchBlock(error, message, member) {

		if (error.httpStatus === 403) {

			await message.channel
				.send({
					content: member.toString(),
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
			await message.channel
				.send({
					content: member.toString(),
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
	},
};