import { Role } from 'discord.js';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, Event, WayOfEarningType } from '../typedef';
import { getMapData } from '../utils/helperFunctions';

export const event: Event = {
	name: 'roleDelete',
	once: false,
	async execute(client: CustomClient, role: Role) {

		const serverData = await serverModel.findOne(s => s.serverId === role.guild.id);
		const roles = serverData.shop.filter(shoprole => shoprole.roleId === role.id);

		for (const shoprole of roles) {

			const allServerUsers = await userModel.find(
				(u) => Object.values(u.quids).filter(q => Object.keys(q.profiles).includes(role.guild.id)).length > 0,
			);

			for (const user of allServerUsers) {

				const quids = Object.values(user.quids).filter(q => Object.keys(q.profiles).includes(role.guild.id));

				for (const quid of quids) {

					const profile = quid.profiles[role.guild.id];
					if (!profile) { continue; }
					const userRoleIndex = profile.roles.findIndex(profilerole => profilerole.roleId === shoprole.roleId && profilerole.wayOfEarning === shoprole.wayOfEarning && profilerole.requirement === shoprole.requirement);

					if (userRoleIndex >= 0) {

						const userRole = profile.roles[userRoleIndex];
						if (!userRole) { continue; }
						userModel.findOneAndUpdate(
							u => u.uuid === user.uuid,
							(u) => {
								const p = getMapData(getMapData(u.quids, quid._id).profiles, profile.serverId);
								p.roles.splice(userRoleIndex, 1);
								if (userRole.wayOfEarning === WayOfEarningType.Experience) { p.experience += (Number(userRole.requirement) || 0); }
							},
						);
					}
				}
			}
		}
	},
};