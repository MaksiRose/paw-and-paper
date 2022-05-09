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

			const allServerUsers = /** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.find(
				(/** @type {import('../typedef').ProfileSchema} */ p) => Object.keys(p.currentCharacter).includes(role.guild.id),
			));

			for (const user of allServerUsers) {

				const characters = Object.values(user.characters).filter(c => Object.keys(c.profiles).includes(role.guild.id));
				for (const character of characters) {

					const profile = character.profiles[role.guild.id];

					if (profile.roles.some(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement)) {

						const userRole = profile.roles.find(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement);
						const userRoleIndex = profile.roles.indexOf(userRole);

						if (userRoleIndex >= 0) { profile.roles.splice(userRoleIndex, 1); }

						await profileModel.findOneAndUpdate(
							{ uuid: user.uuid },
							(/** @type {import('../typedef').ProfileSchema} */ p) => {
								p.characters[character._id].profiles[profile.serverId].roles = profile.roles;
								if (userRole.wayOfEarning === 'experience') {
									p.characters[character._id].profiles[profile.serverId].experience += (Number(userRole.requirement) || 0);
								}
							},
						);
					}
				}
			}
		}
	},
};
module.exports = event;