import { Role } from 'discord.js';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, Event, WayOfEarningType } from '../typedef';

export const event: Event = {
	name: 'roleDelete',
	once: false,
	async execute(client: CustomClient, role: Role) {

		const serverData = await serverModel.findOne(s => s.serverId === role.guild.id);
		const roles = serverData.shop.filter(shoprole => shoprole.roleId === role.id);

		for (const shoprole of roles) {

			const allServerUsers = await userModel.find(
				(u) => Object.keys(u.currentCharacter).includes(role.guild.id),
			);

			for (const user of allServerUsers) {

				const characters = Object.values(user.characters).filter(c => Object.keys(c.profiles).includes(role.guild.id));

				for (const character of characters) {

					const profile = character.profiles[role.guild.id];
					const userRoleIndex = profile.roles.findIndex(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement);

					if (userRoleIndex >= 0) {

						const userRole = profile.roles[userRoleIndex];
						userModel.findOneAndUpdate(
							u => u.uuid === user.uuid,
							(u) => {
								u.characters[character._id].profiles[profile.serverId].roles.splice(userRoleIndex, 1);

								if (userRole.wayOfEarning === WayOfEarningType.Experience) {

									u.characters[character._id].profiles[profile.serverId].experience += (Number(userRole.requirement) || 0);
								}
							},
						);
					}
				}
			}
		}
	},
};