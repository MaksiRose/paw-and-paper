const profileModel = require('../models/profileModel');
const { checkLevelRequirements, checkRoleCatchBlock } = require('./checkRoleRequirements');
const { upperCasePronounAndPlural } = require('./getPronouns');
const config = require('../config.json');

module.exports = {

	async checkLevelUp(message, botReply, profileData, serverData) {

		const requiredExperiencePoints = profileData.levels * 50;

		if (profileData.experience >= requiredExperiencePoints) {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: profileData.userId, serverId: profileData.serverId },
				{
					$inc: {
						experience: -requiredExperiencePoints,
						levels: +1,
					},
				},
			);

			const embed = {
				color: profileData.color,
				title: `${profileData.name} just leveled up! ${upperCasePronounAndPlural(profileData, 0, 'is', 'are')} now level ${profileData.levels}.`,
			};

			botReply?.embeds.push(embed);
			await botReply
				?.edit({
					embeds: botReply.embeds,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			botReply = module.exports.checkLevelUp(message, botReply, profileData, serverData);
			await checkLevelRequirements(serverData, message, message.member, profileData.levels);

			return botReply;
		}
	},

	async decreaseLevel(profileData, botReply) {

		const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));

		botReply.embeds[0].footer = `${(profileData.experience > 0) ? `-${profileData.experience} XP` : ''}\n${(newUserLevel != profileData.levels) ? `-${profileData.levels - newUserLevel} level${(profileData.levels - newUserLevel > 1) ? 's' : ''}` : ''}`;

		const newUserInventory = { ...profileData.inventoryObject };
		for (const itemType of Object.keys(newUserInventory)) {

			for (const item of Object.keys(newUserInventory[itemType])) {

				if (newUserInventory[itemType][item] > 0) {

					botReply.embeds[0].footer += `\n-${newUserInventory[itemType][item]} ${item}`;
					newUserInventory[itemType][item] = 0;
				}
			}
		}

		if (botReply.embeds[0].footer == '') {

			botReply.embeds[0].footer = null;
		}


		profileData = await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{
				$set: {
					levels: newUserLevel,
					experience: 0,
					inventoryObject: newUserInventory,
				},
			},
		);

		const member = await botReply.guild.members.fetch(profileData.userId);
		const roles = profileData.roles.filter(role => role.wayOfEarning === 'levels' && role.requirement > profileData.levels);

		for (const role of roles) {

			try {

				const userRoleIndex = profileData.roles.indexOf(role);
				if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

				await profileModel.findOneAndUpdate(
					{ userId: profileData.userId, serverId: profileData.serverId },
					{ $set: { roles: profileData.roles } },
				);

				if (member.roles.cache.has(role.roleId) === true && profileData.roles.filter(profilerole => profilerole.roleId === role.roleId).length <= 1) {

					await member.roles.remove(role.roleId);

					await botReply.channel
						.send({
							content: member.toString(),
							embeds: [{
								color: config.default_color,
								author: { name: botReply.guild.name, icon_url: botReply.guild.iconURL() },
								description: `You lost the <@&${role.roleId}> role because of a lack of levels!`,
							}],
							failIfNotExists: false,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, botReply, member);
			}
		}

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