const config = require('../../config.json');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { checkLevelRequirements, checkRankRequirements } = require('../../utils/checkRoleRequirements');

module.exports = {
	name: 'shopadd',
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		if (message.member.permissions.has('ADMINISTRATOR') === false) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Only administrators of a server can use this command!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		let requirement = argumentsArray.pop();
		let wayOfEarning = argumentsArray.pop()?.toLowerCase();
		const role = message.mentions.roles.first();

		if (['rank', 'level', 'levels', 'xp', 'experience'].indexOf(wayOfEarning) === -1) {

			wayOfEarning = undefined;
		}

		if (['level', 'levels', 'xp', 'experience'].indexOf(wayOfEarning) !== -1) {

			if (Number.isInteger(Number(requirement)) === false || Number(requirement) <= 0) {

				requirement = undefined;
			}
			else {

				requirement = Number(requirement);
			}
		}

		if (wayOfEarning === 'rank') {

			if (['youngling', 'apprentice', 'hunter', 'healer', 'elderly'].indexOf(requirement?.toLowerCase()) === -1) {

				requirement = undefined;
			}
			else {

				requirement = requirement.charAt(0).toUpperCase() + requirement.slice(1).toLowerCase();
			}
		}

		if (role === undefined || wayOfEarning === undefined || requirement === undefined) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Use this command to add a role to the shop. Here is how to use it:',
						description: 'rp shopadd [@role] [way of earning] [requirement]\n**The brackets are just for readability, don\'t type them out in the command!**\n\nReplace `way of earning` with either \'rank\', \'levels\' or \'XP\'. The first two mean that a user will automatically acquire the role when achieving the specified rank/level. The last one means that they have to spend the specified amount of XP to acquire it.\nReplace `requirement` with a number (for levels or XP) or a rank name (Youngling, Apprentice, Hunter, Healer, Elderly)',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (wayOfEarning === 'level') { wayOfEarning = 'levels'; }
		if (wayOfEarning === 'xp') { wayOfEarning = 'experience'; }

		if (serverData.shop.filter(item => wayOfEarning !== 'experience' && item.wayOfEarning === wayOfEarning && item.requirement === requirement).length > 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'There is already a role under these conditions!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (serverData.shop.filter(item => item.roleId === role.id && item.wayOfEarning !== wayOfEarning && (wayOfEarning === 'experience' || item.wayOfEarning === 'experience')).length > 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'The same role cannot be acquired both through earning (rank, levels) and buying (experience) due to the refund system.',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (wayOfEarning === 'experience' && serverData.shop.filter(item => item.roleId === role.id && item.wayOfEarning === wayOfEarning).length > 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'The same role cannot be sold at two different prices!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		serverData.shop.push({
			roleId: role.id,
			wayOfEarning: wayOfEarning,
			requirement: requirement,
		});

		serverData = await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			{ $set: { shop: serverData.shop } },
		);

		await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `${role.toString()} was added to the shop! The requirement is ${requirement} ${wayOfEarning}.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		const allServerProfiles = await profileModel.find({
			serverId: message.guild.id,
		});

		for (const profile of allServerProfiles) {

			if (wayOfEarning === 'levels') {

				const member = await message.guild.members.fetch(profile.userId);
				checkLevelRequirements(serverData, message, member, profile.levels);
			}

			if (wayOfEarning === 'rank') {

				const member = await message.guild.members.fetch(profile.userId);
				checkRankRequirements(serverData, message, member, profile.rank);
			}
		}
	},
};