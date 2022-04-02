const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');

module.exports = {
	name: 'roleDelete',
	once: false,
	async execute(client, role) {

		const serverData = await serverModel.findOne({
			serverId: role.guild.id,
		});

		if (serverData === null) {

			return;
		}

		const roles = serverData.roles.filter(shoprole => shoprole.roleId === role.id);

		for (const shoprole of roles) {

			const allServerProfiles = await profileModel.find({
				serverId: role.guild.id,
			});

			for (const profile of allServerProfiles) {

				if (profile.roles.some(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement)) {

					const userRole = profile.roles.find(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement);
					const userRoleIndex = profile.roles.indexOf(userRole);

					if (userRoleIndex >= 0) { profile.roles.splice(userRoleIndex, 1); }

					await profileModel.findOneAndUpdate(
						{ userId: profile.userId, serverId: profile.serverId },
						{
							$inc: { experience: userRole.wayOfEarning === 'experience' ? userRole.requirement : 0 },
							$set: { roles: profile.roles } },
					);
				}
			}
		}
	},
};