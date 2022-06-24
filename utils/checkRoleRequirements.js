// @ts-check
const { default_color, error_color } = require('../config.json');
const profileModel = require('../models/profileModel');

/**
 * Checks if user has reached the requirement to get a role based on their rank.
 * @param {import('../typedef').ServerSchema} serverData
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').GuildMember} member
 * @param {'Youngling'|'Apprentice'|'Hunter'|'Healer'|'Elderly'} userRank
 */
async function checkRankRequirements(serverData, message, member, userRank) {

	if (!message.inGuild()) {

		return;
	}

	// the reason why Elderly is also 2 is because as Elderly, it isn't clear if you were Hunter or Healer before
	// therefore, having the higher rank Elderly shouldn't automatically grant you a Hunter or Healer role
	const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
	const shop = serverData.shop.filter(item => item.wayOfEarning === 'rank');

	for (const item of shop) {

		if ((userRank === item.requirement || rankList[userRank] > rankList[item.requirement])) {

			try {

				const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne(
					{ userId: member.id },
				));
				const roles = userData.characters[userData.currentCharacter[message.guild.id]].profiles[message.guild.id].roles;

				if (roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement) === false) {

					await profileModel.findOneAndUpdate(
						{ userId: member.id },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}


				if (message.member && !message.member.roles.cache.has(item.roleId)) {

					await member.roles.add(item.roleId);

					await message.channel
						.send({
							content: member.toString(),
							embeds: [{
								color: /** @type {`#${string}`} */ (default_color),
								author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
								description: `You got the <@&${item.roleId}> role for being ${item.requirement}!`,
							}],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, message, member);
			}
		}
	}

	return;
}


/**
 * Checks if user has reached the requirement to get a role based on their level.
 * @param {import('../typedef').ServerSchema} serverData
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').GuildMember} member
 * @param {number} userLevel
 */
async function checkLevelRequirements(serverData, message, member, userLevel) {

	if (!message.inGuild()) {

		return;
	}

	const shop = serverData.shop.filter(item => item.wayOfEarning === 'levels');

	for (const item of shop) {

		if (userLevel >= item.requirement) {

			try {

				const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne(
					{ userId: member.id },
				));
				const roles = userData.characters[userData.currentCharacter[message.guild.id]].profiles[message.guild.id].roles;

				if (roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement) === false) {

					await profileModel.findOneAndUpdate(
						{ userId: member.id },
						(/** @type {import('../typedef').ProfileSchema} */ p) => {
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}

				if (member.roles.cache.has(item.roleId) === false) {

					await member.roles.add(item.roleId);

					await message.channel
						.send({
							content: member.toString(),
							embeds: [{
								color: /** @type {`#${string}`} */ (default_color),
								author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
								description: `You got the <@&${item.roleId}> role for being level ${item.requirement}!`,
							}],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, message, member);
			}
		}
	}
}

/**
 * Check if the bot has permission to add the role. If not, then send a message explaining the problem, else send a generic error message.
 * @param {*} error
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').GuildMember} member
 */
async function checkRoleCatchBlock(error, message, member) {

	if (!message.inGuild()) {

		return;
	}

	if (error.httpStatus === 403) {

		await message.channel
			.send({
				content: member.toString(),
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
				}],
			})
			.catch((err) => {
				if (err.httpStatus !== 404) { throw new Error(err); }
			});
	}
	else {

		console.error(error);
		await message.channel
			.send({
				content: member.toString(),
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'There was an error trying to add/remove the role :(',
				}],
			})
			.catch((err) => {
				if (err.httpStatus !== 404) { throw new Error(err); }
			});
	}
}

module.exports = {
	checkRankRequirements,
	checkLevelRequirements,
	checkRoleCatchBlock,
};