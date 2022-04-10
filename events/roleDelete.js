// @ts-check
const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'roleDelete',
	once: false,

	/**
	 * Emitted whenever a guild role is deleted.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Role} role
	 */
	async execute(client, role) {

		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: role.guild.id,
		}));

		if (serverData === null) {

			return;
		}

		const roles = serverData.shop.filter(shoprole => shoprole.roleId === role.id);

		for (const shoprole of roles) {

			const allServerProfiles = /** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.find({
				serverId: role.guild.id,
			}));

			for (const profile of allServerProfiles) {

				if (profile.roles.some(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement)) {

					const userRole = profile.roles.find(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement);
					const userRoleIndex = profile.roles.indexOf(userRole);

					if (userRoleIndex >= 0) { profile.roles.splice(userRoleIndex, 1); }

					await profileModel.findOneAndUpdate(
						{ userId: profile.userId, serverId: profile.serverId },
						{
							$inc: { experience: userRole.wayOfEarning === 'experience' ? userRole.requirement : 0 },
							$set: { roles: profile.roles },
						},
					);
				}
			}
		}
	},
};
module.exports = event;