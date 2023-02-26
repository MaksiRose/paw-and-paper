import { Role } from 'discord.js';
import QuidToServer from '../models/quidToServer';
import QuidToServerToShopRole from '../models/quidToServerToShopRole';
import ShopRole from '../models/shopRole';
import { WayOfEarningType } from '../typings/data/user';
import { DiscordEvent } from '../typings/main';

export const event: DiscordEvent = {
	name: 'roleDelete',
	once: false,
	async execute(role: Role) {

		const shopRole = await ShopRole.findOne({ where: { id: role.id } });
		if (shopRole?.wayOfEarning === WayOfEarningType.Experience) {

			const profileShopRoleRelations = await QuidToServerToShopRole.findAll({ where: { shopRoleId: role.id } });

			for (const relation of profileShopRoleRelations) {

				const profile = await QuidToServer.findOne({ where: { id: relation.quidToServerId } });
				await profile?.update({ experience: profile.experience + Number(shopRole.requirement) || 0 });
			}
		}

		await QuidToServerToShopRole.destroy({ where: { shopRoleId: role.id } });
		await ShopRole.destroy({ where: { id: role.id } });
	},
};