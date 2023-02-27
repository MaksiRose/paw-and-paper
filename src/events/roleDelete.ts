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

		const shopRole = await ShopRole.findByPk(role.id);
		if (shopRole && shopRole.wayOfEarning === WayOfEarningType.Experience) {

			const profileToRoleRelations = await QuidToServerToShopRole.findAll({ where: { shopRoleId: role.id } });

			for (const relation of profileToRoleRelations) {

				const quidToServer = await QuidToServer.findByPk(relation.quidToServerId);
				await quidToServer?.update({ experience: quidToServer.experience + Number(shopRole.requirement) || 0 });
			}
		}

		await QuidToServerToShopRole.destroy({ where: { shopRoleId: role.id } });
		await ShopRole.destroy({ where: { id: role.id } });
	},
};